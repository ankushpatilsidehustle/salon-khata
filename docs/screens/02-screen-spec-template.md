# 02 · Screen Spec Template

Every screen in this folder is documented using the fields below, in this exact order. If a field does not apply, mark it `N/A` with a one-line reason. Never omit a field.

This template is the contract. Feature files ([03](03-auth-onboarding.md)–[13](13-global-overlays.md)) must not invent new sections or drop sections.

---

## The Template

Copy the block below into a feature file for every screen. Populate every field.

```markdown
### <ID> · <Screen Name>

- **Surface type**: Screen | Full-screen Modal | Bottom Sheet | Dialog | Overlay | State
- **Template**: <one of the 8 templates from design-system/17-screen-templates.md>
- **Route / trigger**: <route path, tab index, or the event that opens this surface>
- **Purpose**: <one sentence, user-facing>
- **Business goal**: <the persona job this serves + the product principle it protects>

**Primary CTA**

- **Label**: `<verb from translation keys>`
- **Destination**: <next screen / sheet / state, or in-place effect>

**Secondary CTA**

- **Label**: `<verb or navigational action>`
- **Destination**: <where it goes, or in-place effect, or `N/A`>

**Entry points**

- <every way to reach this screen: from-screen + action, tab tap, deep link, redirect>

**Exit points**

- <every way to leave this screen: success, cancel, hardware back, close, error escalation>

**Design System components**

- <bulleted list of components used, each linked to design-system/08-component-library.md>

**Content data**

- **Inputs / fields**: <if a form>
- **Read models**: <SQLite tables/repositories consumed, linked to database-schema.md or repositories>
- **Validation**: <link to specific rule sections in ux/06-form-ux.md and ux/10-error-ux.md>
- **Computed values**: <e.g., commission auto-calc>

**States**

- **Loading**: <trigger, component shown, reference>
- **Empty**: <trigger, component shown, copy reference in ux/09-empty-states.md>
- **Offline**: <what changes visually — usually nothing per ux/12-offline-ux.md>
- **Success**: <snackbar copy + action, reference in ux/11-success-ux.md>
- **Error**: <error tier + presentation, reference in ux/10-error-ux.md>

**Motion**

- **Enter**: <transition + duration, reference in ux/13-motion-flow.md>
- **Exit**: <transition + duration>
- **In-screen**: <notable in-screen motion or `Standard per DS`>

**Accessibility**

- **Focus order**: <first focus + tab order>
- **Screen reader labels**: <notes on non-obvious labels; default is "every interactive has a t(...) label">
- **Thumb reach**: <primary CTA position and reachability>
- **Large text**: <what must not truncate>
- **Reference**: [../ux/14-accessibility-flow.md](../ux/14-accessibility-flow.md), [../design-system/15-accessibility.md](../design-system/15-accessibility.md)

**Dependencies**

- **Screens / data / services required first**: <list>
- **Data written**: <table + operation>

**Priority**

- **MVP wave**: `P0` (golden path) | `P1` (core support) | `P2` (nice-to-have) | `Post-MVP`
- **Rationale**: <one line>
```

---

## Field Definitions

### Surface type

