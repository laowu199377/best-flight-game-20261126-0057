// A small seeded random source: the same seed always deals the same track,
// the same rings and the same hills, so a screenshot staged from a seed is
// the same frame every time it is taken.

/** A mulberry32 generator: four bytes of state, one float per call. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Next integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** Pick one entry from a list. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
