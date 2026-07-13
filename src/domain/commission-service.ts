export type CommissionRule = {
  ruleType: "percentage" | "fixed";
  value: number;
};

export type CommissionInput = {
  lineAmount: number;
  quantity: number;
  rule: CommissionRule | null;
  /**
   * Product ("parts") cost consumed per unit of the service, in paise.
   * When > 0 and the rule is percentage-based, this cost is subtracted from
   * the line amount before applying the percentage — so the stylist earns
   * commission on labor only. Fixed-rupee rules ignore this value.
   */
  productCostPerUnit?: number;
};

export function calculateCommission(input: CommissionInput) {
  if (!input.rule) {
    return 0;
  }

  if (input.rule.ruleType === "fixed") {
    return input.rule.value * input.quantity;
  }

  const productCostTotal = (input.productCostPerUnit ?? 0) * input.quantity;
  const commissionable = Math.max(0, input.lineAmount - productCostTotal);
  return Math.round((commissionable * input.rule.value) / 10000);
}

/**
 * Employee-level compensation shape needed to derive a fallback commission
 * rule when no service-specific rule exists. Matches the fields on
 * `EmployeeRecord`, but kept minimal so this module stays framework-free.
 */
export type EmployeeCompensation = {
  compensation_type: "salary" | "commission" | null;
  /** Percent × 100 (basis-point-style). 40% = 4000. */
  commission_percent: number | null;
};

/**
 * Rule shape stored on `commission_rules` rows. Extracted here so callers
 * can pass either a full record or a plain object.
 */
export type PerServiceRule = {
  rule_type: "percentage" | "fixed";
  value: number;
};

/**
 * Resolve the rule that should actually be applied to a bill line.
 *
 * Precedence:
 *   1. A per-service override (`commission_rules` row) — always wins.
 *   2. The employee's default: if `compensation_type = 'commission'` and
 *      `commission_percent > 0`, treat it as a percentage rule on all services.
 *   3. Otherwise `null` — no commission (salaried employees, or commission
 *      employees who haven't set a default yet).
 */
export function resolveEffectiveRule(
  perServiceRule: PerServiceRule | null,
  employee: EmployeeCompensation | null | undefined
): PerServiceRule | null {
  if (perServiceRule) {
    return { rule_type: perServiceRule.rule_type, value: perServiceRule.value };
  }
  if (
    employee &&
    employee.compensation_type === "commission" &&
    employee.commission_percent != null &&
    employee.commission_percent > 0
  ) {
    return { rule_type: "percentage", value: employee.commission_percent };
  }
  return null;
}
