export function normalizeIntegerInput(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}
