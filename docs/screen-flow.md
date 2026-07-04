# Screen Flow

## First Launch

```text
Splash
Mobile Number
OTP Verification
Business Setup
Optional Quick Setup
Dashboard
```

## Returning User

```text
Splash
Local Session Check
Dashboard
Background Sync
```

## Income Entry Flow

Goal: under 10 seconds.

```text
Dashboard or Entries
Add Income
Select Employee
Select Services
Review Auto Amount and Commission
Select Payment Mode
Save
Success Feedback
```

Optimizations:

- Remember last selected employee when appropriate.
- Show recent services first.
- Allow multi-select service chips.
- Default payment mode to last used mode.
- Keep save button fixed near bottom.

## Expense Entry Flow

```text
Dashboard or Entries
Add Expense
Select Category
Enter Amount
Optional Remarks
Confirm Date
Save
```

## Service Management Flow

```text
Entries
Services
Add or Select Service
Edit Name, Price, Active State
Save
```

Delete opens a confirmation bottom sheet and performs soft delete.

## Employee Management Flow

```text
Entries
Employees
Add or Select Employee
Edit Name and Active State
Save
```

## Commission Rule Flow

```text
Entries
Commission Rules
Select Employee
Select Service
Choose Percentage or Fixed
Enter Value
Save
```

## Reports Flow

```text
Reports
Choose Report Type
Select Date Filter
View Summary
```

Reports must read from local SQLite and work offline.

## Settings Flow

```text
More
Settings
Business Profile / Language / Currency / Backup / Restore
```

Restore requires confirmation before replacing or merging local data.

## Navigation Guardrails

- Do not create separate tabs for future modules.
- Do not expose customer, appointment, inventory, salary, attendance, or GST flows in MVP.
- Keep primary actions one tap away from Dashboard.
