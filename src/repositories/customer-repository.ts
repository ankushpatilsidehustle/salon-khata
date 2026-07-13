import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_DEVICE_ID } from "@/constants/dev";

export type CustomerRecord = SharedColumns & {
  salon_id: string;
  /** Digits-only phone (e.g. "9876543210"). Unique within a salon. */
  phone: string;
  name: string;
};

/** `listAll` result with per-customer stats joined from income_transactions. */
export type CustomerWithStats = CustomerRecord & {
  /** ISO timestamp of the most recent bill's `created_at`; null if never billed. */
  last_visit: string | null;
  /** Total number of non-deleted bills the customer has been on. */
  visit_count: number;
  /** Sum of `net_amount` across the customer's non-deleted bills. */
  total_spend: number;
};

export type NewCustomer = {
  salonId: string;
  name: string;
  phone: string;
};

/**
 * Normalize a user-typed phone to digits-only, keeping the last 10 digits when
 * the input carries a country code (e.g. "+91 98765 43210" → "9876543210").
 * Returns "" if fewer than 10 digits are present so the lookup can bail early.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
}

export class CustomerRepository {
  /** Case-sensitive digits-only phone lookup. Returns null if not found. */
  findByPhone(salonId: string, phone: string): CustomerRecord | null {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return (
      database.getFirstSync<CustomerRecord>(
        `SELECT * FROM customers
         WHERE salon_id = ? AND phone = ? AND deleted_at IS NULL
         LIMIT 1`,
        [salonId, normalized]
      ) ?? null
    );
  }

  getById(salonId: string, id: string): CustomerRecord | null {
    return (
      database.getFirstSync<CustomerRecord>(
        `SELECT * FROM customers
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  /**
   * Typeahead search used by the bill entry customer picker. If the query
   * looks like a phone (all-digits or nearly so) we do a phone-prefix match
   * against the digits-only stored value; otherwise we do a case-insensitive
   * substring match on name. Returns up to `limit` rows, newest-first.
   */
  searchByQuery(salonId: string, query: string, limit = 5): CustomerRecord[] {
    const raw = query.trim();
    if (!raw) return [];
    const digits = raw.replace(/\D/g, "");
    // Treat the query as a phone lookup when it's dominated by digits.
    if (digits.length > 0 && digits.length >= raw.replace(/\s/g, "").length - 1) {
      return database.getAllSync<CustomerRecord>(
        `SELECT * FROM customers
         WHERE salon_id = ? AND deleted_at IS NULL AND phone LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`,
        [salonId, `${digits}%`, limit]
      );
    }
    return database.getAllSync<CustomerRecord>(
      `SELECT * FROM customers
       WHERE salon_id = ? AND deleted_at IS NULL AND name LIKE ? COLLATE NOCASE
       ORDER BY updated_at DESC
       LIMIT ?`,
      [salonId, `%${raw}%`, limit]
    );
  }

  /**
   * Insert a new customer, or return the existing row when a customer with
   * the same phone already exists in the salon. When the existing name
   * differs, update it in place so the master row stays current.
   *
   * Returns the resolved customer id (existing or newly created).
   */
  upsert(data: NewCustomer): string {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      throw new Error("Customer phone is required");
    }
    const name = data.name.trim();
    if (!name) {
      throw new Error("Customer name is required");
    }

    const existing = this.findByPhone(data.salonId, phone);
    const now = getUtcTimestamp();

    if (existing) {
      if (existing.name !== name) {
        database.runSync(
          `UPDATE customers
           SET name = ?, updated_at = ?, sync_status = 'pending'
           WHERE id = ?`,
          [name, now, existing.id]
        );
      }
      return existing.id;
    }

    const id = newId();
    database.runSync(
      `INSERT INTO customers
       (id, salon_id, phone, name,
        created_at, updated_at, deleted_at, sync_status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`,
      [id, data.salonId, phone, name, now, now, DEV_DEVICE_ID]
    );
    return id;
  }

  /**
   * All non-deleted customers for a salon with visit + spend stats joined
   * from `income_transactions`. Sorted by most recent visit first, then by
   * name for customers who have never been billed.
   */
  listAll(salonId: string): CustomerWithStats[] {
    return database.getAllSync<CustomerWithStats>(
      `SELECT c.*,
              (SELECT MAX(t.created_at)
                 FROM income_transactions t
                WHERE t.salon_id = c.salon_id
                  AND t.customer_id = c.id
                  AND t.deleted_at IS NULL)                            AS last_visit,
              COALESCE(
                (SELECT COUNT(*)
                   FROM income_transactions t
                  WHERE t.salon_id = c.salon_id
                    AND t.customer_id = c.id
                    AND t.deleted_at IS NULL), 0)                      AS visit_count,
              COALESCE(
                (SELECT SUM(t.net_amount)
                   FROM income_transactions t
                  WHERE t.salon_id = c.salon_id
                    AND t.customer_id = c.id
                    AND t.deleted_at IS NULL), 0)                      AS total_spend
       FROM customers c
       WHERE c.salon_id = ? AND c.deleted_at IS NULL
       ORDER BY last_visit IS NULL, last_visit DESC, c.name COLLATE NOCASE ASC`,
      [salonId]
    );
  }

  /**
   * Insert a new customer. Throws if a customer with the same phone already
   * exists (use `upsert` for the bill-entry flow which prefers merging).
   * Returns the new row's id.
   */
  insert(data: NewCustomer): string {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Customer phone is required");
    const name = data.name.trim();
    if (!name) throw new Error("Customer name is required");

    const existing = this.findByPhone(data.salonId, phone);
    if (existing) {
      throw new DuplicatePhoneError(existing.id);
    }

    const id = newId();
    const now = getUtcTimestamp();
    database.runSync(
      `INSERT INTO customers
       (id, salon_id, phone, name,
        created_at, updated_at, deleted_at, sync_status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`,
      [id, data.salonId, phone, name, now, now, DEV_DEVICE_ID]
    );
    return id;
  }

  /**
   * Update name and/or phone. Throws `DuplicatePhoneError` if the new phone
   * belongs to a different (non-deleted) customer in the same salon.
   */
  update(
    salonId: string,
    id: string,
    data: { name: string; phone: string }
  ): void {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Customer phone is required");
    const name = data.name.trim();
    if (!name) throw new Error("Customer name is required");

    const collision = this.findByPhone(salonId, phone);
    if (collision && collision.id !== id) {
      throw new DuplicatePhoneError(collision.id);
    }

    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE customers
       SET name = ?, phone = ?, updated_at = ?, sync_status = 'pending', device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [name, phone, now, DEV_DEVICE_ID, id, salonId]
    );
  }

  /** Soft-delete: sets deleted_at + updated_at + sync_status='pending'. */
  softDelete(salonId: string, id: string): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE customers
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending', device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [now, now, DEV_DEVICE_ID, id, salonId]
    );
  }
}

/**
 * Thrown by `insert`/`update` when the phone would collide with an existing
 * (non-deleted) customer. Carries the offending row's id so callers can
 * offer a "Jump to existing" action in the snackbar.
 */
export class DuplicatePhoneError extends Error {
  constructor(public readonly existingId: string) {
    super("A customer with this phone already exists");
    this.name = "DuplicatePhoneError";
  }
}
