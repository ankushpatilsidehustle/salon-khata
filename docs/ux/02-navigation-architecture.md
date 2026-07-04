# 02 · Navigation Architecture

Navigation shape mirrors how the owner thinks about their day. Every navigation decision below is a **rule**, not a suggestion.

## Answers To Core Questions

| Question | Answer |
| --- | --- |
| How many bottom tabs? | **Exactly 4** — Dashboard, Entries, Reports, More. |
| Should Home exist? | Yes — it is the Dashboard tab, the app's default landing. |
| Should Reports be separate? | Yes — reports are a distinct mental mode from entry. |
| Should Settings be hidden? | Settings live inside the More tab. Not hidden, but not competing for prime tab space. |
| Should FAB be global? | No. FAB is **contextual per screen** with a single, obvious primary action. |

## Top-Level Structure

```
Root
 ├─ Auth Root                (unauthenticated user)
 │   ├─ Splash
 │   ├─ Language picker      (first launch only)
 │   ├─ Mobile number
 │   ├─ OTP
 │   └─ Business setup       (first launch only)
 │
 └─ Main Tabs                (authenticated user)
     ├─ Dashboard tab   (index 0, default landing)
     ├─ Entries tab     (index 1)
     ├─ Reports tab     (index 2)
     └─ More tab        (index 3)
```

Tabs cannot be reordered by the user. Order is fixed by frequency of use.

## Bottom Tab Contents

### Dashboard tab

- Single stack, single screen (Dashboard).
- FAB: `+ Add income` (Extended).
- Secondary CTA on the screen: `Add expense` (ghost button).

### Entries tab

- Stack root: **Entries hub** — a short list of entities (Employees, Services, Commission, Expenses).
- Each row navigates to its list screen (see [03-screen-inventory.md](03-screen-inventory.md)).
- FAB only present on child screens (per screen: `+ Add employee` etc.).

### Reports tab

- Stack root: **Reports** screen with segmented control (Daily / Monthly) and drill-down cards (per employee, per service).
- No FAB.

### More tab

- Stack root: **More hub** with sections (Settings, Backup & Restore, Language, About, Sign out).
- Each row is a List Item with chevron → detail screen.
- No FAB.

## Navigation Hierarchy

Maximum depth: **3 levels** from a tab root.

```
Tab → Screen → Detail sheet (or edit screen)
```

Examples:

- Dashboard → (no deeper — modals/sheets only)
- Entries → Employees list → Employee edit screen
- Reports → Monthly report → Per-employee detail
- More → Settings → Language

Anything requiring 4+ levels indicates a design flaw — refactor into siblings or a bottom sheet.

## Modal Navigation

Modals appear **above** the current stack, not as their own root.

Types:

| Type | Purpose | Component |
| --- | --- | --- |
| Bottom sheet | Selection, quick edit, filter | Bottom Sheet |
| Dialog | Confirmation, destructive, blocking decision | Dialog |
| Full-screen modal | Multi-step or long form (e.g., Income Entry) | Full screen with close (`x`) |

Rules:

- Modals inherit the current tab context.
- Modals never launch other modals except a single Dialog (e.g., discard-changes) that closes the modal.
- Bottom sheets never nest.

## Bottom Sheet Navigation

Bottom sheets are **one-decision surfaces**. If more than one decision is required, escalate to a full-screen modal.

Rules:

- Sheet header always shows the title.
- Sheet dismisses on swipe-down, scrim tap, or hardware back.
- Sheet's primary action is fixed at the bottom.
- A sheet may **push another sheet** only in the inline-create pattern (e.g., open `Select service` sheet → inside it, `Add new service` sub-sheet). Even here, the second sheet must be a modal that fully replaces the first, not a stack of two visible sheets.

## Back Behavior

| Situation | Back behavior |
| --- | --- |
| Top of stack, tab history exists | Return to previous tab |
| Top of stack, no history | Confirm exit on Android hardware back |
| Nested screen | Pop the stack |
| Bottom sheet open | Dismiss the sheet |
| Dialog open | Dismiss the dialog |
| Unsaved form | Show discard-changes dialog |
| Keyboard visible | Dismiss the keyboard first, then re-interpret back |

Rules:

- Back **never** skips over a meaningful screen.
- Back **never** loses user input silently.
- Back on the Dashboard requires two presses to exit (Android convention: first press shows toast "Press back again to exit").

## Deep Navigation

- Maximum depth from any tab root: 3 levels.
- Any screen at depth ≥ 2 must have a clear breadcrumb via app-bar title.
- Users must be able to return to the tab root in ≤ 3 back presses.

## Deep Links

Deep links land on the correct tab and do not require re-auth if the session is valid.

| Link | Destination |
| --- | --- |
| `salonkhata://income/new` | Dashboard tab → Income Entry |
| `salonkhata://expense/new` | Dashboard tab → Expense Entry sheet |
| `salonkhata://reports/monthly` | Reports tab → Monthly |
| `salonkhata://settings` | More tab → Settings |

Fallback: Dashboard if the deep link is invalid.

## Tab Switching Behavior

- Tab switch preserves each stack's state (scroll position, filter selections).
- Tab switch **resets** ephemeral state (open sheets, in-progress dialogs).
- Re-tapping the current tab **scrolls to top**; re-tapping again **pops to stack root**.
- Tab labels are always visible; icons switch outline ↔ filled based on active state.

## Auth ↔ Main Boundary

- Auth Root is a hard boundary. Sign-in navigates to Main Tabs; sign-out navigates to Auth Root.
- Deep links from a signed-out state route to Mobile Number screen, remembering the intended destination for after successful auth.
- Session persistence: local session token stored securely; auto-refresh on app launch.

## FAB Rules

- FAB is **per screen**, never global.
- Maximum one FAB per screen.
- FAB action must be the **most common creation action** on that screen.
- Extended FAB (icon + label) used only on Dashboard for the golden path (`+ Add income`).

| Screen | FAB |
| --- | --- |
| Dashboard | `+ Add income` (Extended) |
| Employees list | `+` (Regular) |
| Services list | `+` (Regular) |
| Expenses list | `+` (Regular) |
| Commission list | `+` (Regular, opens select-employee sheet) |
| Reports (any) | None |
| Settings (any) | None |
| Modals / sheets | None |
| Auth screens | None |

## Screen Type Rules

| Type | Uses |
| --- | --- |
| Screen with app bar + bottom nav | Tab roots and their child list screens |
| Screen with app bar, no bottom nav | Full-screen modals (Income Entry, Add Employee — when the form is long) |
| Bottom sheet | Selection, single-decision confirmation |
| Dialog | Irreversible confirmation |

## Anti-Patterns (forbidden)

- Hamburger menus (hidden = discovered rarely).
- Slide-out drawers.
- Nested tabs.
- Bottom navigation with 3 or 5+ tabs.
- Popup menus (Android overflow `⋮` menus).
- Tabs on report sub-screens.
- Modal within modal within modal.
- Back that requires ≥ 4 presses to reach a tab root.
- Deep links that require re-login for a public-safe action.

## Do's

- Keep tab count and order stable across releases.
- Preserve stack state per tab.
- Provide a visible close (`x`) on every full-screen modal.
- Bring primary CTAs within thumb reach.
- Make back predictable.

## Don'ts

- Don't move the FAB across sessions.
- Don't rename bottom tabs between releases.
- Don't rely on gestures (long press, swipe) for critical actions.
- Don't stack visible sheets.
