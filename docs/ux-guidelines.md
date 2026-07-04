# UX Guidelines

## Ten-Second Rule

Every daily operation should be possible in under 10 to 15 seconds. Income entry is the strictest flow and should target under 10 seconds.

## One-Hand Usage

- Primary actions should sit near the bottom when possible.
- Bottom sheets should keep key choices within thumb reach.
- Lists should prioritize recent and active items.

## Forms

- Ask only for required information.
- Default dates to today.
- Default currency to salon currency.
- Use numeric keyboards for money.
- Validate before save and show plain messages.

## Selection

- Use chips or cards for small lists.
- Use searchable bottom sheets for longer lists.
- Show active items first.
- Make selected state obvious.

## Delete Confirmation

Use a consistent bottom sheet:

- Title using translation key such as `t("confirmDelete.title")`
- Plain consequence text
- Destructive button
- Cancel button

Prefer inactive status over delete for services and employees.

## Success Feedback

- Save should feel instant after local SQLite write.
- Use subtle toast or inline confirmation.
- Do not wait for cloud sync before confirming save.

## Loading

- Use skeletons for dashboard, lists, and reports.
- Avoid blocking loaders for local reads.
- Restore can use a progress state because it is an explicit operation.

## Empty States

Each empty state should answer:

- What is missing?
- Why does it matter?
- What is the next action?

Examples should use translation keys in implementation, such as `t("services.emptyTitle")`.

## Error Handling

- Local validation errors are shown immediately.
- Sync errors are non-blocking unless restore or backup explicitly fails.
- Use plain user language, not technical error names.

## Reports UX

- Use simple presets: today, yesterday, this month, last month.
- Avoid complex tables in MVP.
- Prefer summary cards and short lists.

## Offline UX

- Offline should not look broken.
- Show pending backup status in settings or a small sync indicator.
- Let users continue all daily work.
