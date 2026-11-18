# AI Remix Relay

**An AI creation relay where every remix can become the next person's starting point.**

AI Remix Relay turns one-off image and text generation into collaborative, branching creation. A participant starts from an existing Seed, chooses a change rule, reviews AI-generated candidates, and publishes one version into a lineage that others can continue.

> Public website: not published yet. The local preview at `http://127.0.0.1:4173/` is for development only and is not a public demo link.

## What users can do

- Browse image and text Relays, then continue from an existing node instead of starting with a blank prompt.
- Choose a focused remix rule or describe a free-form creative intent.
- Generate three candidate versions through a server-side AI provider and select one to publish.
- Trace parentage, creator attribution, content hashes, license, and handoff history.
- Invite the next participant to continue a public or access-controlled Relay.

The product's core mechanic is the Relay Graph: each published result is both a creative work and a possible starting point for another participant. The TapeOut Circuit deterministically evaluates structured policy inputs and selects a recipe code used by the AI flow; it does not interpret artwork, enforce copyright, or guarantee the model follows the prompt. X Layer stores verifiable lineage commitments when a user submits and confirms a Registry transaction.

## Build X Series integration

| Component | Current evidence | Product role |
| --- | --- | --- |
| X Layer | Chain ID `196`; RPC reads are performed against X Layer | Network state and the target network for registry writes |
| TapeOut Processor | `0x9e2849c04a513fe64db07521cbe52d078d905c0e` | Hosts the project's rule circuit |
| TapeOut Circuit | Circuit `#5`, TapeID `5.2.414` | Evaluates the current remix rule and returns the recipe used by the creation flow |
| RelayRegistry | `0xEE292a9815CA0C30b5a7c1227B8953351F54b286` | Stores verifiable Relay lineage commitments |

Deployed evidence: [TapeOut Circuit transaction](https://www.okx.com/web3/explorer/xlayer/tx/0xdfd2d9d405cd1dbc882001c0f0752e715d3651f3024c442d28ce2f760f0cf8291), [RelayRegistry contract](https://www.okx.com/web3/explorer/xlayer/address/0xEE292a9815CA0C30b5a7c1227B8953351F54b286), and [Seed root registration](https://www.okx.com/web3/explorer/xlayer/tx/0x89f1b4af5d4bfe8b29c5398a8c1b8d02ba84612ffbf8807f2de8777a6c5a7a53). The contract stores lineage commitments; it does not store artwork or perform creator payouts.

Still unverified: public child-node transaction, production AI configuration, two-account relay test, live paid checkout, and public demo URL. No paying customers or revenue are claimed. This prototype has not been independently security audited.

## Evaluation readiness

| Criterion | What the product demonstrates | Evidence still needed |
| --- | --- | --- |
| User value and commercial potential | Prompt-light image/text remixing, shared lineage, free starter credits | External user testing, repeat participation, pricing interviews; no paid flow yet |
| Innovation | Branching AI relay with a TapeOut-generated remix recipe | Show rule-dependent outputs and document that the Circuit checks declared metadata, not creative meaning |
| TapeOut/X Layer use | Live Circuit calls; deployed Registry and root record | Production deploy of strict receipt verification and a confirmed child transaction |
| Completion and usability | Interactive studio, invitation flows, server-side AI integration, 15 automated tests | Public demo, configured production AI, two-account end-to-end test, mobile/keyboard browser QA |

This is an engineering readiness checklist, not a predicted judging score. See [the full requirements and evidence matrix](SUBMISSION_BLUEPRINT.md).

See [SUBMISSION_BLUEPRINT.md](SUBMISSION_BLUEPRINT.md) for the requirements matrix and current submission gaps, [Circuit specification](docs/RELAY_RULE_CIRCUIT_SPEC.md), and [Registry deployment notes](docs/REGISTRY_DEPLOYMENT.md).

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars` on your machine with an AI provider key and endpoint. Keep the key server-side; never paste it into frontend code or commit `.dev.vars`. The provider must support the API routes used by this application (`/responses` and `/images/edits`) and the configured model names.

```powershell
npm run preview
```

Open `http://127.0.0.1:4173/`. This is a local development URL, not a submission URL. The preview uses local D1/R2 emulation. It does not publish the site or create production infrastructure.

## Verify

```powershell
npm test
npm run build
npm run validate
```

## Production deployment checklist

Before publishing a public demo:

1. Provision production D1 and R2 bindings; do not use the local placeholder database ID in production.
2. Configure the AI endpoint and supported model names as server-side Worker variables, and store the provider key as a Worker secret.
3. Deploy the Worker and verify the public site's bootstrap, image generation, text generation, invitation flow, and access-control failures.
4. Verify Circuit evaluation and a wallet-confirmed Registry child write on X Layer; preserve transaction evidence. Public browsing does not need a wallet. Creating a Seed or using AI requires a signed-in identity; writing to the Registry additionally requires wallet approval and gas.
5. Add the final public website URL, official X profile, and official contact email after those public identities are confirmed.

## Project structure

- `web/index.html` — interactive product experience.
- `worker/index.js` — API, AI provider calls, Relay state, Circuit integration, and publication flow.
- `contracts/RelayRegistry.sol` — X Layer lineage registry contract.
- `circuits/relay_rule_v1.blif` — TapeOut rule circuit source.
- `drizzle/` — D1 schema and migrations.
- `docs/` — circuit and contract implementation notes.

## Security and licensing

Do not commit `.dev.vars`, `.env` files, production credentials, wallet seeds, or private user data. Report security issues privately to the maintainers once the official contact channel is published. No open-source license has been selected yet; all rights are reserved by default until a license is added.
