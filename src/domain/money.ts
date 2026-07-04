export type Money = number;

export function formatMoney(amount: Money, currency = "INR", locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(amount / 100);
}

export function addMoney(amounts: Money[]) {
  return amounts.reduce((total, amount) => total + amount, 0);
}