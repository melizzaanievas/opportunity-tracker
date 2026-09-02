# Opportunity Tracker component inventory

This is a source-backed inventory of the reusable component families actively
used by the Opportunity Tracker product. Variants and related exports are
grouped under their family rather than treated as separate components.

| Family | Reference | Dependencies / blockers | Usage evidence | Chunk | Status |
| --- | --- | --- | --- | --- | --- |
| Button | `components/button.md` | Radix Slot, CVA, `cn` | login, add, detail actions | 1 | implemented |
| Card | `components/card.md` | `cn` | dashboard, login, add, detail panels | 1 | implemented |
| Badge | `components/badge.md` | CVA, `cn` | dashboard metrics, detail status | 1 | implemented |
| Input | `components/input.md` | `cn` | login, add, detail fields | 1 | implemented |
| Textarea | `components/textarea.md` | `cn` | add and detail summaries | 1 | implemented |
| Select | `components/select.md` | Radix Select, Lucide icons, `cn` | add and detail type/status | 2 | pending |
| Label | `components/label.md` | Radix Label, `cn` | login and add forms | 2 | pending |
| Checkbox | `components/checkbox.md` | Radix Checkbox, Lucide icon, `cn` | detail task checklist | 2 | pending |
| Progress | `components/progress.md` | Radix Progress, `cn` | detail checklist completion | 2 | pending |
| Dialog | `components/dialog.md` | Radix Dialog, Lucide icon, `cn` | detail edit modal | 2 | pending |
| Toast | `components/toast.md` | Radix Toast, shared toast hook | login, dashboard, add, detail feedback | 2 | pending |

## Chunk plan

- **Chunk 1 — pilot:** Button, Card, Badge, Input, Textarea. These five
  families establish the source's primary action, surface, status, and form
  language and are implemented in the initial preview.
- **Chunk 2 — form and feedback completion:** Select, Label, Checkbox, Progress,
  Dialog, and Toast. Each depends only on the existing shared utility and
  public Radix primitives, so no family is blocked by a later chunk.

The source app also contains scaffold-only UI modules that are not imported by
its product routes. They are not counted as product families in this inventory;
the package preview keeps its generated scaffold available while the extracted
inventory is completed.
