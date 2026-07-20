export function escapeCsv(value: string | number): string {
  const text = protectSpreadsheetCell(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function protectSpreadsheetCell(value: string): string {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}
