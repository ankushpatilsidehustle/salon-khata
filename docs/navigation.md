# Navigation

Navigation should optimize the owner's daily actions, not mirror the database structure.

## Recommended Structure

Use bottom tabs for the core app:

- Dashboard
- Entries
- Reports
- More

## Dashboard Tab

Screens:

- Dashboard
- Recent transaction detail bottom sheet

Primary actions:

- Add income
- Add expense

## Entries Tab

Screens:

- Income entry
- Expense entry
- Services list
- Employees list
- Commission rules

Use sections or segmented controls to keep this tab understandable.

## Reports Tab

Screens:

- Daily summary
- Monthly summary
- Employee commission
- Service summary

Filters should open in bottom sheets.

## More Tab

Screens:

- Settings
- Backup and restore
- Language
- Business profile

## Modal And Bottom Sheet Patterns

Use bottom sheets for:

- Employee selection
- Service selection
- Payment mode selection
- Expense category selection
- Delete confirmation
- Report filters

Use full screens for:

- Income entry
- Expense entry
- Service edit when form grows
- Employee edit when form grows
- Settings

## Back Behavior

- Unsaved forms require discard confirmation.
- Bottom sheet back closes the sheet first.
- Save returns user to previous context when appropriate.

## Offline And Sync Status

Global sync status should be subtle. Do not use blocking banners for normal offline state. Offline is expected behavior.
