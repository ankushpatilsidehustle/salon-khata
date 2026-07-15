import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { trackChange } from "@/sync/change-tracker";

export type CommissionRuleRecord = SharedColumns & {
  salon_id: string;
  employee_id: string;
  service_id: string;
  /**
   * "percentage" — value is basis points (35% = 3500)
   * "fixed"      — value is paise (₹50 = 5000)
   */
  rule_type: "percentage" | "fixed";
  value: number;
  is_active: number;
};

export type CommissionRuleWithService = CommissionRuleRecord & {
  service_name: string;
};

export class CommissionRepository {
  /** Returns the single active rule for an employee × service pair, or null. */
  findActiveRule(
    employeeId: string,
    serviceId: string
  ): CommissionRuleRecord | null {
    return (
      database.getFirstSync<CommissionRuleRecord>(
        `SELECT * FROM commission_rules
         WHERE employee_id = ? AND service_id = ?
           AND is_active = 1 AND deleted_at IS NULL
         LIMIT 1`,
        [employeeId, serviceId]
      ) ?? null
    );
  }

  /**
   * Returns all active rules for an employee, joined with service name.
   * Soft-deleted services are excluded.
   */
  findAllRulesForEmployee(
    employeeId: string,
    salonId: string
  ): CommissionRuleWithService[] {
    return database.getAllSync<CommissionRuleWithService>(
      `SELECT cr.*, s.name AS service_name
       FROM commission_rules cr
       JOIN services s ON s.id = cr.service_id
       WHERE cr.employee_id = ? AND cr.salon_id = ?
         AND cr.is_active = 1 AND cr.deleted_at IS NULL
         AND s.deleted_at IS NULL
       ORDER BY s.name ASC`,
      [employeeId, salonId]
    );
  }

  /**
   * Upsert a commission rule for an employee × service pair.
   * If an active rule already exists it is updated in-place; otherwise a new
   * row is inserted.
   */
  saveRule(params: {
    employeeId: string;
    serviceId: string;
    salonId: string;
    ruleType: "percentage" | "fixed";
    value: number;
  }): void {
    const { employeeId, serviceId, salonId, ruleType, value } = params;
    const existing = this.findActiveRule(employeeId, serviceId);
    const now = getUtcTimestamp();

    if (existing) {
      runInTransaction(() => {
        database.runSync(
          `UPDATE commission_rules
           SET rule_type = ?, value = ?, updated_at = ?
           WHERE id = ?`,
          [ruleType, value, now, existing.id]
        );
        trackChange({
          entityType: "commission_rules",
          entityId: existing.id,
          salonId
        });
        markDirty();
      });
    } else {
      const newRuleId = newId();
      runInTransaction(() => {
        database.runSync(
          `INSERT INTO commission_rules
           (id, salon_id, employee_id, service_id, rule_type, value, is_active,
            created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
          [newRuleId, salonId, employeeId, serviceId, ruleType, value, now, now]
        );
        trackChange({
          entityType: "commission_rules",
          entityId: newRuleId,
          salonId
        });
        markDirty();
      });
    }
  }

  /** Soft-deletes the active rule for an employee × service pair if one exists. */
  clearRule(employeeId: string, serviceId: string): void {
    const existing = this.findActiveRule(employeeId, serviceId);
    if (!existing) return;
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `UPDATE commission_rules
         SET is_active = 0, deleted_at = ?, updated_at = ?
         WHERE id = ?`,
        [now, now, existing.id]
      );
      trackChange({
        entityType: "commission_rules",
        entityId: existing.id,
        salonId: existing.salon_id
      });
      markDirty();
    });
  }
}
