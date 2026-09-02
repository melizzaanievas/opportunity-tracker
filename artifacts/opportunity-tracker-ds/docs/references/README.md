# Opportunity Tracker source references

This catalog records the workspace source used to extract the design system.
The source is the existing `artifacts/opportunity-tracker` application in this
workspace, inspected on September 2, 2026. It is an `app-ui` source rather than
a separate brand asset or external site.

The source has no standalone logo asset. Its product mark is rendered as a
small inline lightning icon in the application header, so no logo file is
retained or invented here.

| Reference | Subject | Kind | Source | Extracted |
| --- | --- | --- | --- | --- |
| `../source-theme.md` | dashboard, login, add opportunity, opportunity detail | `app-ui` | workspace artifact `artifacts/opportunity-tracker` | palette, typography, surfaces, states, motion, composition |
| `../components/button.md` | primary and secondary actions | `app-ui` | `src/components/ui/button.tsx`, dashboard, add, detail | variants, sizes, focus and disabled behavior |
| `../components/card.md` | grouped workspace panels | `app-ui` | `src/components/ui/card.tsx`, dashboard, login, add, detail | surface anatomy and grouping |
| `../components/badge.md` | status and category labels | `app-ui` | `src/components/ui/badge.tsx`, dashboard, detail | compact status treatment |
| `../components/input.md` | single-line form fields | `app-ui` | `src/components/ui/input.tsx`, login, add, detail | field height, border, focus |
| `../components/textarea.md` | summaries and notes | `app-ui` | `src/components/ui/textarea.tsx`, add, detail | multiline field treatment |
| `../components/select.md` | opportunity type and status | `app-ui` | `src/components/ui/select.tsx`, add, detail | selection behavior and popover |
| `../components/label.md` | form labels | `app-ui` | `src/components/ui/label.tsx`, login, add | label hierarchy |
| `../components/checkbox.md` | task checklist | `app-ui` | `src/components/ui/checkbox.tsx`, opportunity detail | completion behavior |
| `../components/progress.md` | checklist completion | `app-ui` | `src/components/ui/progress.tsx`, opportunity detail | progress indicator |
| `../components/dialog.md` | edit opportunity modal | `app-ui` | `src/components/ui/dialog.tsx`, opportunity detail | modal anatomy and focus |
| `../components/toast.md` | transient feedback | `app-ui` | `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx`, app pages | feedback behavior |
