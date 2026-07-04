# Business Workflows

## Authentication

1. User enters mobile number.
2. Firebase sends OTP.
3. User verifies OTP.
4. App creates or loads one salon account for that mobile number.
5. App restores cloud data when local data is empty or user requests restore.

One mobile number maps to one salon in MVP. There is one owner user. Employee login is a future capability and must not be implemented in MVP.

## First Run Setup

Required:

- Business name
- Owner name
- Currency, default `INR`
- Language, default `en`

Optional but recommended:

- Add first employee
- Add common services

The app should allow skipping optional setup so users can reach the dashboard quickly.

## Dashboard

The dashboard answers: How is today going?

Show:

- Today's income
- Today's expenses
- Net collection
- Employee commission summary
- Recent transactions

Rules:

- Values are computed from local SQLite.
- Soft-deleted records are excluded.
- Unsynced records are included because local data is the current truth.
- Recent transactions include income and expense entries.

## Services

Supported operations:

- Add service
- Edit service
- Soft delete service
- Set price
- Set active or inactive

Rules:

- Inactive services do not appear in default income entry lists.
- Existing transactions keep their saved service names and amounts.
- Service deletion is soft delete only.
- Service names should be unique among non-deleted services for one salon.

## Employees

Supported operations:

- Add employee
- Edit employee
- Set active or inactive

Rules:

- Inactive employees do not appear in default income entry lists.
- Existing transactions keep employee references for reporting.
- Employee deletion should be modeled as inactive or soft delete, not permanent removal.

## Employee Commission

Commission is configured per employee and service.

Supported rule types:

- Percentage
- Fixed amount

Rules:

- A commission rule belongs to one employee and one service.
- Percentage commission is calculated from the service amount used in the transaction.
- Fixed commission is a fixed value per selected service occurrence.
- If no rule exists, commission defaults to zero.
- Transaction records store calculated commission snapshots to protect old reports from later rule changes.

## Income Entry

The income entry screen is the most important MVP workflow.

Target: under 10 seconds.

Flow:

1. Select employee.
2. Select one or more services.
3. App calculates amount automatically.
4. App calculates commission automatically.
5. Select payment mode.
6. Save.

Payment modes for MVP:

- Cash
- UPI
- Card
- Other

Rules:

- Employee and service selection should use large cards or chips.
- Recently used employees and services should appear first.
- Amount can be adjusted only when necessary.
- Commission updates immediately when employee or services change.
- Save writes to SQLite first and adds a sync queue item.
- Save success should be immediate, even offline.
- Saved transaction items store service name, price, commission rule, and calculated commission snapshots.

## Expense Entry

Fields:

- Category
- Amount
- Remarks
- Date

Recommended MVP categories:

- Rent
- Salary Advance
- Products
- Utilities
- Maintenance
- Other

Rules:

- Category uses a selectable list.
- Date defaults to today.
- Remarks are optional.
- Save writes to SQLite first and adds a sync queue item.

## Reports

Reports are local-first and available offline.

MVP reports:

- Daily summary
- Monthly summary
- Employee commission
- Service summary

Rules:

- Reports exclude soft-deleted records.
- Reports include unsynced local records.
- Date filters should be simple presets first.
- Export is not part of MVP unless explicitly added later.

## Settings

Fields:

- Business name
- Owner name
- Language
- Currency
- Backup
- Restore

Rules:

- Language changes should update UI strings without data migration.
- Backup triggers sync of pending local changes.
- Restore pulls cloud data into local SQLite after user confirmation.
- Restore must not duplicate records because IDs are stable UUIDs.

## Delete And Undo

- Deletes are soft deletes.
- Confirm destructive actions with a bottom sheet.
- For common records, prefer active/inactive before delete.
- If undo is implemented, it clears `deleted_at` and queues an update.
