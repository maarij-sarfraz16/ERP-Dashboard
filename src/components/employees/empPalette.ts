const CYCLE = ["var(--emp-moss)", "var(--emp-plum)", "var(--emp-coral)", "var(--emp-gold)"];

export function colorForIndex(i: number): string {
  return CYCLE[i % CYCLE.length];
}

export function opacityForIndex(i: number): number {
  return i < CYCLE.length ? 1 : 0.62;
}
