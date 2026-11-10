---
name: AI Remix Relay
description: 丝网印刷校样台式的多人 AI 接力创作界面，让每一版作品都成为下一棒。
colors:
  warm-paper: "#f2eadb"
  fresh-proof: "#fbf7ef"
  dense-ink: "#121212"
  soft-ink: "#4e4a43"
  relay-blue: "#173be8"
  registration-red: "#ff482e"
  proofing-acid: "#d9ff2f"
  rule-line: "#cfc5b5"
  verified-green: "#16734c"
  pending-amber: "#a85f00"
typography:
  display:
    fontFamily: "DM Sans, Noto Sans SC, sans-serif"
    fontSize: "clamp(44px, 5vw, 78px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "DM Sans, Noto Sans SC, sans-serif"
    fontSize: "clamp(38px, 5vw, 72px)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  title:
    fontFamily: "DM Sans, Noto Sans SC, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  body:
    fontFamily: "DM Sans, Noto Sans SC, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, Noto Sans SC, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  artwork: "7px"
  control: "9px"
  action: "10px"
  card: "12px"
  surface: "14px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "7px"
  sm: "10px"
  md: "12px"
  lg: "18px"
  xl: "28px"
  2xl: "42px"
  section: "86px"
components:
  button-primary:
    backgroundColor: "{colors.relay-blue}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  button-dark:
    backgroundColor: "{colors.dense-ink}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  button-acid:
    backgroundColor: "{colors.proofing-acid}"
    textColor: "{colors.dense-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.dense-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  chip-rule:
    backgroundColor: "transparent"
    textColor: "{colors.dense-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 10px"
  chip-rule-selected:
    backgroundColor: "{colors.dense-ink}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 10px"
  input-proof:
    backgroundColor: "#fffdf8"
    textColor: "{colors.dense-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "13px"
  card-proof:
    backgroundColor: "{colors.fresh-proof}"
    textColor: "{colors.dense-ink}"
    rounded: "{rounded.surface}"
    padding: "28px"
  candidate-card:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.dense-ink}"
    rounded: "{rounded.card}"
    padding: "6px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.soft-ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  nav-item-active:
    backgroundColor: "{colors.fresh-proof}"
    textColor: "{colors.dense-ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  lineage-node:
    backgroundColor: "{colors.fresh-proof}"
    textColor: "{colors.dense-ink}"
    rounded: "{rounded.control}"
    size: "62px × 72px"
---

# Design System: AI Remix Relay

## Overview

**Creative North Star: "Relay Proofing Table / 接力校样台"**

AI Remix Relay looks like an active screen-printing workbench: warm stock, dense ink, bright registration colors, proof sheets, and marks that show how one version leads to the next. The art leads; interface chrome behaves like practical studio equipment rather than a dashboard.

The system makes lineage tangible. Borders, rails, parent-child connectors, candidate proofs, and receipts show that an AI work is a baton to pass onward, not a terminal output. Product truth stays visible in compact status language instead of being buried behind Web3 vocabulary.

**Key Characteristics:**

- Warm paper field with near-black structural ink.
- Electric blue for the primary handoff action; red and acid yellow as registration accents.
- Oversized, tightly tracked headlines paired with compact proofing labels.
- Flat bordered surfaces, interrupted by one deliberate proof-table shadow.
- Artwork, node rails, and lineage diagrams act as navigation.

## Colors

The palette is a controlled five-ink print set supported by two paper tones and honest status colors.

### Primary

- **Electric Relay Blue** (`#173be8`): primary actions, selected candidates, active lineage nodes, and keyboard focus.

### Secondary

- **Registration Red** (`#ff482e`): creator/avatar emphasis and artwork accents; never a generic error color.

### Tertiary

- **Proofing Acid** (`#d9ff2f`): handoff surfaces and current-node emphasis on dark lineage views.

### Neutral

- **Warm Stock** (`#f2eadb`): the default page field.
- **Fresh Proof** (`#fbf7ef`): selected, raised, or working surfaces.
- **Dense Ink** (`#121212`): text, primary dark actions, structural borders, and the lineage canvas.
- **Soft Ink** (`#4e4a43`): explanatory copy and secondary navigation.
- **Rule Line** (`#cfc5b5`): dividers, card outlines, and proofing rules.

### Status

- **Verified Green** (`#16734c`): confirmed local or live state.
- **Pending Amber** (`#a85f00`): disclosed pending integration or in-progress state.

**The Registration Ink Rule.** Blue marks the action or selection; red and acid yellow add authored emphasis. Do not distribute all three accents evenly across a surface.

**The Honest Status Rule.** Green and amber describe verifiable state only; they do not decorate neutral content.

## Typography

**Display Font:** DM Sans (with Noto Sans SC and sans-serif fallbacks)  
**Body Font:** DM Sans (with Noto Sans SC and sans-serif fallbacks)

