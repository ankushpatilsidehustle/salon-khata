# 15 · UX Principles

The 20 rules every screen and every developer must follow. If a design breaks any of them, the design changes — not the rule.

---

## Principle 1 · Optimize For The Repeat User, Not The First-Time User

The owner opens Salon Khata 10–40 times a day. First-time delight matters less than tenth-time speed.

- No feature tours.
- No spotlight tooltips.
- No first-time celebrations.
- Empty states carry all first-use guidance.

## Principle 2 · One Primary Action Per Screen

Exactly one visually dominant CTA per screen. Never two primary buttons side by side. Secondary actions use secondary or ghost buttons.

## Principle 3 · Never Ask What You Can Infer

- Date defaults to today.
- Currency defaults to salon default.
- Payment mode defaults to the last used.
- Category defaults to the most recent for the current day.
- Amount and commission on income are **computed**, never asked.
- If the app can guess correctly 90% of the time, guess.

## Principle 4 · Selection Beats Typing

Chips > dropdowns > text inputs. If the value comes from a known list, never make the user type.

## Principle 5 · Confirm Only When The Action Is Destructive And Irreversible

- Never `Are you sure?` on save.
- Never confirm a language change.
- Never confirm a filter apply.
- Confirm only:
  - Deletion of entities with historical records.
  - Restore from cloud.
  - Sign out.
  - Delete all data.

## Principle 6 · Prefer Undo Over Confirm

For any reversible destruction, use the snackbar-undo pattern (8 s). Confirmation dialogs interrupt flow.

## Principle 7 · Prefer Bottom Sheets Over New Screens

For any single-decision surface (select, filter, quick edit), use a bottom sheet. Sheets are faster to open, easier to dismiss, and preserve context.

Full screens are reserved for long forms and drill-down views.

## Principle 8 · Every Write Commits Locally Before Confirming

Snackbar `Saved` appears only after the SQLite write succeeds. Never optimistic-UI a failure.

## Principle 9 · Every Action Gives Immediate Feedback

Pressed state ≤ 50 ms. Screen transition ≤ 100 ms. Snackbar ≤ 300 ms. Nothing feels stuck.

## Principle 10 · Remember The User's Choices

- Payment mode: last used.
- Category: most recent.
- Language: sticky across sessions.
- Filter selection: persists within a session, not across launches.
- Search state: persists within a session, not across launches.

## Principle 11 · Never Block On Network

Salon Khata is offline-first. Every core flow works with no network. No "You are offline" banners on core screens.

## Principle 12 · Every List Has An Empty State

A blank list is a bug. Every empty state has icon + title + body + primary action.

## Principle 13 · Every Error Says What Happened And What To Do Next

Errors are one sentence, in plain language, from a translation key. Never error codes. Never blame the user. Never dead-end.

## Principle 14 · Every Screen Passes The One-Hand Test

Primary CTAs live in the bottom third. Bottom nav is the top-level navigation. FAB is thumb-native.

## Principle 15 · Every String Is A Translation Key

No hard-coded English. No English fallback rendered in production. Test every screen in the longest translation.

## Principle 16 · Every Interactive Element Has A ≥ 48 dp Touch Target

Extend touch targets with padding when the visual element is smaller. Never crowd tappable elements less than 8 dp apart.

## Principle 17 · Motion Communicates, It Does Not Decorate

Every animation communicates a state change. Maximum 320 ms for state changes. Respect reduced motion.

## Principle 18 · The Dashboard Is Sacred

The Dashboard has a fixed layout: Hero card, peer cards, recent transactions, sync line. Never add banners, announcements, promos, or feature discovery to the Dashboard.

## Principle 19 · Never Introduce Cognitive Load Without Business Value

Every setting, every option, every field earns its place by making the owner's day faster or more accurate. Anything else is removed.

## Principle 20 · Consistency Beats Cleverness

The same interaction pattern works the same way everywhere. If Save is a full-width bottom button on one screen, it is a full-width bottom button on every screen.

---

## Meta-Principles (how we design)

### Meta 1 · Design For Ravi (the least confident user)

If Ravi (single-chair barber, Hindi speaker, Android budget phone, low technical confidence) cannot complete the flow, no one else's ability to complete it saves the design.

### Meta 2 · Kill Features That Don't Pass The 10-Second Test

Every core entry (income, expense) must complete in ≤ 10 seconds. If a feature makes the golden path slower, redesign or reject.

### Meta 3 · Cut Before You Add

The natural pressure is to add features, fields, and options. The correct pressure is to cut. Ask "what can we remove to make this simpler?" before "what should we add?"

### Meta 4 · Repeat Patterns Ruthlessly

New patterns cost the user cognitive load. Reuse existing components and interactions even if a new one would be slightly better.

### Meta 5 · Ship Nothing Without Localization

A screen without translations is not shippable. Not "we'll translate later" — shippable means all 7 languages.

### Meta 6 · Ship Nothing Without Accessibility

A screen that fails the accessibility checklist is not shippable. Not "we'll fix later" — shippable means passing today.

### Meta 7 · Trust The Design System

If the design system does not have a pattern, propose adding it to the system — do not build a one-off.

### Meta 8 · Trust The Data

Every data-driven decision (default payment mode, sort order, empty state) comes from what owners actually do. Do not design based on assumptions when data can inform.

---

## Anti-Principles (what we explicitly do not do)

- We do not gamify.
- We do not celebrate.
- We do not upsell inside the app.
- We do not force confirmations.
- We do not hide features behind gestures.
- We do not add features because a competitor has them.
- We do not surface engineering concerns to users (sync, cache, session, conflict, queue).
- We do not treat first-time users as more important than daily users.
- We do not add screens to increase engagement.
- We do not measure success in taps or seconds spent — we measure it in transactions saved.

---

## The One-Line Test

Every design decision passes this test:

> **Does this make Ravi's day faster, or does it make it slower?**

If slower, redesign. If unclear, redesign. If it doesn't matter, cut it.
