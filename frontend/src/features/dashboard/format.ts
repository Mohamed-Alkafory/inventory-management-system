const CURRENCY = "EGP";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });
const moneyWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const moneyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatMoney = (n: number) => money.format(n);
export const formatMoneyWhole = (n: number) => moneyWhole.format(n);
export const formatMoneyCompact = (n: number) => moneyCompact.format(n);
export const formatInt = (n: number) => integer.format(n);
