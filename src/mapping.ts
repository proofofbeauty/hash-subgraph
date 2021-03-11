import { HashOwnership } from "../generated/schema"
import { Address, BigInt, store } from "@graphprotocol/graph-ts";
import { ERC1155, TransferBatch, TransferSingle, URI } from "../generated/Hash/ERC1155";
import { Hash } from "../generated/schema";
import { BIGINT_ZERO, ZERO_ADDRESS } from "./constants";

export function handleTransferSingle(event: TransferSingle): void {
    transferBase(
        event.address,
        event.params._from,
        event.params._to,
        event.params._id,
        event.params._value,
        event.block.timestamp
    );
}

export function handleTransferBatch(event: TransferBatch): void {
    if (event.params._ids.length != event.params._values.length) {
        throw new Error("Inconsistent arrays length in TransferBatch");
    }

    for (let i = 0; i < event.params._ids.length; i++) {
        let ids = event.params._ids;
        let values = event.params._values;
        transferBase(
            event.address,
            event.params._from,
            event.params._to,
            ids[i],
            values[i],
            event.block.timestamp
        );
    }
}

function transferBase(tokenAddress: Address, from: Address, to: Address, id: BigInt, value: BigInt, timestamp: BigInt): void {
    let hashTokenId = id.toHexString();
    let hash = Hash.load(hashTokenId);
    if (hash == null) {
        // TODO: map hash in
        let contract = ERC1155.bind(tokenAddress);
        hash = new Hash(hashTokenId);
        hash.tokenAddress = tokenAddress;
        hash.createdAt = timestamp;
        hash.save();
    }

    if (to == ZERO_ADDRESS) {
        // burn token
        hash.removedAt = timestamp;
        hash.save();
    }

    if (from != ZERO_ADDRESS) {
      updateHashOwnership(hashTokenId, from, BIGINT_ZERO.minus(value));
    }
    updateHashOwnership(hashTokenId, to, value);
}

export function updateHashOwnership(tokenId: string, owner: Address, deltaQuantity: BigInt): void {
  let ownershipId = tokenId + "/" + owner.toHexString();
  let ownership = HashOwnership.load(ownershipId);

  if (ownership == null) {
    ownership = new HashOwnership(ownershipId);
    ownership.hash = tokenId;
    ownership.owner = owner;
    ownership.quantity = BIGINT_ZERO;
  }

  let newQuantity = ownership.quantity.plus(deltaQuantity);

  if (newQuantity.lt(BIGINT_ZERO)) {
    throw new Error("Negative token quantity")
  }

  if (newQuantity.isZero()) {
    store.remove('HashOwnership', ownershipId);
  } else {
    ownership.quantity = newQuantity;
    ownership.save();
  }
}