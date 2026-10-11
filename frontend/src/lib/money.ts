import type { PlanPayload } from "@/lib/types";

/**
 * Money on this sheet.
 *
 * `Budget.currency` and `city.Currency` are strings that may be a symbol
 * ("₹"), a code ("INR") or absent. Money is never converted here and no rate
 * is ever assumed — the unit is whatever the payload said, and ₹ when it said
 * nothing. The code is printed as-is when it is not one we can write as a
 * symbol, because naming the currency honestly beats guessing its mark.
 */
const SYMBOLS: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    AED: "AED ",
    THB: "฿",
    SGD: "S$",
    NPR: "NPR ",
    LKR: "LKR ",
};

export const moneyUnit = (plan: PlanPayload): string => {
    const raw = (plan.Budget?.currency ?? plan.city?.Currency ?? "").trim();
    if (!raw) return "₹";
    if (/^[₹$€£¥฿S]$/.test(raw)) return raw;
    const symbol = SYMBOLS[raw.toUpperCase()];
    return symbol ?? `${raw} `;
};

/**
 * One way of writing a figure, for every figure on the sheet.
 *
 * The split, the stay rows and the road-trip calculator used three different
 * treatments between them, which reads as three different currencies. Indian
 * grouping is the one that matches the arithmetic the sheet is doing — lakh and
 * crore steps appear in the totals a long trip actually reaches.
 */
export const amount = (value: number): string =>
    Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";

/** The unit and the figure together, e.g. "₹24,000". */
export const money = (unit: string, value: number): string =>
    `${unit}${amount(value)}`;
/**
 * The wire contract types every budget figure as a string. A figure the solver
 * sent as "24000" is a number to everyone reading the sheet, and text that is
 * not a number is no figure at all — never a zero, because a zero here would
 * read as "this costs nothing".
 */
export const numeric = (
    value: string | number | null | undefined,
): number | null => {
    if (value == null) return null;
    const parsed =
        typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
};

/** The unit and the figure together, e.g. "₹24,000", or an em dash. */
export const sum = (
    unit: string,
    value: string | number | null | undefined,
): string => {
    const parsed = numeric(value);
    return parsed == null ? "—" : money(unit, parsed);
};
