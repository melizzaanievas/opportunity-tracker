---
name: opportunity-tracker-design-system
description: Usage guidance for the visual system extracted from Opportunity Tracker.
---

# Opportunity Tracker Design System

This system is extracted from the existing Opportunity Tracker application. It
serves a private opportunity-tracking workspace for jobs, grants, hackathons,
and other deadline-driven opportunities.

## What's here

- Ethereal Pastel Gothic palette: deep indigo atmosphere, dusty lavender glass,
  pale lilac text, and a warm gold focus accent.
- Cormorant Garamond for editorial headings and Plus Jakarta Sans for UI,
  navigation, forms, and body copy.
- Full light and dark token modes in `tokens.json`, with light treated as a
  softer dusk interpretation and dark as the deeper midnight interpretation.
- Shared component families used by the source app: Button, Card, Badge, Input,
  Textarea, Select, Label, Checkbox, Progress, Dialog, and Toast.
- Source evidence and the staged component plan under `docs/references/`.

## Composition guidance

- Lead with atmosphere: use the indigo gradient and subtle particulate texture
  as the page field, then layer translucent surfaces above it.
- Keep glass surfaces quiet. Use blur, a thin cool-lilac border, and restrained
  shadow rather than heavy opaque panels or multiple competing effects.
- Reserve gold for focus, deadlines, primary actions, and meaningful progress.
  It should signal where attention belongs, not decorate every element.
- Use editorial serif headings to establish hierarchy, then switch to the
  functional sans face for labels, metadata, controls, and explanatory copy.
- Keep labels concise and lightly tracked; status and metadata can use uppercase
  treatment when they need to scan quickly.
- Use short lift/glow transitions for affordance and preserve a calm workspace;
  reduced-motion users receive the same hierarchy without animation.

## Voice and tone

Copy is concise, calm, and action-oriented. Prefer language that helps the user
decide what to do next ("Ready for your next move", "Needs attention this
week") over gamified or overly mystical language.

## Typography note

The source app has no dedicated monospace face. The `mono` token intentionally
uses the UI sans family so compact metadata remains consistent with the source
instead of introducing an unrelated type style.
