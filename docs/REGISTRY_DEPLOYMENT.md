# RelayRegistry deployment checklist

## Contract

`contracts/RelayRegistry.sol` is the application-layer lineage registry for AI Remix Relay. It stores the parent-child relationship, content hash, rule hash, TapeOut input commitment, recipe code, creator, content type, and split basis points.

The contract has two deliberately separate write paths:

- `registerRoot(...)`: owner-only bootstrap for an off-chain Relay Seed. This is required before the first child can be published.
- `publishNode(...)`: permissionless child publication. It rejects unknown parents, invalid content types, and split values above 30%.

The current `publishNode` selector is `0x3d85d609`. The frontend must use this selector; the previous prototype selector was incorrect and has been removed.

## First deployment sequence

1. Deploy `RelayRegistry` from the project wallet on X Layer (chain ID 196).
2. Record the deployment address in `RELAY_REGISTRY_ADDRESS`.
3. Call `registerRoot` once for the canonical `City Signal 2049` Seed node.
4. Verify the `NodePublished` event and `nodes(rootNodeId)` result on OKLink.
5. Publish one child from the product UI and verify the second `NodePublished` event.
6. Only after both events are confirmed should the Registry address and transaction hashes be included in the competition submission.

## Confirmed X Layer evidence

- Network: X Layer mainnet (chain ID 196)
- Registry address: `0xEE292a9815CA0C30b5a7c1227B8953351F54B286`
- Registry deployment transaction: `0xfe240b00d4c91ec1358e511a547bde9b7f0efa4acbcae4252df1bab94173910a`
- Root registration transaction: `0x89f1b4af5d4bfe8b29c5398a8c1b8d02ba84612ffbf8807f2de8777a6c5a7a53`
- Root registration receipt: success (`status = 0x1`), block `0x486dc80`
- Root `NodePublished` topics confirm `nodeId = 0x820d5d8baf762ec66dcd56fed15c78bf2798d4f9bd492f4553e99b4684865498`, `relayId = 0x7f12107d61846355bbe2be1482bad64a0b452804b5d627d908c5119e6f768d3d`, and `parentNodeId = 0x0000000000000000000000000000000000000000000000000000000000000000`.

The first child publication remains the next evidence item. It must be submitted through the product UI and recorded with its transaction hash and receipt before the Registry checklist is complete.

The current Circuit #5 read-only gate remains independent from this registry deployment. It must pass before the product accepts a publication; the Registry then records the resulting application evidence.
