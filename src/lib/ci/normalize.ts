export function normalize(
  raw: number,
  globalMin: number,
  globalMax: number,
  inverted: boolean
): number {
  if (globalMax === globalMin) return 50;
  if (inverted) {
    return ((globalMax - raw) / (globalMax - globalMin)) * 100;
  }
  return ((raw - globalMin) / (globalMax - globalMin)) * 100;
}

export function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export function yearToQuarter(year: number): string {
  return `${year}-Q4`;
}
