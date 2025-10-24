// Utilities

import { COLORS } from './constants.js';

export function createGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

export function randChoice(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

export function makePair() {
  return { a: randChoice(COLORS), b: randChoice(COLORS) };
}

export function offsetsForOri(ori) {
  switch (ori & 3) {
    case 0: return { ox: 0, oy: -1 }; // up
    case 1: return { ox: 1, oy: 0 };  // right
    case 2: return { ox: 0, oy: 1 };  // down
    case 3: return { ox: -1, oy: 0 }; // left
  }
}