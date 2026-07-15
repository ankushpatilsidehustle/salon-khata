import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { trackChange } from "@/sync/change-tracker";

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

/** Row shape returned by `topEmployeesByRevenue`. */
export type EmployeeRevenueTotal = {
  employee_id: string;
  employee_name: string;
  revenue: number;
  bill_count: number;
};

/** Row shape returned by `topServicesByRevenue`. */
export type ServiceRevenueTotal = {
  service_id: string;
  service_name: string;
  revenue: number;
  quantity: number;
};

/** Row shape returned by `paymentModeSplit`. */
export type PaymentModeTotals = Record<string, number>;

/** Row shape returned by `newVsRepeatCounts`. */
export type NewVsRepeatCounts = {
  newCustomers: number;
  repeatCustomers: number;
  walkIns: number;
};

/** Row shape returned by `countBillsBetween`. */
export type BillCountStats = {
  count: number;
  /** Average `net_amount` across the returned bills; 0 when count = 0. */
  avg: number;
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
          created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          draft.transaction.deleted_at
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
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            item.deleted_at
          ]
        );
      }
      // Items ride embedded on the parent transaction's push payload, so
      // only the aggregate root is enqueued.
      trackChange({
        entityType: "income_transactions",
        entityId: String(draft.transaction.id),
        salonId: String(draft.transaction.salon_id)
      });
      markDirty();
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
   * All bill line items credited to a specific employee within the given
   * date range (inclusive, local business dates). Joined with the parent
   * transaction so callers can show the customer name and time-of-day
   * alongside each service. Ordered newest transaction first.
   */
  listItemsByEmployeeAndDateRange(
    salonId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): (IncomeItemRecord & {
    transaction_date: string;
    transaction_created_at: string;
    customer_name_snapshot: string | null;
    customer_phone_snapshot: string | null;
  })[] {
    return database.getAllSync(
      `SELECT i.*,
              t.transaction_date       AS transaction_date,
              t.created_at             AS transaction_created_at,
              t.customer_name_snapshot AS customer_name_snapshot,
              t.customer_phone_snapshot AS customer_phone_snapshot
       FROM income_transaction_items i
       JOIN income_transactions t ON t.id = i.transaction_id
       WHERE t.salon_id = ?
         AND i.employee_id = ?
         AND t.transaction_date BETWEEN ? AND ?
         AND t.deleted_at IS NULL
         AND i.deleted_at IS NULL
       ORDER BY t.created_at DESC, i.created_at ASC`,
      [salonId, employeeId, startDate, endDate]
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
   * simpler than diffing and safe for MVP (the header's updated_at is the
   * change signal consumed by the backup engine's dirty flag).
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
           updated_at = ?
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
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            item.deleted_at
          ]
        );
      }
      trackChange({
        entityType: "income_transactions",
        entityId: String(draft.transaction.id),
        salonId: String(draft.transaction.salon_id)
      });
      markDirty();
    });
  }

  /**
   * Soft-delete a transaction and its items. Both rows get `deleted_at` set
   * so the backup engine can replicate the tombstone.
   */
  softDelete(
    salonId: string,
    id: string,
    now: string
  ) {
    runInTransaction(() => {
      database.runSync(
        `UPDATE income_transactions
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND salon_id = ?`,
        [now, now, id, salonId]
      );
      database.runSync(
        `UPDATE income_transaction_items
         SET deleted_at = ?, updated_at = ?
         WHERE transaction_id = ? AND salon_id = ?`,
        [now, now, id, salonId]
      );
      trackChange({
        entityType: "income_transactions",
        entityId: id,
        salonId
      });
      markDirty();
    });
  }

  // ─── Report aggregations ──────────────────────────────────────────────────

  /** Sum of `net_amount` across all bills within the inclusive date range. */
  sumIncomeBetween(salonId: string, startDate: string, endDate: string): number {
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT SUM(net_amount) AS total FROM income_transactions
       WHERE salon_id = ?
         AND transaction_date BETWEEN ? AND ?
         AND deleted_at IS NULL`,
      [salonId, startDate, endDate]
    );
    return row?.total ?? 0;
  }

  /** Bill count + average net-amount for the given range. */
  countBillsBetween(
    salonId: string,
    startDate: string,
    endDate: string
  ): BillCountStats {
    const row = database.getFirstSync<{ count: number | null; avg: number | null }>(
      `SELECT COUNT(*) AS count, AVG(net_amount) AS avg
       FROM income_transactions
       WHERE salon_id = ?
         AND transaction_date BETWEEN ? AND ?
         AND deleted_at IS NULL`,
      [salonId, startDate, endDate]
    );
    return {
      count: row?.count ?? 0,
      // AVG is null when count = 0 — normalize to 0 and round to paise.
      avg: row?.avg ? Math.round(row.avg) : 0
    };
  }

  /**
   * Top employees by revenue (sum of line_amount) within the date range,
   * limited to `limit` rows, highest first. Revenue is credited to the
   * item-level employee (migration 006 backfilled legacy rows).
   */
  topEmployeesByRevenue(
    salonId: string,
    startDate: string,
    endDate: string,
    limit = 3
  ): EmployeeRevenueTotal[] {
    return database.getAllSync<EmployeeRevenueTotal>(
      `SELECT
         i.employee_id                          AS employee_id,
         COALESCE(i.employee_name_snapshot, '') AS employee_name,
         COALESCE(SUM(i.line_amount), 0)        AS revenue,
         COUNT(DISTINCT i.transaction_id)       AS bill_count
       FROM income_transaction_items i
       JOIN income_transactions t ON t.id = i.transaction_id
       WHERE t.salon_id = ?
         AND t.transaction_date BETWEEN ? AND ?
         AND t.deleted_at IS NULL
         AND i.deleted_at IS NULL
         AND i.employee_id IS NOT NULL
       GROUP BY i.employee_id, i.employee_name_snapshot
       ORDER BY revenue DESC
       LIMIT ?`,
      [salonId, startDate, endDate, limit]
    );
  }

  /**
   * Top services by revenue (sum of line_amount) within the date range.
   * Grouped by service_id + service_name_snapshot so renamed services stay
   * distinct entries in the report.
   */
  topServicesByRevenue(
    salonId: string,
    startDate: string,
    endDate: string,
    limit = 3
  ): ServiceRevenueTotal[] {
    return database.getAllSync<ServiceRevenueTotal>(
      `SELECT
         i.service_id                         AS service_id,
         i.service_name_snapshot              AS service_name,
         COALESCE(SUM(i.line_amount), 0)      AS revenue,
         COALESCE(SUM(i.quantity), 0)         AS quantity
       FROM income_transaction_items i
       JOIN income_transactions t ON t.id = i.transaction_id
       WHERE t.salon_id = ?
         AND t.transaction_date BETWEEN ? AND ?
         AND t.deleted_at IS NULL
         AND i.deleted_at IS NULL
       GROUP BY i.service_id, i.service_name_snapshot
       ORDER BY revenue DESC
       LIMIT ?`,
      [salonId, startDate, endDate, limit]
    );
  }

  /**
   * Total net-amount grouped by payment mode within the date range. Modes
   * that never appear are omitted from the returned map.
   */
  paymentModeSplit(
    salonId: string,
    startDate: string,
    endDate: string
  ): PaymentModeTotals {
    const rows = database.getAllSync<{ payment_mode: string; total: number }>(
      `SELECT payment_mode, COALESCE(SUM(net_amount), 0) AS total
       FROM income_transactions
       WHERE salon_id = ?
         AND transaction_date BETWEEN ? AND ?
         AND deleted_at IS NULL
       GROUP BY payment_mode`,
      [salonId, startDate, endDate]
    );
    const out: PaymentModeTotals = {};
    for (const r of rows) out[r.payment_mode] = r.total;
    return out;
  }

  /**
   * Split bills in the range into new vs repeat vs walk-in customers.
   *  - "new": bill has a `customer_id` AND that customer's earliest bill
   *    (across all-time, non-deleted) also falls inside this range.
   *  - "repeat": bill has a `customer_id` AND the customer's first bill
   *    predates the range.
   *  - "walk-in": bill has NO `customer_id`.
   *
   * We count DISTINCT customers for new/repeat and DISTINCT bills for walk-ins
   * — a repeat customer with 3 bills in the range still counts once.
   */
  newVsRepeatCounts(
    salonId: string,
    startDate: string,
    endDate: string
  ): NewVsRepeatCounts {
    // Walk-in bills are counted per-transaction.
    const walkIns =
      database.getFirstSync<{ count: number | null }>(
        `SELECT COUNT(*) AS count FROM income_transactions
         WHERE salon_id = ?
           AND transaction_date BETWEEN ? AND ?
           AND deleted_at IS NULL
           AND customer_id IS NULL`,
        [salonId, startDate, endDate]
      )?.count ?? 0;

    // For known customers, compare their first-ever transaction_date against
    // the range boundary using a per-customer MIN().
    const rows = database.getAllSync<{ customer_id: string; first_date: string }>(
      `SELECT customer_id, MIN(transaction_date) AS first_date
       FROM income_transactions
       WHERE salon_id = ?
         AND deleted_at IS NULL
         AND customer_id IN (
           SELECT DISTINCT customer_id FROM income_transactions
           WHERE salon_id = ?
             AND transaction_date BETWEEN ? AND ?
             AND deleted_at IS NULL
             AND customer_id IS NOT NULL
         )
       GROUP BY customer_id`,
      [salonId, salonId, startDate, endDate]
    );

    let newCustomers = 0;
    let repeatCustomers = 0;
    for (const r of rows) {
      if (r.first_date >= startDate && r.first_date <= endDate) newCustomers += 1;
      else repeatCustomers += 1;
    }

    return { newCustomers, repeatCustomers, walkIns };
  }

  /** All bills within the date range, newest first, with the same summary
   *  shape used by `listByDate` (services + employees concatenated). */
  listBillsBetween(
    salonId: string,
    startDate: string,
    endDate: string
  ): IncomeTransactionSummary[] {
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
       WHERE t.salon_id = ?
         AND t.transaction_date BETWEEN ? AND ?
         AND t.deleted_at IS NULL
       ORDER BY t.transaction_date DESC, t.created_at DESC`,
      [salonId, startDate, endDate]
    );
  }

  /** All bills for a specific customer, newest first, limited to `limit`. */
  listBillsForCustomer(
    salonId: string,
    customerId: string,
    limit = 100
  ): IncomeTransactionSummary[] {
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
       WHERE t.salon_id = ?
         AND t.customer_id = ?
         AND t.deleted_at IS NULL
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ?`,
      [salonId, customerId, limit]
    );
  }
}