import type { SyncEntityType } from "@/sync/types";

/**
 * Pull order. Parents come before children so a freshly-pulled child row
 * finds its parent already present locally, keeping any joins in the
 * feature layer consistent during the pull.
 *
 * SQLite foreign keys are not enforced in this codebase (`PRAGMA
 * foreign_keys=OFF` by default in expo-sqlite), so ordering is a
 * correctness aid rather than a hard requirement — but keeping it right
 * avoids transient "orphaned child" UI flicker when the pull is running
 * while a screen is open.
 *
 * `income_transactions` sits last because it references almost every other
 * entity (employees + services + service_categories + customers) via
 * snapshot fields and its embedded `items[]`.
 */
export const ENTITY_PULL_ORDER: readonly SyncEntityType[] = [
  "salons",
  "service_categories",
  "services",
  "expense_categories",
  "employees",
  "customers",
  "commission_rules",
  "expenses",
  "employee_advances",
  "income_transactions"
] as const;
