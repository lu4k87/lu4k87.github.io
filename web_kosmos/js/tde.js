// Gezeitenzerriss eines Sterns an einem Schwarzen Loch – Rechenkern ohne three.js (Station sgra, Test tests/tde.test.js).
// Einheiten: Schwarzschild-Radius Rs = 1, c = 1 → GM = 1/2, Zeit in Rs/c; t = 0 ist der Durchgang des Sterns durch das
// Perizentrum. Bahnen als zeitartige Geodäten der Schwarzschild-Metrik in der Bahnebene (E, L erhalten):
//   dt/dτ = E/(1 − 1/r), dr/dτ = u, du/dτ = −M/r² + L²/r³ − 3ML²/r⁴, dφ/dτ = L/r²
// – Periheldrehung, Selbstkreuzung des Stroms und Einfang folgen daraus ohne Zusatzannahme.
// Zerriss: Schwerpunkt auf einer Parabelbahn (E = 1) mit Perizentrum rp = rt/β. Beim Durchgang durch den Gezeitenradius
// rt = R*·(M/m)^⅓ (Rees 1988) zerfällt der Stern in n Stücke entlang des Radius, jedes mit der Geschwindigkeit des
// Schwerpunkts („eingefroren“: Energiestreuung ≈ GM·R*/rt², nahezu unabhängig von β, Stone, Sari & Loeb 2013). Jedes Stück
// fliegt ballistisch; gebundene kehren zurück, laufen ein zweites Mal durch das Perizentrum und treffen eine halbe Drehung
// später auf den nachfolgenden Strom (Kreuzung durch die Periheldrehung, Hayasaki, Stone & Loeb 2016) – ab da zählt ihre
// Masse als Rückfall. Leuchtkraft aus der Rückfallrate (Wirkungsgrad η), über der Eddington-Grenze logarithmisch gedämpft.
// Szene: Bahnebene = Scheibenebene y = 0, Umlauf im Sinn der Scheibe (Winkel atan(z, x) nimmt ab), Perizentrum bei −x.

import { G, C, M_SUN, R_SUN, DAY } from './astro.js';

const M = 0.5;                    // GM in Rs·c²
const SIGMA = 5.670374419e-8;     // Stefan-Boltzmann [W m⁻² K⁻⁴]
const L_EDD_SUN = 1.26e31;        // Eddington-Leuchtkraft je Sonnenmasse [W] (Elektronenstreuung, Wasserstoff)
export const MAXP = 512;          // Punkte der Strom-Linie (Breite der Daten-Textur)
export const GRP = 16;            // Punkte je Gruppe (Hüllkreis zum Überspringen im Shader)

function deriv(s, E, L, o) {
  const r = s[1], r2 = r * r;
  o[0] = E / (1 - 1 / r);
  o[1] = s[3];
  o[2] = L / r2;
  o[3] = -M / r2 + (L * L) / (r2 * r) - (3 * M * L * L) / (r2 * r2);
}
// ein RK4-Schritt der Länge h (Eigenzeit) auf s = [t, r, φ, u]
function rk4(s, E, L, h, w) {
  const [k1, k2, k3, k4, y] = w;
  deriv(s, E, L, k1);
  for (let i = 0; i < 4; i++) y[i] = s[i] + 0.5 * h * k1[i];
  deriv(y, E, L, k2);
  for (let i = 0; i < 4; i++) y[i] = s[i] + 0.5 * h * k2[i];
  deriv(y, E, L, k3);
  for (let i = 0; i < 4; i++) y[i] = s[i] + h * k3[i];
  deriv(y, E, L, k4);
  for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
const work = () => [0, 0, 0, 0, 0].map(() => new Float64Array(4));

// Bahn ab Zustand s0 bis Abbruch; speichert t, r, φ und die Koordinaten-Geschwindigkeiten dr/dt, r·dφ/dt.
// fate: 'join' (zweites Perizentrum + halbe Drehung = Kreuzung), 'swallow' (Horizont), 'free' (r > rOut, fliegt weg),
// 'open' (tMax erreicht)
export function fly(s0, E, L, { tMax, rOut = 8000, acc = 0.01, join = true } = {}) {
  const s = Float64Array.from(s0), w = work(), d = new Float64Array(4);
  const T = [], R = [], P = [], VR = [], VP = [];
  let peri = 0, pPh = 0, fate = 'open', phJ = 0;
  const push = () => {
    deriv(s, E, L, d);
    T.push(s[0]); R.push(s[1]); P.push(s[2]); VR.push(d[1] / d[0]); VP.push((s[1] * d[2]) / d[0]);
  };
  push();
  for (let i = 0; i < 400000; i++) {
    const u0 = s[3];
    rk4(s, E, L, acc * Math.pow(s[1], 1.5), w);
    if (u0 < 0 && s[3] >= 0) { peri++; pPh = s[2]; }
    push();
    if (s[1] < 1.02) { fate = 'swallow'; break; }
    if (s[1] > rOut && s[3] > 0) { fate = 'free'; break; }
    if (s[0] > tMax) break;
    if (join && peri >= 2 && s[2] - pPh >= Math.PI) { fate = 'join'; phJ = s[2]; break; }
  }
  return { t: Float64Array.from(T), r: Float32Array.from(R), ph: Float64Array.from(P), vr: Float32Array.from(VR), vp: Float32Array.from(VP), fate, tEnd: s[0], phJ, peri };
}

// Index i mit a[i] ≤ x < a[i+1] (a aufsteigend)
function seek(a, x) {
  let lo = 0, hi = a.length - 1;
  if (x <= a[0]) return 0;
  if (x >= a[hi]) return hi - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m; else hi = m; }
  return lo;
}
// Zustand einer Bahn bei Zeit t bzw. Winkel φ (linear zwischen den Stützstellen)
function at(b, key, x, o) {
  const a = b[key], i = Math.max(0, Math.min(seek(a, x), a.length - 2)), f = Math.max(0, Math.min(1, (x - a[i]) / (a[i + 1] - a[i] || 1)));
  o.r = b.r[i] + (b.r[i + 1] - b.r[i]) * f;
  o.ph = b.ph[i] + (b.ph[i + 1] - b.ph[i]) * f;
  o.vr = b.vr[i] + (b.vr[i + 1] - b.vr[i]) * f;
  o.vp = b.vp[i] + (b.vp[i + 1] - b.vp[i]) * f;
  return o;
}

