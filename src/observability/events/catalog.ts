/** Canonical event names + param shapes. Single source of truth for GA4. */

export type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Auth funnel */
export const AuthEvents = {
  loginStarted: "auth_login_started",
  otpSent: "auth_otp_sent",
  otpVerified: "auth_otp_verified",
  loginFailed: "auth_login_failed",
  logout: "auth_logout",
  sessionRestored: "auth_session_restored",
  sessionExpired: "auth_session_expired"
} as const;

/** Onboarding */
export const OnboardingEvents = {
  started: "onboarding_started",
  languageSelected: "onboarding_language_selected",
  gettingStartedCompleted: "onboarding_getting_started_completed",
  gettingStartedSkipped: "onboarding_getting_started_skipped",
  salonTypeSelected: "onboarding_salon_type_selected",
  businessSetupCompleted: "onboarding_business_setup_completed",
  servicesSeeded: "onboarding_services_seeded",
  completed: "onboarding_completed"
} as const;

/** Customers */
export const CustomerEvents = {
  created: "customer_created",
  updated: "customer_updated",
  deleted: "customer_deleted",
  search: "customer_search",
  detailOpened: "customer_detail_opened",
  callTapped: "customer_call_tapped",
  whatsappTapped: "customer_whatsapp_tapped"
} as const;

/** Billing / income */
export const BillingEvents = {
  billCreated: "bill_created",
  billEdited: "bill_edited",
  billDeleted: "bill_deleted",
  billItemAdded: "bill_item_added",
  discountApplied: "discount_applied",
  paymentMethodSelected: "payment_method_selected",
  commissionSnapshotComputed: "commission_snapshot_computed",
  firstBillCreated: "first_bill_created"
} as const;

/** Staff */
export const StaffEvents = {
  added: "staff_added",
  updated: "staff_updated",
  deleted: "staff_deleted",
  commissionRulesUpdated: "commission_rules_updated",
  advanceCreated: "advance_created",
  advanceListViewed: "advance_list_viewed"
} as const;

/** Expenses */
export const ExpenseEvents = {
  created: "expense_created",
  updated: "expense_updated",
  deleted: "expense_deleted",
  settled: "expense_settled",
  categorySelected: "expense_category_selected"
} as const;

/** Services */
export const ServiceEvents = {
  created: "service_created",
  updated: "service_updated",
  deleted: "service_deleted",
  categoryChanged: "service_category_changed"
} as const;

/**
 * Reserved for future modules — do not fire until features ship.
 * @see docs/observability/dashboards.md
 */
export const AppointmentEvents = {
  created: "appointment_created",
  updated: "appointment_updated",
  cancelled: "appointment_cancelled",
  completed: "appointment_completed"
} as const;

export const InventoryEvents = {
  itemAdded: "inventory_item_added",
  stockAdjusted: "inventory_stock_adjusted",
  lowStockShown: "inventory_low_stock_shown"
} as const;

/** Reports */
export const ReportEvents = {
  periodSelected: "report_period_selected",
  viewed: "report_viewed",
  topEmployeesOpened: "report_top_employees_opened",
  topServicesOpened: "report_top_services_opened",
  commissionOpened: "report_commission_opened"
} as const;

/** Subscription / referral */
export const SubscriptionEvents = {
  screenViewed: "subscription_screen_viewed",
  trialStarted: "trial_started",
  trialExpiringShown: "trial_expiring_shown",
  softLockShown: "soft_lock_shown",
  planSelected: "plan_selected",
  referralCodeEntered: "referral_code_entered",
  referralClaimSucceeded: "referral_claim_succeeded",
  referralClaimFailed: "referral_claim_failed"
} as const;

/** Sync / backup (prefer bus bridge — avoid double-fire from UI) */
export const SyncEvents = {
  pushCompleted: "sync_push_completed",
  pullCompleted: "sync_pull_completed",
  conflict: "sync_conflict",
  deadLetter: "sync_dead_letter",
  backupSucceeded: "backup_succeeded",
  backupFailed: "backup_failed",
  lockChanged: "lock_changed"
} as const;

/** Settings / More */
export const SettingsEvents = {
  languageChanged: "language_changed",
  syncStatusOpened: "sync_status_opened",
  exportSnapshotStarted: "export_snapshot_started",
  accountSignOut: "account_sign_out",
  analyticsConsentChanged: "analytics_consent_changed",
  emptyStateCtaPressed: "empty_state_cta_pressed",
  sheetOpened: "sheet_opened",
  sheetClosed: "sheet_closed"
} as const;

/** Dashboard */
export const DashboardEvents = {
  viewed: "dashboard_viewed",
  fabPressed: "dashboard_fab_pressed",
  ghostExpensePressed: "dashboard_ghost_expense_pressed",
  transactionOpened: "dashboard_transaction_opened",
  viewAllPressed: "dashboard_view_all_pressed"
} as const;

/** Screen lifecycle (in addition to Firebase screen_view) */
export const ScreenEvents = {
  open: "screen_open",
  close: "screen_close"
} as const;

export const Events = {
  auth: AuthEvents,
  onboarding: OnboardingEvents,
  customer: CustomerEvents,
  billing: BillingEvents,
  staff: StaffEvents,
  expense: ExpenseEvents,
  service: ServiceEvents,
  appointment: AppointmentEvents,
  inventory: InventoryEvents,
  report: ReportEvents,
  subscription: SubscriptionEvents,
  sync: SyncEvents,
  settings: SettingsEvents,
  dashboard: DashboardEvents,
  screen: ScreenEvents
} as const;

export type EventName =
  | (typeof AuthEvents)[keyof typeof AuthEvents]
  | (typeof OnboardingEvents)[keyof typeof OnboardingEvents]
  | (typeof CustomerEvents)[keyof typeof CustomerEvents]
  | (typeof BillingEvents)[keyof typeof BillingEvents]
  | (typeof StaffEvents)[keyof typeof StaffEvents]
  | (typeof ExpenseEvents)[keyof typeof ExpenseEvents]
  | (typeof ServiceEvents)[keyof typeof ServiceEvents]
  | (typeof AppointmentEvents)[keyof typeof AppointmentEvents]
  | (typeof InventoryEvents)[keyof typeof InventoryEvents]
  | (typeof ReportEvents)[keyof typeof ReportEvents]
  | (typeof SubscriptionEvents)[keyof typeof SubscriptionEvents]
  | (typeof SyncEvents)[keyof typeof SyncEvents]
  | (typeof SettingsEvents)[keyof typeof SettingsEvents]
  | (typeof DashboardEvents)[keyof typeof DashboardEvents]
  | (typeof ScreenEvents)[keyof typeof ScreenEvents];

/** Error categories for Crashlytics / non-fatal taxonomy. */
export type ErrorCategory =
  | "sqlite"
  | "firestore"
  | "storage"
  | "sync"
  | "backup"
  | "auth"
  | "ui"
  | "background"
  | "network"
  | "unknown";
