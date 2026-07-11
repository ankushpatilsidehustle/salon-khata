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
}