Use the glossary in [README.md](README.md#glossary). Screens with multiple visible variants (populated / empty / loading) do **not** get separate specs — states are captured under `States` below.

### Template

One of the eight templates from [../design-system/17-screen-templates.md](../design-system/17-screen-templates.md). If a screen does not fit any template, the template is wrong or the screen is wrong — resolve before shipping.

### Route / trigger

For a stack screen, the deep-link or stack route (`salonkhata://reports/monthly`, `Dashboard → FAB`). For a sheet, the tap or gesture that opens it. For a state, the condition that triggers it.

### Purpose

One user-facing sentence. Written in second person if the user were asking "what does this do for me?". Never restate the screen name.

### Business goal

Ties the screen to a persona job (from [../personas.md](../personas.md)) and to a product principle (from [../product-principles.md](../product-principles.md)). Format: `<Persona job> · Protects <principle>.`

Example: `Owner-Operator records a customer in under 10 seconds · Protects Speed Over Complexity.`

### Primary CTA

Exactly one per screen (per [../design-system/08-component-library.md#button](../design-system/08-component-library.md#button)). The label must be a verb. The destination must be listed in Exit points.

### Secondary CTA

Zero or one. Often a `Cancel`, `Skip`, `Add another`, or navigational chevron. Never a second primary.

### Entry points

Every way the screen can be reached. Deep links (per [../ux/02-navigation-architecture.md#deep-links](../ux/02-navigation-architecture.md#deep-links)), tab taps, redirects from auth boundary, snackbar `Undo`, `Add another`, list row tap.

### Exit points

Every way the screen can be left. Must be a superset of `Primary CTA destination + Secondary CTA destination + hardware back + close (x) + error escalation`. If back needs guarding (unsaved changes), reference [../ux/06-form-ux.md#discard-changes-guard](../ux/06-form-ux.md#discard-changes-guard).

### Design System components

Bullet every component this screen composes. Link each to its section in [../design-system/08-component-library.md](../design-system/08-component-library.md). If a screen needs a component that does not exist, the DS is incomplete — file an issue against the DS, not this screen.

### Content data

- **Inputs / fields**: for forms only. Include field type (name, mobile, money, category).
- **Read models**: which repositories / tables feed the screen. Link to [../database-schema.md](../database-schema.md) and to files under [../../src/repositories/](../../src/repositories/) when they exist.
- **Validation**: link to the exact validation rules in [../ux/06-form-ux.md#validation](../ux/06-form-ux.md#validation) and error copy in [../ux/10-error-ux.md#validation-errors-form-level](../ux/10-error-ux.md#validation-errors-form-level).
- **Computed values**: e.g., income entry auto-computes amount and commission per [../business-workflows.md#income-entry](../business-workflows.md#income-entry).

### States

Every screen documents all five. Where the pattern is universal, reference the canonical location rather than re-writing copy:

| State | Canonical location |
| --- | --- |
| Loading | [../ux/09-empty-states.md](../ux/09-empty-states.md) (skeleton rules) + [../design-system/08-component-library.md#loading-skeleton](../design-system/08-component-library.md#loading-skeleton) |
| Empty | [../ux/09-empty-states.md](../ux/09-empty-states.md) — includes exact copy per module |
| Offline | [../ux/12-offline-ux.md](../ux/12-offline-ux.md) — usually "identical to online" |
| Success | [../ux/11-success-ux.md#success-feedback-matrix](../ux/11-success-ux.md#success-feedback-matrix) |
| Error | [../ux/10-error-ux.md#error-tiering](../ux/10-error-ux.md#error-tiering) |

If a state is genuinely `N/A` (e.g., no empty state for a dialog), write `N/A — <reason>`.

### Motion

Reference [../ux/13-motion-flow.md](../ux/13-motion-flow.md) and [../design-system/09-motion-system.md](../design-system/09-motion-system.md). Most screens use the standard push / pop / sheet-open transitions and require no extra spec; note only deviations.

### Accessibility

Per [../ux/14-accessibility-flow.md](../ux/14-accessibility-flow.md) and [../design-system/15-accessibility.md](../design-system/15-accessibility.md). Note the first focus target, thumb-reach position of the primary CTA, and any value that must not truncate under large text.

### Dependencies

- **Screens / data / services required first**: e.g., "Auth complete; at least one Employee; at least one Service."
- **Data written**: e.g., "`transactions` insert; `sync_outbox` enqueue."

Cross-reference [15-dependency-matrix.md](15-dependency-matrix.md).

### Priority

MVP waves used in [14-implementation-order.md](14-implementation-order.md):

| Wave | Meaning |
| --- | --- |
| **P0** | Blocks the golden path (record income offline in 10 s) |
| **P1** | Core support required for a usable MVP (expenses, daily reports, settings basics) |
| **P2** | Nice-to-have completeness (search, monthly reports, backup/restore surfaces) |
| **Post-MVP** | Listed but not spec'd; belongs on the roadmap |

## Rules

1. **Every field is required.** Absent fields are treated as unresolved design questions and block implementation.
2. **Every reference is a link.** Do not paraphrase source docs. Link to the source and stop.
3. **Every CTA has a destination.** If a Primary CTA has no destination, the screen has no purpose.
4. **Every entry has a matching exit.** Users must always be able to leave. Verify against [../ux/02-navigation-architecture.md#back-behavior](../ux/02-navigation-architecture.md#back-behavior).
5. **State copy lives in UX docs.** This folder points to it; it never restates it.
6. **Priority is honest.** Do not label everything `P0`. If it can be cut for MVP without breaking the golden path, it is not `P0`.
