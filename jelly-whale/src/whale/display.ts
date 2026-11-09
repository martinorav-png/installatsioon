import type { SoftWhale } from './physics';

export function applyDisplayHop(soft: SoftWhale, hop: number) {
  const side = hop % 2 ? 1 : -1;
  soft.speedLimit = 5;
  soft.impulse(Math.sin(hop * 1.7) * .18, 4.4, Math.cos(hop * 1.3) * .14);
  // Opposing head and tail kicks bend and roll the body through the hop.
  soft.impulse(.12 * side, 1.6, .8 * side, [-1.3, .8, 0]);
  soft.impulse(-.1 * side, -.6, -.6 * side, [2.1, .4, 0]);
}
