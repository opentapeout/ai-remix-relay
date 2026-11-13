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

The current Circuit #5 read-only gate remains independent from this registry deployment. It must pass before the product accepts a publication; the Registry then records the resulting application evidence.