**Character:** A single bilingual sans family keeps the workbench direct and contemporary. Scale, tight tracking, weight, and casing create the contrast: poster-sized editorial statements above small technical proof labels.

### Hierarchy

- **Display** (700, `clamp(44px, 5vw, 78px)`, `0.94`): artwork titles over the hero image.
- **Headline** (700, `clamp(38px, 5vw, 72px)`, `0.96`): major section statements.
- **Title** (700, `18px`): studio, graph, evidence, and drawer headings.
- **Body** (400, `16px`, `1.55`): product explanation and working copy.
- **Label** (700, `12px`, `0.1em`): uppercase navigation aids, evidence labels, editions, and proof metadata.

**The Poster/Proof Rule.** Headlines speak in short, oversized lines; operational truth uses compact labels and tabular numerals.

## Layout

The page is framed by a sticky 72px top bar and a sticky 260px relay feed. The first viewport is a two-column stage: artwork takes `1.15fr`, while rules and the primary baton action take `0.85fr`; the lineage rail closes the panel at the bottom. Content sections use a 1480px maximum and 86px × 42px section padding.

The proofing studio is a bordered `0.75fr / 1.25fr` split, with controls on the left and three candidates on the right. At 1100px the hero, studio, and economy stack; the feed narrows to 210px. At 760px the feed becomes a horizontal strip, candidate proofs become single-column rows, section gutters drop to 20px, and publishing actions become full width.

**The Art-First Rule.** In task entry views, a current work and its lineage occupy at least as much visual authority as its controls.

## Elevation & Depth

Depth is primarily structural: paper-tone changes, ink rules, image clipping, and dark/light inversion. The proofing studio uses one broad ambient shadow (`0 22px 55px rgba(34,26,15,.14)`) to read as a physical sheet; the receipt drawer uses a directional left shadow. Hover lift is limited to actionable buttons and candidate proofs.

**The One Lift Rule.** Keep working surfaces flat by default; reserve strong elevation for the proofing table, the active drawer, or a direct hover response.

## Shapes

Corners are gently machined rather than soft: artwork windows use 5–7px rounding, controls 9–10px, cards 11–12px, and major feature surfaces 14px. Rule chips and status badges are pills (`999px`); avatars, brand marks, and icon buttons are circles. One-pixel ink or rule-line borders carry most grouping.

## Components

### Buttons

- **Shape:** sturdy rounded action (`10px`) with `11px 16px` padding and 700 weight.
- **Primary:** Electric Relay Blue with white text for “接下一棒” and publish actions.
- **Dark:** Dense Ink with white text for creation and generation actions.
- **Acid / Outline:** acid is reserved for handoff emphasis; outline actions stay transparent with a Rule Line border.
- **Hover / Focus:** rise 2px over 180ms; return to baseline on press; show a 3px blue focus outline with 3px offset.

### Chips

- **Style:** transparent pill with a Rule Line border and compact 12px label.
- **State:** selection inverts to Dense Ink with white text; `aria-pressed` mirrors the visual state.

### Cards / Containers

- **Proofing table:** Fresh Proof surface, Dense Ink perimeter, 28px inner padding, and a single vertical rule between controls and candidates.
- **Candidate proof:** Warm Stock, 12px corner, 6px frame; selection replaces the quiet border with a 3px blue registration line.
- **Lineage card:** dark charcoal surface on the Dense Ink graph, with acid border on hover/current state.

### Inputs / Fields

- **Style:** warm white field, Rule Line border, 9px corner, and 13px inset.
- **Focus:** border changes to Electric Relay Blue while the global focus outline remains visible.
- **Disabled:** use reduced opacity only where the next step is truly unavailable.

### Navigation

Top navigation is compact and quiet: Soft Ink by default, then Fresh Proof and Dense Ink on hover/active. On mobile, only the active top destination remains visible while the Relay feed becomes the secondary navigation strip.

### Lineage Rail

The 62px × 72px proof nodes connect with one-pixel ink rules. The active node uses a 2px blue registration border. Every node must remain clickable and preserve the current artwork crop.

## Do's and Don'ts

### Do

- **Do** let artwork, candidate proofs, and lineage nodes carry navigation.
- **Do** use blue consistently for the next consequential action, selection, and focus.
- **Do** expose real, local, pending, and unconnected states in plain language.
- **Do** collapse the workbench into a linear mobile flow without hiding the creative loop.

### Don't

- **Don't** turn the home surface into a KPI dashboard, admin table, or wallet-first portal.
- **Don't** use every accent color on every component; registration inks need rarity.
- **Don't** add generic glassmorphism, gradient washes, or ornamental shadows.
- **Don't** claim AI, Circuit, contract, payment, or publishing integrations without verifiable evidence.
