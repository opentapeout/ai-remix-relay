# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Web application, server-side AI service, X Layer contracts and RPC, and a TapeOut Circuit.

## Users

Ordinary AI-curious users who want to join a collaborative creation without starting from a blank prompt; image and text creators who want their work to be continued with clear attribution and remix rules.

## Product Purpose

AI Remix Relay turns one-off AI generation into a collaborative relay. A participant opens an existing image or text Seed, chooses a permitted change, reviews AI-generated candidates, and publishes a selected version as the next node in a lineage that another participant can continue.

## Positioning

The product is an application, not a generic AI generator, NFT marketplace, campaign manager, or chain explorer. Its core mechanic is the Relay Graph: each output can become another person's starting point. TapeOut checks declared remix-policy inputs and selects the recipe used by the AI flow; X Layer can provide verifiable lineage records when the configured registry transaction is submitted.

## Core User Loop

1. Discover a public image or text Seed.
2. Continue from a selected node and choose a focused remix direction.
3. Ask the AI service for three candidates, then review and select one.
4. Publish the chosen result with parentage, attribution, license, and rule evidence.
5. Share the next turn or branch the Relay.

## Current Product Capabilities

- Image and text Seed creation and Relay browsing.
- Real AI generation through a server-side provider when configured; no fake generated-image fallback.
- A controllable remix brief that separates user-declared must-preserve elements from the requested change, then generates three deliberately different candidate directions. These semantic constraints are sent to the model and are not represented as Circuit-enforced guarantees.
- TapeOut Circuit evaluation through X Layer RPC in the generation/publication flow.
- Relay lineage, attribution, license, content hashes, and invitation state in the application data store.
- Optional wallet-submitted RelayRegistry transaction when the registry is configured; on-chain submission is not implied when no transaction hash exists.
- AI assistance for refining a creative direction.

## TapeOut and X Layer Fit

The current TapeOut Circuit is RelayRule v1, Circuit #5 on the configured TapeOut Processor. It evaluates declared lineage, content type, allowed rule, attribution, license, and split-limit conditions, and returns a recipe code that informs the AI creation flow. The Circuit does not judge artistic quality or AI safety. X Layer RPC is used for Circuit calls; RelayRegistry writes require a configured registry and a user-approved wallet transaction.

## Revenue Hypothesis

Potential models are paid AI credits, creator subscriptions, paid Seeds or style templates, and transparent creator revenue sharing. These are hypotheses, not evidence of paying customers or validated willingness to pay. The product must not claim revenue until checkout and settlement work end to end.

## Constraints and Truth

- AI generation requires a working server-side provider configuration.
- A user must approve a wallet transaction before a RelayRegistry write; local database persistence alone is not an on-chain record.
- Paid checkout, TapeSend delivery, and DeWEB publishing are not claimed unless their production flows are independently verified.
- No commercial validation, security audit, or active public website is claimed without current evidence.

## Product Principles

1. Make the first Relay easy to join without requiring prior blockchain knowledge.
2. Preserve creative authorship while allowing controlled remixing.
3. Make every published version a possible next starting point.
4. Use TapeOut and X Layer only where they change product behavior or provide verifiable lineage.
5. Show only capabilities and evidence that actually work.
