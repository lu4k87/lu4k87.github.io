// Station 02E2: Deimos (Einheit 1 km), Abstecher von Mars & Monde – Baustein createMarsMoon (phobos.js). Halbachsen 7,8 × 5,1
// × 6,0 km (NSSDCA); glatter als Phobos: flache Krater, größter ≈ 2,3 km, keine Rillen, Staubmantel (NASA). Mars steht rund
// 17° breit am Himmel, ein Umlauf dauert 30,3 Stunden.

import { createMarsMoon } from './phobos.js';

export const DEIMOS = {
  id: 'deimos', name: 'Deimos', exposure: 1.1, spdIdx: 3,
  speeds: [[0, 'Echtzeit'], [1 / 1440, '1 min/s'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s']],
  homeDist: 30, homeAz: 16, homeMix: 0.35, feat: 1.2, soft: 0.22, base: [0.074, 0.058, 0.047],
  grooves: false, grooveSets: [[90, 0, 1], [90, 0, 1], [90, 0, 1], [90, 0, 1]],
  stick: null,
  spots: [['regolith', 20, 30, 14], ['craters', -25, -120, 14]],
  horizon: [0, 76, 0.03, 12],
};

export function create(ctx) {
  return createMarsMoon(ctx, DEIMOS);
}
