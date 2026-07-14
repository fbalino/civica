/**
 * RFC-4180 cell encoding plus spreadsheet formula neutralization.
 *
 * True numeric values stay numeric (so a legitimate -12 remains a number).
 * String values that spreadsheet programs can reinterpret as formulas are
 * prefixed with an apostrophe before CSV quoting. The original text remains
 * visible while Excel/LibreOffice/Sheets treat it as text.
 */
const FORMULA_BOUNDARY =
  /(^|[,;\t])([\uFEFF\u0009\u000A\u000D ]*)([=+\-@\uFF1D\uFF0B\uFF0D\uFF20])/gu;

export function spreadsheetSafeCsvCell(value: unknown): string {
  const isString = typeof value === "string";
  let text =
    value == null ? "" : isString ? value : (JSON.stringify(value) ?? "");
  if (isString) text = text.replace(FORMULA_BOUNDARY, "$1'$2$3");
  return /[",;\t\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
