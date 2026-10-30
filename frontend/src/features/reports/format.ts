const CURRENCY = "USD";
const cents = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });
const whole = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export const formatMoney = (n: number) => cents.format(n);
export const formatMoneyWhole = (n: number) => whole.format(n);
export const formatMoneyCompact = (n: number) => compact.format(n);
export const formatInt = (n: number) => integer.format(n);
export const formatChange = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
