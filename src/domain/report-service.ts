import { addMoney } from "@/domain/money";

export type DailySummaryInput = {
  incomeAmounts: number[];
  expenseAmounts: number[];
  commissionAmounts: number[];
};

export function calculateDailySummary(input: DailySummaryInput) {
  const income = addMoney(input.incomeAmounts);
  const expenses = addMoney(input.expenseAmounts);
  const commission = addMoney(input.commissionAmounts);

  return {
    commission,
    expenses,
    income,
    netCollection: income - expenses - commission
  };
}

/**
 * Raw per-employee commission totals as returned by the income repository.
 * Kept as a plain shape so this domain module stays repository-agnostic.
 */
export type EmployeeCommissionTotalInput = {
  employee_id: string;
  employee_name: string;
  commission_amount: number;
  line_count: number;
};

export type EmployeeCommissionRow = {
  employeeId: string;
  employeeName: string;
  commissionAmount: number;
  lineCount: number;
};

export type EmployeeCommissionSummary = {
  rows: EmployeeCommissionRow[];
  totalCommission: number;
  totalLines: number;
};

/**
 * Domain view over item-level employee commission totals. Consumers should
 * source the input from `IncomeRepository.sumCommissionByEmployee`, which
 * groups by the service-line employee introduced in migration 006.
 */
export function summarizeEmployeeCommission(
  totals: EmployeeCommissionTotalInput[]
): EmployeeCommissionSummary {
  const rows: EmployeeCommissionRow[] = totals.map((t) => ({
    employeeId: t.employee_id,
    employeeName: t.employee_name,
    commissionAmount: t.commission_amount,
    lineCount: t.line_count
  }));
  const totalCommission = addMoney(rows.map((r) => r.commissionAmount));
  const totalLines = rows.reduce((sum, r) => sum + r.lineCount, 0);
  return { rows, totalCommission, totalLines };
}