// Modell eines Zerrisses. mBH, mStar in Sonnenmassen, rStar in Sonnenradien.
export function tdeModel({ mBH = 4.297e6, mStar = 1, rStar = 1, beta = 2, n = 160, years = 12, eta = 0.1 } = {}) {
  const Rs = (2 * G * mBH * M_SUN) / (C * C), tu = Rs / C;
  const day = DAY / tu, year = 365.25 * day;
  const rs = (rStar * R_SUN) / Rs;
  const rt = rs * Math.cbrt(mBH / mStar);
  const rp = rt / beta;
  const dE = (M * rs) / (rt * rt);            // Newtonsche Schätzung der Energiestreuung
  const tMax = years * year;
  // Schwerpunkt: E = 1 mit Perizentrum rp → L² = rp²/(rp − 1); Start weit draußen, einlaufend
  const Lc = Math.sqrt((rp * rp) / (rp - 1));
  const uAt = (r, E, L) => -Math.sqrt(Math.max(0, E * E - (1 - 1 / r) * (1 + (L * L) / (r * r))));
  const r0 = 420;
  const cm = fly([0, r0, 0, uAt(r0, 1, Lc)], 1, Lc, { tMax: 1e7, rOut: r0 + 1, acc: 0.004, join: false });
  // Perizentrum (u = 0) und Durchgang durch rt (einlaufend) auf der Bahn des Schwerpunkts
  let ip = 0;
  for (let i = 1; i < cm.r.length; i++) if (cm.r[i] < cm.r[ip]) ip = i;
  const tP = cm.t[ip], phP = cm.ph[ip];
  let id = 0;
  while (id < ip && cm.r[id + 1] > rt) id++;
  const fd = (cm.r[id] - rt) / (cm.r[id] - cm.r[id + 1]);
  const lerp = (a, i, f) => a[i] + (a[i + 1] - a[i]) * f;
  const tD = lerp(cm.t, id, fd) - tP, phD = lerp(cm.ph, id, fd), vrD = lerp(cm.vr, id, fd), vpD = lerp(cm.vp, id, fd);
  cm.t = cm.t.map((t) => t - tP);
  // Stücke entlang des Radius, Masse nach (1 − x²)^1,5 (Modell eines zentral verdichteten Sterns)
  const pieces = [];
  let mSum = 0;
  for (let k = 0; k < n; k++) {
    const x = -1 + (2 * k + 1) / n, r = rt + x * rs, f = 1 - 1 / r;
    // gleicher Geschwindigkeitsvektor wie der Schwerpunkt: dr/dt = vrD, r·dφ/dt = vpD
    const vphi = vpD / r;
    const dtdtau = 1 / Math.sqrt(f - (vrD * vrD) / f - vpD * vpD);
    const E = f * dtdtau, L = r * r * vphi * dtdtau, u = vrD * dtdtau;
    const m = Math.pow(1 - x * x, 1.5);
    mSum += m;
    const b = fly([tD, r, phD, u], E, L, { tMax });
    b.E = E; b.L = L; b.m = m; b.x = x;
    pieces.push(b);
  }
  for (const b of pieces) b.m *= mStar / mSum;
  // Rückkehr des am stärksten gebundenen Stücks (Kepler-Umlauf mit seiner Energie; nahe rt ist sie um einige Prozent
  // kleiner als die Newtonsche Schätzung dE)
  const aMin = M / (2 * (1 - pieces[0].E));
  const tMin = 2 * Math.PI * Math.sqrt(aMin ** 3 / M);
  // Szene: θ = φ + φ0, Perizentrum des Schwerpunkts bei θ = π (−x); x = r cos θ, z = −r sin θ
  const ph0 = Math.PI - phP;
  const toScene = (r, ph, vr, vp, o) => {
    const th = ph + ph0, c = Math.cos(th), s = Math.sin(th);
    o.x = r * c; o.z = -r * s; o.vx = vr * c - vp * s; o.vz = -vr * s - vp * c;
    return o;
  };
  // Rückfall: Zeitpunkte, an denen gebundene Stücke die Kreuzung erreichen, kumulierte Masse → Rate
  const joins = pieces.filter((b) => b.fate === 'join').sort((a, b) => a.tEnd - b.tEnd);
  const tJ = joins.map((b) => b.tEnd), mJ = [];
  joins.reduce((s, b) => { mJ.push(s + b.m); return s + b.m; }, 0);
  const tFirst = tJ.length ? tJ[0] : Infinity;
  // Rate [M☉ je Rs/c] über ein Fenster von je drei Stücken (glättet die Quantisierung der Stücke)
  const mdot = (t) => {
    if (tJ.length < 4 || t < tFirst) return 0;
    const i = Math.min(seek(tJ, t), tJ.length - 2);
    const a = Math.max(0, i - 1), b = Math.min(tJ.length - 1, i + 2);
    const rate = (mJ[b] - mJ[a]) / (tJ[b] - tJ[a]);
    return t > tJ[tJ.length - 1] ? rate * Math.pow(t / tJ[tJ.length - 1], -5 / 3) : rate;
  };
  const LEdd = L_EDD_SUN * mBH;
  const mdotEdd = (LEdd / (eta * C * C)) / M_SUN * tu;   // M☉ je Rs/c
  const lum = (t) => {
    const x = mdot(t) / mdotEdd;
    return LEdd * (x < 1 ? x : 1 + Math.log(x));
  };
  // Höhepunkt der Leuchtkraft (Suche in log t)
  let tPk = tFirst, Lpk = 0;
  if (Number.isFinite(tFirst)) for (let k = 0; k <= 400; k++) {
    const t = tFirst * Math.pow(30, k / 400), L = lum(t);
    if (L > Lpk) { Lpk = L; tPk = t; }
  }
  // Kreuzungspunkt: Mittel über die ersten Rückkehrer (Ort bei Abbruch)
  const cross = { x: 0, z: 0, r: 0 };
  const firstJ = joins.slice(0, 8), tmp = {};
  for (const b of firstJ) {
    const i = b.r.length - 1;
    toScene(b.r[i], b.ph[i], 0, 0, tmp);
    cross.x += tmp.x / firstJ.length; cross.z += tmp.z / firstJ.length;
  }
  cross.r = Math.hypot(cross.x, cross.z);
  // Temperatur des Stroms: Eigenwärme kühlt nach dem Zerriss ab – Gas aus dem Inneren des Sterns (Mitte der Lagrange-
  // Koordinate lag) startet heißer als die Oberfläche (Enden) –, Einstrahlung des Rückfalls heizt (Gleichgewicht einer
  // Fläche im Abstand r: T⁴ = L/(16πσr²)); Modell
  const tempAt = (r, t, L, lag = 0) => {
    const dt = Math.max(0, t - tD), core = 1 - (2 * lag - 1) ** 2;
    const tint = 2800 + 3700 * Math.pow(1 + dt / day, -0.5) + 9000 * core * Math.pow(1 + dt / (0.05 * day), -0.7);
    const rm = r * Rs, tirr4 = L / (16 * Math.PI * SIGMA * rm * rm);
    return Math.pow(tint ** 4 + tirr4, 0.25);
  };

  // Schwerpunkt vor dem Zerriss: Ort, Geschwindigkeit, Streckung entlang des Radius (wächst zum Gezeitenradius)
  const star = (t, o = {}) => {
    const s = at(cm, 't', Math.min(t, tD), {});
    toScene(s.r, s.ph, s.vr, s.vp, o);
    o.r = s.r;
    o.stretch = 1 + 0.4 * Math.pow(Math.min(1, rt / s.r), 3);   // Modell: am Gezeitenradius 1,4-fach gestreckt
    return o;
  };

  // Strom-Linie zur Zeit t in buf (MAXP × 8: x, z, Halbbreite, log₁₀ Linien-Dichte relativ zum Stern | vx, vz, T, Lagrange-Koordinate) und Hüllkreise je
  // GRP Punkte in grp (x, z, Radius, 0); gibt die Punktzahl zurück. wScale: Breite überhöht
  const st = {}, sa = {}, sb = {}, sc = {};
  const stream = (t, buf, grp, wScale = 1) => {
    if (t < tD) return 0;
    const L = lum(t);
    const act = [];
    for (let k = 0; k < n; k++) {
      const b = pieces[k];
      if (t > b.tEnd && b.fate !== 'free') continue;
      // Spitze: das zuletzt an der Kreuzung angekommene Stück bleibt dort als Anker – das Gas zwischen ihm und dem ersten
      // noch fliegenden Stück liegt auf dem Weg dazwischen (sonst endete der Strom weit vor dem Loch)
      if (!act.length && k > 0 && pieces[k - 1].fate === 'join') {
        const p = pieces[k - 1], i = p.r.length - 1;
        act.push({ r: p.r[i], ph: p.ph[i], vr: p.vr[i], vp: p.vp[i], k: k - 1 });
      }
      let s;
      if (t <= b.tEnd) s = at(b, 't', t, {});
      else {
        // weit draußen fast geradlinig: vom letzten Punkt mit der letzten Geschwindigkeit weiter (in der Bahnebene)
        const i = b.r.length - 1, dt = t - b.tEnd, c = Math.cos(b.ph[i]), sn = Math.sin(b.ph[i]);
        const vx = b.vr[i] * c - b.vp[i] * sn, vy = b.vr[i] * sn + b.vp[i] * c;
        const X = b.r[i] * c + vx * dt, Y = b.r[i] * sn + vy * dt, r = Math.hypot(X, Y);
        const dph = Math.atan2(Y * c - X * sn, X * c + Y * sn);
        s = { r, ph: b.ph[i] + dph, vr: (vx * X + vy * Y) / r, vp: (X * vy - Y * vx) / r };
      }
      s.k = k;
      act.push(s);
    }
    if (act.length < 2) return 0;
    // Zwischenpunkte, wo benachbarte Stücke weit auseinander laufen (am Perizentrum): entlang der Bahnen beider Stücke
    // am gleichen Winkel, gewichtet nach der Lage dazwischen
    const pts = [];
    const addPt = (r, ph, vr, vp, lag, m) => { pts.push({ r, ph, vr, vp, lag, m }); };
    let res = 0.03;
    const need = () => act.reduce((s, a, i) => (i ? s + Math.min(64, Math.floor(Math.abs(a.ph - act[i - 1].ph) / res)) : s), act.length);
    while (need() > MAXP && res < 1) res *= 1.5;
    for (let i = 0; i < act.length; i++) {
      const a = act[i];
      if (i) {
        const p = act[i - 1], m = Math.min(64, Math.floor(Math.abs(a.ph - p.ph) / res));
        const bp = pieces[p.k], ba = pieces[a.k];
        for (let j = 1; j <= m; j++) {
          const w = j / (m + 1), ph = p.ph + (a.ph - p.ph) * w;
          const inP = ph >= bp.ph[0] && ph <= bp.ph[bp.ph.length - 1], inA = ph >= ba.ph[0] && ph <= ba.ph[ba.ph.length - 1];
          const A = inP ? at(bp, 'ph', ph, sa) : null, B = inA ? at(ba, 'ph', ph, sb) : null;
          const r = A && B ? A.r * (1 - w) + B.r * w : A ? A.r : B ? B.r : p.r * (1 - w) + a.r * w;
          const vr = A && B ? A.vr * (1 - w) + B.vr * w : A ? A.vr : B ? B.vr : p.vr;
          const vp = A && B ? A.vp * (1 - w) + B.vp * w : A ? A.vp : B ? B.vp : p.vp;
          addPt(r, ph, vr, vp, (p.k + w * (a.k - p.k)) / (n - 1), -1);
        }
      }
      addPt(a.r, a.ph, a.vr, a.vp, a.k / (n - 1), pieces[a.k].m);
    }
    // Szene, Abstände; zu dichte Punkte ausdünnen (unter 0,3 Halbbreiten)
    const sc2 = [];
    for (const p of pts) {
      toScene(p.r, p.ph, p.vr, p.vp, sc);
      const h = wScale * rs * Math.sqrt(Math.max(1, p.r / rt));
      const q = { x: sc.x, z: sc.z, vx: sc.vx, vz: sc.vz, h, r: p.r, lag: p.lag, m: p.m };
      const last = sc2[sc2.length - 1];
      if (last && Math.hypot(q.x - last.x, q.z - last.z) < 0.3 * h && p !== pts[pts.length - 1]) { if (q.m > 0) last.m = (last.m > 0 ? last.m : 0) + q.m; continue; }
      sc2.push(q);
    }
    const N = Math.min(MAXP, sc2.length);
    // Linien-Dichte: Masse der Stücke über den Abstand zu den Nachbarn verteilt, Zwischenpunkte interpoliert
    const lam = new Float32Array(N);
    let lastI = -1;
    for (let i = 0; i < N; i++) {
      const q = sc2[i];
      if (q.m > 0) {
        const a = sc2[Math.max(0, i - 1)], c = sc2[Math.min(N - 1, i + 1)];
        lam[i] = q.m / Math.max(1e-6, 0.5 * (Math.hypot(q.x - a.x, q.z - a.z) + Math.hypot(c.x - q.x, c.z - q.z)));
        if (lastI >= 0) for (let j = lastI + 1; j < i; j++) lam[j] = lam[lastI] + ((lam[i] - lam[lastI]) * (j - lastI)) / (i - lastI);
        else for (let j = 0; j < i; j++) lam[j] = lam[i];
        lastI = i;
      }
    }
    for (let j = lastI + 1; j < N; j++) lam[j] = lastI >= 0 ? lam[lastI] : 0;
    // Dichte relativ zum frisch zerrissenen Stern (Masse über den Durchmesser)
    const lam0 = mStar / (2 * rs);
    for (let i = 0; i < N; i++) {
      const q = sc2[i], o = i * 4, o2 = (MAXP + i) * 4;
      buf[o] = q.x; buf[o + 1] = q.z; buf[o + 2] = q.h; buf[o + 3] = Math.log10(Math.max(1e-12, lam[i] / lam0));
      buf[o2] = q.vx; buf[o2 + 1] = q.vz; buf[o2 + 2] = tempAt(q.r, t, L, q.lag); buf[o2 + 3] = q.lag;
    }
    // Hüllkreise je Gruppe (Segment i…i+1 liegt in Gruppe ⌊i/GRP⌋, daher Punkt GRP·(g+1) mit hinein)
    for (let g = 0; g < MAXP / GRP; g++) {
      const i0 = g * GRP, i1 = Math.min(N - 1, i0 + GRP);
      if (i0 >= N - 1) { grp[g * 4 + 2] = -1; continue; }
      let mx = 0, mz = 0;
      for (let i = i0; i <= i1; i++) { mx += buf[i * 4]; mz += buf[i * 4 + 1]; }
      mx /= i1 - i0 + 1; mz /= i1 - i0 + 1;
      let rad = 0;
      for (let i = i0; i <= i1; i++) rad = Math.max(rad, Math.hypot(buf[i * 4] - mx, buf[i * 4 + 1] - mz) + 3.5 * buf[i * 4 + 2]);
      grp[g * 4] = mx; grp[g * 4 + 1] = mz; grp[g * 4 + 2] = rad;
    }
    return N;
  };

  // Ort eines Stücks (Szene) zur Zeit t – für Abzeichen am Strom
  const piece = (k, t, o = {}) => {
    const b = pieces[k];
    const s = at(b, 't', Math.min(Math.max(t, b.t[0]), b.tEnd), st);
    return toScene(s.r, s.ph, s.vr, s.vp, o);
  };

  return {
    Rs, tu, day, year, rs, rt, rp, beta, dE, aMin, tMin, tD, tFirst, tPk, Lpk, LEdd, mdotEdd, eta, cross, pieces, cm,
    star, stream, piece, mdot, lum, tempAt,
    // Anteile: gebunden / ungebunden / verschluckt (Masse)
    share: () => {
      const s = { bound: 0, free: 0, swallow: 0 };
      for (const b of pieces) s[b.E < 1 ? (b.fate === 'swallow' ? 'swallow' : 'bound') : b.fate === 'swallow' ? 'swallow' : 'free'] += b.m;
      return s;
    },
  };
}
