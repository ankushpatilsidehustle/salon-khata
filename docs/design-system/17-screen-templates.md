# 17 · Screen Templates

Every screen in Salon Khata follows one of eight templates. When designing a new screen, pick a template — do not invent a new layout.

## Template Anchor Zones

Every screen has three anchor zones:

1. **Top**: App bar (56 dp + safe area top).
2. **Middle**: Scrollable content.
3. **Bottom**: Primary action / bottom nav / fixed footer.

Templates below define how each zone is used.

---

## Template 1: Dashboard

**Purpose**: Overview of today's business.

**Layout**

- **App bar**: Business name (H2), no back, trailing `bell` icon (future) and profile avatar.
- **Content** (scroll):
  - Hero Money Card: Today's income
  - Row: Money Card × 2 (Expenses, Net collection)
  - Section header: Recent transactions
  - List of last 5 Transaction Cards
  - Summary Card: Sync status ("Last synced 2 minutes ago")
- **Bottom nav**.
- **FAB (Extended)**: `+ Add income` bottom-right, 16 dp above nav.

**Spacing**: `space.4` (16) padding around content.

**Do's**: consistent lead metric; one FAB.
**Don'ts**: charts on Dashboard; more than one hero card.

---

## Template 2: List Screen

**Purpose**: Browse an entity type (services, employees, expenses, transactions).

**Layout**

- **App bar**: Title (H2), trailing `search` and `sliders-horizontal` icons.
- **Sub-header** (sticky under app bar when filters active):
  - Search bar (if search invoked)
  - Filter chips row (if filters active)
- **Content** (scroll):
  - Grouped list (by date or status)
  - Group headers as Section Header
  - List Items or Domain Cards
  - Skeleton on first load
  - Empty state if no data
- **Bottom nav**.
- **FAB**: `plus` icon bottom-right.

**Spacing**: `space.4` horizontal padding; rows follow List Item spacing.

**Do's**: consistent trailing element per list.
**Don'ts**: two different card types in the same list.

---

## Template 3: Form (Full Screen)

**Purpose**: Multi-field data entry (add/edit employee, service, commission rule).

**Layout**

- **App bar**: Title (H2), leading `x` (close), no trailing.
- **Content** (scroll):
  - Field group 1 (label + input + help/error)
  - Field group 2
  - ...
  - Optional fields grouped at the bottom
- **Bottom fixed footer**:
  - Primary Button (full width): Save / Update

**Spacing**: `space.4` horizontal padding; `space.4` between field groups; `space.5` before footer.

**Behavior**:

- Back with unsaved changes → discard-changes dialog.
- Save → SQLite write → snackbar → return to previous screen.
- First invalid field focused on submit failure.

**Do's**: only ask for what is necessary.
**Don'ts**: multi-column form on phone.

---

## Template 4: Report

**Purpose**: Analytics view (daily, monthly, employee, service).

**Layout**

- **App bar**: Title (H2), trailing `sliders-horizontal` (filter).
- **Sub-header**:
  - Segmented control (Daily / Monthly for Reports > Daily/Monthly)
  - Date range summary line
- **Content** (scroll):
  - Hero Money Card
  - Row of Money Cards
  - Summary Cards (top performers)
  - Bar list visualization
  - Section header + supporting list
- **Bottom nav**.
- **No FAB**.

**Spacing**: `space.4` padding around content; `space.5` between summary sections.

**Do's**: consistent card ordering.
**Don'ts**: pie charts; multiple hero cards.

---

## Template 5: Settings

**Purpose**: Configuration and account management.

**Layout**

- **App bar**: Title "Settings" (H2), leading `arrow-left`.
- **Content** (scroll):
  - Section header: Business
    - List Item: Business name (chevron)
    - List Item: Currency (chevron)
    - List Item: Language (trailing current language)
  - Section header: Data
    - List Item: Backup now (trailing timestamp)
    - List Item: Restore (chevron)
    - List Item: Sync status (trailing badge)
  - Section header: Account
    - List Item: Profile (chevron)
    - List Item: Sign out (destructive, no chevron)
  - Section header: About
    - List Item: Version (trailing version string)
    - List Item: Terms & Privacy (chevron)
- **Bottom nav**.
- **No FAB**.

**Spacing**: `space.4` horizontal; `space.5` before each section header.

**Do's**: group by responsibility; destructive actions last.
**Don'ts**: dense two-column settings.

---

