# 01 · Design Philosophy

## Core Philosophy

Salon Khata is a **digital notebook for daily salon work**. It replaces the paper register, not the accountant. Every design decision must protect three things:

1. **Speed** — daily entry finishes in under 10 seconds.
2. **Trust** — numbers look correct even before the user reads them.
3. **Calm** — the screen never shouts.

If a design choice threatens any of these three, it is wrong for this product.

## Design Values

| Value | What it means | What it rules out |
| --- | --- | --- |
| Simple over feature-rich | Ship the smallest useful surface | Menus, tabs, and toggles the user did not ask for |
| Consistency over creativity | Every screen uses the same parts | One-off components, custom pickers |
| System over decoration | Structure carries meaning | Color and shadow used as flair |
| Speed over cleverness | 3 taps beats 1 tap that requires thought | Hidden gestures, unlabeled affordances |
| Legibility over density | Numbers must read from arm's length | Small type to fit more data |
| Predictable over surprising | Same action = same result everywhere | Contextual behavior that changes silently |
| Human over technical | Language the salon owner uses | Terms like "SKU", "posting", "ledger" |

## Product Personality

Salon Khata is:

- **Calm** — soft neutrals, generous whitespace, no visual noise.
- **Confident** — decisive typography, one primary action per screen.
- **Warm** — humanist type, subtle warm neutrals, never sterile.
- **Modern** — flat surfaces, restrained shadows, current motion.
- **Trustworthy** — money is displayed large, clear, and consistent.

Salon Khata is **not**:

- Playful, cartoon-y, or emoji-heavy
- Corporate blue-and-white software
- Dashboard-dense like an ERP
- Ornamental like a lifestyle app

## Visual Identity

- **Primary color**: a deep ink green. Green signals money-adjacent trust without being blue-corporate or red-alarming.
- **Accent color**: warm gold, used sparingly for premium highlights and selected states.
- **Surfaces**: near-white with a warm undertone, not clinical cool white.
- **Type**: humanist sans-serif with strong Indian-language coverage.
- **Motion**: short, ease-out, purposeful. Motion clarifies, never decorates.
- **Iconography**: outline set with 1.5px stroke, filled variant for selected states only.
- **Shape**: 12–16px corner radius. Rounded but not playful.

## UX Principles

### 1. Ten-Second Rule

Every daily action (add income, add expense) must be doable in under 10 seconds by a distracted owner. If a screen fails this, cut steps before adding polish.

### 2. Thumb-First

Primary actions live in the bottom third of the screen. The top of the screen is for orientation, not action.

### 3. Selection Beats Typing

Whenever a choice can be a chip, card, or bottom sheet, it is not a text field.

### 4. Local Truth

The screen shows what SQLite says right now. Sync state is a subtle badge, never a blocking modal.

### 5. One Primary Action

Each screen has exactly one primary button. Secondary actions are secondary in weight, position, and color.

### 6. Recover, Never Punish

Destructive actions require confirmation. Mistakes are reversible via soft delete and undo where possible.

### 7. Consistency Is A Feature

If two screens do the same thing two different ways, one of them is a bug. File it against the design system.

### 8. Silence Is Feedback

Save is instant. A quiet toast is better than a celebratory modal. The absence of an error is confirmation.

## Anti-Patterns

- Splash screens that show branding instead of loading data
- Onboarding tours that block first use
- Modals that ask what the app should already know
- Colored badges used as decoration rather than status
- Icons without labels for actions the user does rarely
- Empty states that only say "No data"
- Loading spinners for local reads

## The One-Question Test

Before shipping any screen, answer:

> Can a distracted owner, holding a customer's card in one hand, complete the primary task on this screen in under 10 seconds without asking anyone?

If the answer is not a confident yes, the screen is not ready.
