/** Symbol shown on money inputs when a field doesn't set its own. */
export const DEFAULT_CURRENCY_SYMBOL = "₦";

/** Naira with thousands separators and kobo, e.g. 1842000 → "₦1,842,000.00". */
export function formatNaira(amount: number) {
	return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
