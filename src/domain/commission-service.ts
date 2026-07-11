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