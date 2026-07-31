/**
 * Deterministic PRNG (mulberry32).
 * Same seed → same sequence of numbers. Critical for reproducible runs.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded RNG helper — pick from array, roll dice, chance checks.
 */
export class RNG {
  private next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Random float in [0, 1) */
  float(): number {
    return this.next();
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick N unique elements from an array */
  pickN<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr];
    const result: T[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(this.next() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  /** True with probability `chance` (0-1) */
  chance(chance: number): boolean {
    return this.next() < chance;
  }

  /** Roll a single die (1-size) */
  die(size: number): number {
    return Math.ceil(this.next() * size);
  }

  /** Roll multiple dice, return sum */
  dice(count: number, size: number): number {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += this.die(size);
    }
    return sum;
  }

  /** Generate a new seed (for sub-generators) */
  reseed(): number {
    return Math.floor(this.next() * 2 ** 31);
  }
}

/** Generate a random seed for a new run */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
