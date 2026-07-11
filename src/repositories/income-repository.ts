import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";

export type IncomeTransactionDraft = {
  transaction: Record<string, string | number | null>;
  items: Array<Record<string, string | number | null>>;
};

export type IncomeTransactionRecord = SharedColumns & {
  salon_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  transaction_date: string;
  payment_mode: string;
  gross_amount: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  net_amount: number;
  commission_amount: number;
  remarks: string | null;
  /**
   * Optional link to the customer master row. Snapshots below preserve the
   * name + phone as they were at billing time so receipts stay stable even
   * if the master row is later edited or deleted.
   */
  customer_id: string | null;
  customer_name_snapshot: string | null;
  customer_phone_snapshot: string | null;
};

export type IncomeItemRecord = SharedColumns & {
  salon_id: string;
  transaction_id: string;
  service_id: string;
  service_name_snapshot: string;
  service_price_snapshot: number;
  quantity: number;
  line_amount: number;
  commission_rule_type_snapshot: string | null;
  commission_rule_value_snapshot: number | null;
  commission_amount: number;
  /**
   * Line-level employee assignment. Nullable in schema because migration 006
   * backfills existing rows and the header employee remains as a fallback,
   * but new writes should always populate these fields.
   */
  employee_id: string | null;
  employee_name_snapshot: string | null;
  /**
   * Per-unit product cost captured from the service master at billing time.
   * Preserved so historical bills stay stable when the master cost is later
   * edited. Default 0.
   */
  product_cost_snapshot: number;
};

/** Convenience shape for dashboards: header row + concatenated service names. */
export type IncomeTransactionSummary = IncomeTransactionRecord & {
  services_summary: string;
  /**
   * Distinct employees that appear on the transaction's service lines,
   * comma-separated. Falls back to the header employee for rows created
   * before migration 006 populated line-level employees.
   */
  employees_summary: string;
};

/** Aggregated commission per employee for a date range. */
export type EmployeeCommissionTotal = {
  employee_id: string;
  employee_name: string;
  commission_amount: number;
  line_count: number;
};

