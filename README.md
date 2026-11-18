# AI Remix Relay

**An AI creation relay where every remix can become the next person's starting point.**

AI Remix Relay turns one-off image and text generation into collaborative, branching creation. A participant starts from an existing Seed, chooses a change rule, reviews AI-generated candidates, and publishes one version into a lineage that others can continue.

> Public website: not published yet. This repository is being prepared for the Build X Series submission; do not use a local preview URL as the public demo link.

## What users can do

- Browse image and text Relays, then continue from an existing node instead of starting with a blank prompt.
- Choose a focused remix rule or describe a free-form creative intent.
- Generate three candidate versions through a server-side AI provider and select one to publish.
- Trace parentage, creator attribution, content hashes, license, and handoff history.
- Invite the next participant to continue a public or access-controlled Relay.

The product's core mechanic is the Relay Graph: each published result is both a creative work and a possible starting point for another participant. TapeOut Circuit rules are checked before generation/publication; X Layer is the target for verifiable lineage records.

## Build X Series integration

| Component | Current evidence | Product role |
| --- | --- | --- |
| X Layer | Chain ID `196`; RPC reads are performed against X Layer | Network state and the target network for registry writes |
| TapeOut Processor | `0x9e2849c04a513fe64db07521cbe52d078d905c0e` | Hosts the project's rule circuit |
| TapeOut Circuit | Circuit `#5`, TapeID `5.2.414` | Evaluates the current remix rule and returns the recipe used by the creation flow |
| RelayRegistry | `0xEE292a9815CA0C30b5a7c1227B8953351F54b286` | Stores verifiable Relay lineage commitments |

The deployment blueprint records the Circuit deployment transaction, Registry deployment, and root registration evidence. A public child-node transaction, production AI configuration, live paid checkout, and a public demo URL must be verified before they are claimed as shipped submission evidence. The prototype has not been independently security audited.

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
4. Verify Circuit evaluation and a wallet-confirmed Registry child write on X Layer; preserve transaction evidence.
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
