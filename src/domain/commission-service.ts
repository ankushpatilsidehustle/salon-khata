export type CommissionRule = {
  ruleType: "percentage" | "fixed";
  value: number;
};

export type CommissionInput = {
  lineAmount: number;
  quantity: number;
  rule: CommissionRule | null;
};

export function calculateCommission(input: CommissionInput) {
  if (!input.rule) {
    return 0;
  }

  if (input.rule.ruleType === "fixed") {
    return input.rule.value * input.quantity;
  }

  return Math.round((input.lineAmount * input.rule.value) / 10000);
}