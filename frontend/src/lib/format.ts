const CURRENCY = "INR";
const LOCALE = "en-IN";

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });

export const formatMoney = (cents: number) => money.format(cents / 100);

/** "45.5" -> 4550. Returns null for anything that isn't a non-negative amount with up to 2 decimals. */
export function parseMoney(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export const centsToInput = (cents: number) => (cents === 0 ? "" : (cents / 100).toString());
