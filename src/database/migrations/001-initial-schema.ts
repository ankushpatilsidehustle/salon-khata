import { database } from "@/database/sqlite-client";

const initialSchemaSql = `
CREATE TABLE IF NOT EXISTS salons (
  id TEXT PRIMARY KEY NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mobile_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  value INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS income_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name_snapshot TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  gross_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS income_transaction_items (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name_snapshot TEXT NOT NULL,
  service_price_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_amount INTEGER NOT NULL,
  commission_rule_type_snapshot TEXT,
  commission_rule_value_snapshot INTEGER,
  commission_amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_name_snapshot TEXT NOT NULL,
  amount INTEGER NOT NULL,
  remarks TEXT,
  expense_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  salon_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_payload TEXT,
  after_payload TEXT,
  source_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_salon_active ON services (salon_id, is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_employees_salon_active ON employees (salon_id, is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_income_salon_date ON income_transactions (salon_id, transaction_date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_income_employee_date ON income_transactions (employee_id, transaction_date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_salon_date ON expenses (salon_id, expense_date, deleted_at);
`;

export function runMigrations() {
  database.execSync(initialSchemaSql);
}