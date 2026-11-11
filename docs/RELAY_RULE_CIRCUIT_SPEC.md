# RelayRule Circuit v1

## Purpose

`RelayRule` is the deterministic policy gate for AI Remix Relay. The AI model remains off-chain; TapeOut verifies the machine-readable conditions that make a remix publishable.

## Inputs

1. `parentExists` — the parent node is known to the relay registry.
2. `contentTypeAllowed` — image or text is allowed by the relay.
3. `ruleAllowed` — the selected rule code belongs to the relay manifest.
4. `attributionPreserved` — the parent contribution is carried into the new receipt.
5. `licenseAccepted` — the selected license permits the requested remix.
6. `splitWithinLimit` — the declared share is between 0 and 30%.

## Output

`ALLOW = parentExists && contentTypeAllowed && ruleAllowed && attributionPreserved && licenseAccepted && splitWithinLimit`

When `ALLOW` is true, the circuit also returns a small `recipeCode`. The recipe code is the bridge between TapeOut and the AI layer: it selects the permitted remix strategy (for example `IMAGE_COLOR_SHIFT` or `TEXT_NARRATIVE_LENS`). The provider receives this code as part of the generation instruction, so the circuit output changes the product behavior rather than merely appearing in an audit panel.

The circuit does not judge artistic quality or AI safety. Those remain application/provider responsibilities. The circuit only decides whether the declared lineage and policy inputs satisfy the relay's publish contract and which deterministic recipe the AI layer may use.

## X Layer evidence required before submission

- Processor contract address
- Circuit ID / TapeID
- Circuit invocation result
- RelayRegistry contract address
- At least one `NodePublished` transaction hash
- A receipt that binds the AI output hash, Circuit result and registry transaction
