// Station 02G1: Miranda, innerster und kleinster der fünf großen Uranusmonde (Einheit 1 Miranda-Radius = 235,7 km, Mittel der
// Halbachsen), Abstecher von Uranus & Monde. Mondfest (uranusmoon.js): Uranus steht über dem Längengrad 0 still und misst rund
// 23° am Himmel, Sonne und Sterne ziehen in 1,41 Tagen einmal herum. Körper als Ellipsoid 240 × 232,9 × 234,2 km (zu Uranus ×
// Pol × Bahnrichtung, NSSDCA). Karte: NASA 3D Resources aus Voyager-2-Bildern, nur die Südhälfte gesehen (Maske miranda_seen.png);
// Abzeichen an den Coronae und Verona Rupes nach dem USGS-Gazetteer.

import { createUranusMoon } from '../uranusmoon.js';

export function create(ctx) {
  return createUranusMoon(ctx, {
    id: 'miranda', name: 'Miranda', km: 235.7, axes: [240, 232.9, 234.2], tex: 'miranda.jpg', seen: 'miranda_seen.png',
    // Gazetteer (planetozentrisch, Länge Ost): id, Breite, Länge, Fokusabstand [Radien]
    spots: [['inverness', -66.9, 325.7, 1.2], ['arden', -29.1, 73.7, 1.3], ['elsinore', -24.8, 257.1, 1.3], ['verona', -18.3, 347.8, 0.7]],
    horizon: [-25, -80],   // Standpunkt „Uranus am Horizont“: die Planetenmitte steht dort rund 9° über dem Horizont
    north: [55, 0],
  });
}