export class IncomeRepository {
  saveIncomeTransaction(draft: IncomeTransactionDraft) {
    runInTransaction(() => {
      database.runSync(
        `INSERT INTO income_transactions (
          id, salon_id, employee_id, employee_name_snapshot, transaction_date, payment_mode,
          gross_amount, discount_type, discount_value, discount_amount,
          net_amount, commission_amount, remarks,
          customer_id, customer_name_snapshot, customer_phone_snapshot,
          created_at, updated_at, deleted_at, sync_status, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          draft.transaction.id,
          draft.transaction.salon_id,
          draft.transaction.employee_id,
          draft.transaction.employee_name_snapshot,
          draft.transaction.transaction_date,
          draft.transaction.payment_mode,
          draft.transaction.gross_amount,
          draft.transaction.discount_type ?? null,
          draft.transaction.discount_value ?? 0,
          draft.transaction.discount_amount ?? 0,
          draft.transaction.net_amount,
          draft.transaction.commission_amount,
          draft.transaction.remarks,
          draft.transaction.customer_id ?? null,
          draft.transaction.customer_name_snapshot ?? null,
          draft.transaction.customer_phone_snapshot ?? null,
          draft.transaction.created_at,
          draft.transaction.updated_at,
          draft.transaction.deleted_at,
          draft.transaction.sync_status,
          draft.transaction.device_id
        ]
      );

      for (const item of draft.items) {
        database.runSync(
          `INSERT INTO income_transaction_items (
            id, salon_id, transaction_id, service_id, service_name_snapshot,
            service_price_snapshot, quantity, line_amount, commission_rule_type_snapshot,
            commission_rule_value_snapshot, commission_amount,
            employee_id, employee_name_snapshot,
            product_cost_snapshot,
            created_at, updated_at,
            deleted_at, sync_status, device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.salon_id,
            item.transaction_id,
            item.service_id,
            item.service_name_snapshot,
            item.service_price_snapshot,
            item.quantity,
            item.line_amount,
            item.commission_rule_type_snapshot,
            item.commission_rule_value_snapshot,
            item.commission_amount,
            // Fall back to the transaction-level employee so callers that
            // haven't been updated yet (pre-Phase-4) still produce valid rows.
            item.employee_id ?? draft.transaction.employee_id ?? null,
            item.employee_name_snapshot ??
              draft.transaction.employee_name_snapshot ??
              null,
            item.product_cost_snapshot ?? 0,
            item.created_at,
            item.updated_at,
            item.deleted_at,
            item.sync_status,
            item.device_id
          ]
        );
      }
    });
  }

  /**
   * All income transactions for a given local business date (YYYY-MM-DD),
   * newest first, with a concatenated "Haircut, Facial" summary column
   * derived from the items table.
   */
  listByDate(salonId: string, date: string): IncomeTransactionSummary[] {
    return database.getAllSync<IncomeTransactionSummary>(
      `SELECT t.*,
              COALESCE(
                (SELECT GROUP_CONCAT(i.service_name_snapshot, ', ')
                 FROM income_transaction_items i
                 WHERE i.transaction_id = t.id AND i.deleted_at IS NULL),
                ''
              ) AS services_summary,
              COALESCE(
                (SELECT GROUP_CONCAT(DISTINCT i.employee_name_snapshot)
                 FROM income_transaction_items i
                 WHERE i.transaction_id = t.id
                   AND i.deleted_at IS NULL
                   AND i.employee_name_snapshot IS NOT NULL),
                t.employee_name_snapshot
              ) AS employees_summary
       FROM income_transactions t
       WHERE t.salon_id = ? AND t.transaction_date = ? AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC`,
      [salonId, date]
    );
  }

  /**
   * Sum commission per employee across a business-date range, based on the
   * item-level employee assignment introduced in migration 006. Rows created
   * before that migration are covered because the migration backfilled the
   * line's employee from the transaction header.
   */
  sumCommissionByEmployee(
    salonId: string,
    startDate: string,
    endDate: string
  ): EmployeeCommissionTotal[] {
    return database.getAllSync<EmployeeCommissionTotal>(
      `SELECT
         i.employee_id                                    AS employee_id,
         COALESCE(i.employee_name_snapshot, '')           AS employee_name,
         COALESCE(SUM(i.commission_amount), 0)            AS commission_amount,
         COUNT(*)                                         AS line_count
       FROM income_transaction_items i
       JOIN income_transactions t ON t.id = i.transaction_id
       WHERE t.salon_id = ?
         AND t.transaction_date BETWEEN ? AND ?
         AND t.deleted_at IS NULL
         AND i.deleted_at IS NULL
         AND i.employee_id IS NOT NULL
       GROUP BY i.employee_id, i.employee_name_snapshot
       ORDER BY commission_amount DESC`,
      [salonId, startDate, endDate]
    );
  }

  /**
   * Fetch a single transaction (header + items) by id. Returns null if the
   * row is missing or soft-deleted.
   */
  getById(
    salonId: string,
    id: string
  ): { transaction: IncomeTransactionRecord; items: IncomeItemRecord[] } | null {
    const transaction = database.getFirstSync<IncomeTransactionRecord>(
      `SELECT * FROM income_transactions
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [id, salonId]
    );
    if (!transaction) return null;
    const items = database.getAllSync<IncomeItemRecord>(
      `SELECT * FROM income_transaction_items
       WHERE transaction_id = ? AND salon_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [id, salonId]
    );
    return { transaction, items };
  }

  /**
   * Replace an existing transaction's header + items in a single SQL
   * transaction. Items are hard-deleted and re-inserted with fresh ids —
   * simpler than diffing and safe for MVP (sync engine treats the header's
   * updated_at + sync_status='pending' as the change signal).
   */
  updateIncomeTransaction(draft: IncomeTransactionDraft) {
    runInTransaction(() => {
      database.runSync(
        `UPDATE income_transactions SET
           employee_id = ?, employee_name_snapshot = ?,
           transaction_date = ?, payment_mode = ?,
           gross_amount = ?, discount_type = ?, discount_value = ?, discount_amount = ?,
           net_amount = ?, commission_amount = ?, remarks = ?,
           customer_id = ?, customer_name_snapshot = ?, customer_phone_snapshot = ?,
           updated_at = ?, sync_status = ?
         WHERE id = ? AND salon_id = ?`,
        [
          draft.transaction.employee_id,
          draft.transaction.employee_name_snapshot,
          draft.transaction.transaction_date,
          draft.transaction.payment_mode,
          draft.transaction.gross_amount,
          draft.transaction.discount_type ?? null,
          draft.transaction.discount_value ?? 0,
          draft.transaction.discount_amount ?? 0,
          draft.transaction.net_amount,
          draft.transaction.commission_amount,
          draft.transaction.remarks,
          draft.transaction.customer_id ?? null,
          draft.transaction.customer_name_snapshot ?? null,
          draft.transaction.customer_phone_snapshot ?? null,
          draft.transaction.updated_at,
          draft.transaction.sync_status,
          draft.transaction.id,
          draft.transaction.salon_id
        ]
      );

      database.runSync(
        `DELETE FROM income_transaction_items
         WHERE transaction_id = ? AND salon_id = ?`,
        [draft.transaction.id, draft.transaction.salon_id]
      );

      for (const item of draft.items) {
        database.runSync(
          `INSERT INTO income_transaction_items (
            id, salon_id, transaction_id, service_id, service_name_snapshot,
            service_price_snapshot, quantity, line_amount, commission_rule_type_snapshot,
            commission_rule_value_snapshot, commission_amount,
            employee_id, employee_name_snapshot,
            product_cost_snapshot,
            created_at, updated_at,
            deleted_at, sync_status, device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.salon_id,
            item.transaction_id,
            item.service_id,
            item.service_name_snapshot,
            item.service_price_snapshot,
            item.quantity,
            item.line_amount,
            item.commission_rule_type_snapshot,
            item.commission_rule_value_snapshot,
            item.commission_amount,
            item.employee_id ?? draft.transaction.employee_id ?? null,
            item.employee_name_snapshot ??
              draft.transaction.employee_name_snapshot ??
              null,
            item.product_cost_snapshot ?? 0,
            item.created_at,
            item.updated_at,
            item.deleted_at,
            item.sync_status,
            item.device_id
          ]
        );
      }
    });
  }

  /**
   * Soft-delete a transaction and its items. Both rows get `deleted_at` set
   * and `sync_status='pending'` so the sync engine can replicate the tombstone.
   */
  softDelete(
    salonId: string,
    id: string,
    now: string,
    deviceId: string
  ) {
    runInTransaction(() => {
      database.runSync(
        `UPDATE income_transactions
         SET deleted_at = ?, updated_at = ?, sync_status = 'pending', device_id = ?
         WHERE id = ? AND salon_id = ?`,
        [now, now, deviceId, id, salonId]
      );
      database.runSync(
        `UPDATE income_transaction_items
         SET deleted_at = ?, updated_at = ?, sync_status = 'pending', device_id = ?
         WHERE transaction_id = ? AND salon_id = ?`,
        [now, now, deviceId, id, salonId]
      );
    });
  }
}