## Template 6: Bottom Sheet

**Purpose**: Focused decision or quick edit inside another screen.

**Layout**

- **Handle bar** (24 × 4 dp).
- **Header**:
  - Title (H3)
  - Optional close (`x`) icon on the right
- **Content**:
  - Search (if applicable)
  - Options / form fields / list rows
- **Bottom fixed footer** (if actionable):
  - Primary Button: Confirm / Apply / Done

**Spacing**: `space.5` top padding, `space.4` horizontal, `space.5` bottom + safe area.

**Height**: content-sized, max 80% of viewport.

**Do's**: single-purpose sheets; primary action reachable with thumb.
**Don'ts**: nested sheets; scrollable content taller than 80% (use full screen).

---

## Template 7: Authentication

**Purpose**: Sign in / sign up.

**Sub-templates**:

### 7a. Splash

- Centered logo + tagline.
- Full brand background (`brand.primary` on `background.default` or as chosen).
- 1.5 s max duration.

### 7b. Mobile Number Entry

- **App bar**: no back.
- **Content**:
  - Illustration slot (icon-only in MVP).
  - Title (H1): "Enter your mobile number"
  - Body (Body): "We'll send a one-time code to verify."
  - Text Field: `+91 · [10 digits]`
- **Bottom fixed footer**:
  - Primary Button: `Send OTP`

### 7c. OTP Verification

- **App bar**: leading `arrow-left`.
- **Content**:
  - Title (H1): "Enter the 6-digit code"
  - Body (Body): "Sent to +91 XXXXX XXXXX. [Change]"
  - OTP input (6 boxes with auto-advance)
  - Body Small: `Resend in 30s` → `Resend` after timer
- **Bottom fixed footer**:
  - Primary Button: `Verify` (auto-triggers when 6 digits entered)

### 7d. Business Setup

- **App bar**: no back.
- **Content**:
  - Title (H1): "Set up your salon"
  - Text Field: Business name (required)
  - Text Field: Owner name (optional)
- **Bottom fixed footer**:
  - Primary Button: `Continue`

**Do's**: minimal fields; auto-advance where possible.
**Don'ts**: multi-page onboarding tour.

---

## Template 8: Empty

**Purpose**: Placeholder when a screen has no content.

**Layout**

- **App bar**: (matches the parent screen).
- **Content** (centered vertically in available space):
  - Icon (`size.icon.xl`, `text.muted`)
  - Title (H2, centered)
  - Body (Body, `text.secondary`, centered, max 320 dp width)
  - Primary Button: action to fill the empty state

**Spacing**: `space.6` (32) between icon and title; `space.3` between title and body; `space.5` between body and button.

**Do's**: always include a next action.
**Don'ts**: passive "No data" screens; illustrations in MVP.

---

## Detail Sheet Pattern

Not a template per se, but a **recurring composition**:

- Triggered by tapping a list row.
- Uses the Bottom Sheet template.
- Shows the full detail of one record.
- Trailing footer: `Edit` (Secondary) + `Delete` (Destructive Ghost).

Applies to: transaction detail, expense detail, service detail, employee detail.

---

## Template Selection Matrix

| Feature | Template |
| --- | --- |
| Dashboard | 1 |
| Income entry (form) | 3 |
| Expense entry (form) | 3 |
| Add/edit employee | 3 |
| Add/edit service | 3 |
| Commission rule setup | 3 |
| Services list | 2 |
| Employees list | 2 |
| Transactions list | 2 |
| Expenses list | 2 |
| Report daily | 4 |
| Report monthly | 4 |
| Report per employee | 4 |
| Report per service | 4 |
| Settings root | 5 |
| Backup / Restore | 5 (sub-screen) |
| Filter | 6 |
| Payment mode selection | 6 (inline chips, not sheet) |
| Employee / service selection | 6 |
| Delete confirmation | Dialog (not template) |
| Splash / OTP / Business setup | 7 |
| All empty states | 8 |

## Anti-Patterns

- Custom layouts that combine templates in one screen.
- Two-panel layouts on phone.
- Multi-page wizards (use one long form or splits into logical steps).
- Popup menus.
- Slide-out drawers.

## Do's

- Pick the closest template; extend only via spacing.
- Keep app bar and bottom zones consistent across templates.
- Reuse Domain Cards across templates.

## Don'ts

- Don't invent new templates.
- Don't move the FAB across screens (bottom-right always).
- Don't hide primary actions.
