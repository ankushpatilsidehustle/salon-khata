# Component Library

Screens should be composed from reusable components. Components own states, spacing, accessibility, and translation behavior.

## Core Components

### Button

Variants:

- Primary
- Secondary
- Ghost
- Destructive

States:

- Default
- Pressed
- Loading
- Disabled

Rules:

- Minimum height 52 dp for primary actions.
- Labels use translation keys.
- Loading state prevents duplicate submit.

### Card

Use for grouped information or repeated items.

Rules:

- Do not nest cards inside cards.
- Avoid decorative card grids for simple content.
- Use subtle elevation or border, not both heavily.

### Input

Use for unavoidable typing.

Types:

- Text
- Money
- Number
- Remarks

Rules:

- Prefer selection controls over text inputs.
- Show validation under the field.
- Use keyboard type appropriate to input.

### Dropdown And BottomSheetSelect

Use bottom sheets for mobile selection.

Rules:

- Search appears when list is long.
- Active items appear first.
- Recent items can be pinned to top.

### Bottom Sheet

Uses:

- Select employee
- Select service
- Confirm delete
- Filter reports
- Quick edit

Rules:

- Must support safe area.
- Must have clear title and close affordance.
- Primary action remains reachable.

### App Bar

Contains screen title and minimal actions.

Rules:

- Avoid crowded top-right actions.
- Use bottom sheets for secondary actions.

### FAB

Use for primary creation action on list screens.

Examples:

- Add service
- Add employee
- Add expense
- Add income

### Search Bar

Use for service and employee lists when item count grows.

Rules:

- Debounce search.
- Search local SQLite data.
- Empty search states use translation keys.

## Domain Components

### EmployeeCard

Shows:

- Employee name
- Active/inactive badge
- Today's commission when contextually useful

### ServiceCard

Shows:

- Service name
- Price
- Active/inactive badge

### ExpenseCard

Shows:

- Category
- Amount
- Date
- Remarks preview when available

### TransactionCard

Shows:

- Employee
- Services summary
- Payment mode
- Gross amount
- Commission amount

### MoneyCard

Shows dashboard totals such as today's income, expenses, and net collection.

## Feedback Components

### EmptyState

Includes:

- Short title
- Helpful description
- One action

All text uses translation keys.

### Skeleton

Use while loading local or restored data. Avoid spinners for full-page loading unless unavoidable.

### Badge

Use for sync, active/inactive, or payment mode status.

### Chip

Use for service selection, payment mode, report filters, and categories.

Rules:

- Chips are large enough for thumb taps.
- Selected state is obvious without relying only on color.
