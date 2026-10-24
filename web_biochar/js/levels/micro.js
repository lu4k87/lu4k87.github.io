// Ebene 6: turbostratischer Kohlenstoff (Einheit nm) – gewellte Graphen-Schichten in kleinen Stapeln,
// Mikroporen dazwischen, Gasmoleküle. Größe und Ordnung folgen der Pyrolysetemperatur (science.js).

import * as THREE from 'three';
import { mulberry32, gauss, clamp } from '../util.js';
import { nanoStructure, fmt, pyroState } from '../science.js';
import { ADDITIVE } from '../sem.js';

const HALF = new THREE.Vector3(5.5, 3.6, 4.2);

// Rand der Schicht (lokal, Radius 0,5 = halber Durchmesser): leicht gewellt, je Schicht anders – gleich in beiden Shadern
const RIM_GLSL = /* glsl */ `
float rimR(float ang, float seed) {
  return 0.5 * (0.86 + 0.08 * sin(ang * 5.0 + seed * 20.0) + 0.06 * sin(ang * 9.0 + seed * 7.0));
}
`;

// Schicht als dünne Platte (Dicke ≈ 0,14 nm, Atomdurchmesser): Ober-/Unterseite mit Gitter, Randband als Schichtdicke.
// Form: Schale bzw. Sattel plus eine dreizählige Wellung (Fünf- und Siebenringe verstreut, Harris-Modell); Wellung je Stapel
// gleich, damit die Schichten eines Stapels parallel bleiben.
const SHEET_VERT = /* glsl */ `
attribute vec4 aSheet;     // Krümmung, Sattel/Schale (Vorzeichen −/+) mit Wellungs-Seed (|y| − 1), Durchmesser nm, Seed
attribute vec2 aPart;      // Seite (+1 oben, −1 unten), 1 = Randband
varying vec2 vLocal;
varying vec4 vSheet;
varying vec3 vN;
varying vec3 vWorld;
varying float vView;
varying float vBand;
${RIM_GLSL}
void main() {
  vec3 p = position;
  float ang = atan(p.y, p.x);
  if (aPart.y > 0.5) p.xy = vec2(cos(ang), sin(ang)) * rimR(ang, aSheet.w);
  float hw = 0.07 / aSheet.z;          // halbe Dicke in lokalen Einheiten ("half" ist in GLSL reserviert)
  float s = sign(aSheet.y), ws = abs(aSheet.y) - 1.0;
  float phi = ws * 6.2832, a3 = aSheet.x * (ws - 0.5) * 1.6;
  vec2 cs = vec2(cos(phi), sin(phi));
  vec2 r = vec2(cs.x * p.x + cs.y * p.y, -cs.y * p.x + cs.x * p.y);
  float fu = 3.0 * (r.x * r.x - r.y * r.y), fv = -6.0 * r.x * r.y;
  vec2 g = vec2(2.0 * aSheet.x * p.x, 2.0 * aSheet.x * s * p.y) + a3 * vec2(fu * cs.x - fv * cs.y, fu * cs.y + fv * cs.x);
  p.z = aSheet.x * (p.x * p.x + s * p.y * p.y) + a3 * (r.x * r.x * r.x - 3.0 * r.x * r.y * r.y) + aPart.x * hw;
  vec3 n = aPart.y > 0.5 ? normalize(vec3(p.xy, 0.0)) : aPart.x * normalize(vec3(-g, 1.0));
  vLocal = p.xy;
  vSheet = aSheet;
  vBand = aPart.y;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vec4 mv = viewMatrix * wp;
  vView = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const SHEET_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uFogStart;
varying vec2 vLocal;
varying vec4 vSheet;
varying vec3 vN;
varying vec3 vWorld;
varying float vView;
varying float vBand;
${RIM_GLSL}
float hexDist(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec4 hexCoords(vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(uv, uv - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(uv - hC.xy * s, uv - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
}
// Gegen Flackern bei der Kamerafahrt (Muster wie aaBand in sem.js): Bindungen, Atome und Randsaum nie schmaler als
// ≈ 2 Bildpunkte zeichnen, sondern um k breiter (Deckung für discard) und um k schwächer (Helligkeit).
// k für eine Form der Breite w bei Bildpunkt fw (beides in denselben Einheiten)
float widen(float w, float fw) { return max(1.0, 2.0 * fw / w); }
// Deckung eines Saums: voll bis a, weich bis b (Abstand d), um k verbreitert
float band(float d, float a, float b, float k, float aa) { return 1.0 - smoothstep(a * k - aa, b * k + aa, d); }
void main() {
  // Gitterkonstante 0,246 nm, C–C 0,142 nm; je Schicht verdreht und verschoben (turbostratisch: ohne ABAB-Folge)
  float tw = vSheet.w * 6.2832;
  vec2 uv = mat2(cos(tw), sin(tw), -sin(tw), cos(tw)) * vLocal * vSheet.z / 0.246 + vSheet.w * 13.0;
  // Bildpunkt in Gitter-Einheiten, auch schräg gesehen (fwidth(uv.x) allein übersah die Stauchung quer dazu);
  // vor jedem discard/if: Ableitungen nur im gleichförmigen Ablauf
  float fw = 0.71 * length(fwidth(uv));
  float aa = fw * 0.9;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vN);
  float facing = abs(dot(N, V));
  float fog = exp(-max(vView - uFogStart, 0.0) * 0.16);
  float lit = 0.72 + 0.32 * abs(dot(N, uLight));
  if (vBand > 0.5) {
#ifdef SHEET_FILL
    discard;
#endif
    // Randband = sichtbare Schichtdicke, hell im Streiflicht
    vec3 col = uColor * (0.26 + 0.3 * (1.0 - facing)) * lit * fog;
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    return;
  }
  float r = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x);
  float rim = rimR(ang, vSheet.w);
  // Randatome als Buckel: Abstand ≈ 0,25 nm entlang des Randes, Höhe 0,05 nm ≈ 0,2 Gitter-Einheiten –
  // unter ≈ 2 Bildpunkten Höhe gleitet der Rand zur glatten Kante (mittlere Lage bleibt)
  float nb = max(6.0, floor(6.2832 * rim * vSheet.z / 0.25));
  float bump = mix(0.5, 0.5 + 0.5 * cos(ang * nb + vSheet.w * 40.0), smoothstep(0.2, 0.1, fw));
  float rimB = rim + (0.05 / vSheet.z) * bump;
  if (r > rimB) discard;
  vec4 hc = hexCoords(uv);
  float e = 0.5 - hexDist(hc.xy);
  vec2 q = abs(hc.xy);
  float dv = min(length(q - vec2(0.5, 0.288675)), length(q - vec2(0.0, 0.57735)));
  float kb = widen(0.105, fw), ka = widen(0.21, fw);   // Bindung ≈ 0,105, Atom ≈ 0,21 Gitter-Einheiten breit
  float bond = band(e, 0.045, 0.06, kb, aa);
  float atom = band(dv, 0.09, 0.12, ka, aa);
  // Fünf- und Siebenringe – Ursache der Krümmung (Harris et al. 2008, Allen et al. 2022: zufällig im Sechseckgitter verteilt).
  // In der Mitte passend zur Form (Schale: Fünfring, Sattel: Siebenring), dazu je nach Fläche bis zu zwei weitere, Fünf- zu
  // Siebenring ≈ 2 : 1 wie im Modell von Wood et al. (2023); dort sind es mehr (≈ 1 Fünfring je 5 Sechsringe) – hier weniger,
  // damit das Sechseckgitter lesbar bleibt.
  float warm = 0.0;
  float nDef = clamp(floor(vSheet.z * vSheet.z * 0.9), 1.0, 3.0);
  for (int i = 0; i < 3; i++) {
    if (float(i) >= nDef) break;
    float fi = float(i);
    float h1 = fract(sin(vSheet.w * 91.7 + fi * 3.1) * 4375.85), h2 = fract(sin(vSheet.w * 47.3 + fi * 1.7) * 2317.13);
    vec2 cen = i == 0 ? vec2(0.0) : (0.27 + 0.06 * h1) * vec2(cos(h2 * 0.8 + fi * 2.094 + vSheet.w * 9.0), sin(h2 * 0.8 + fi * 2.094 + vSheet.w * 9.0));
    float nRing = i == 0 ? (vSheet.y > 0.0 ? 5.0 : 7.0) : (h1 < 0.67 ? 5.0 : 7.0);
    float seg = 6.2832 / nRing;
    vec2 u0 = (vLocal - cen) * vSheet.z / 0.246;
    float rr = length(u0), a0 = atan(u0.y, u0.x);
    float RN = 0.5774 / (2.0 * sin(3.14159 / nRing));
    float zone = 1.0 - smoothstep(RN + 0.25, RN + 0.5, rr);
    float ak = floor(a0 / seg + 0.5) * seg;
    float dA = length(u0 - RN * vec2(cos(ak), sin(ak)));
    float dE = abs(rr * cos(mod(a0, seg) - seg * 0.5) - RN * cos(seg * 0.5));
    float ringBond = band(dE, 0.045, 0.06, kb, aa) * (1.0 - smoothstep(RN * 0.6, RN * 0.75, abs(rr - RN * 0.9)));
    float ringAtom = band(dA, 0.09, 0.12, ka, aa);
    bond = mix(bond * (1.0 - zone), ringBond, zone);
    atom = mix(atom * (1.0 - zone), ringAtom, zone);
    warm = max(warm, zone * max(ringBond, ringAtom));
  }
  // aus der Ferne und schräg: Fläche statt Gitter, bevor die Löcher zwischen den Bindungen unter 2 Bildpunkte fallen
  float detail = smoothstep(0.3, 0.16, fw);
  float m = mix(0.55, max(bond * 0.8, atom), detail);
#ifdef SHEET_FILL
  // Löcher zwischen den Bindungen: je feiner das Gitter auf dem Bild, desto mehr füllt sie ein Schleier in Bindungsfarbe –
  // weniger Kontrast an den harten discard-Kanten (MSAA glättet sie nicht); in der Standardansicht (fw ≈ 0,05) unverändert
  float veil = m < 0.35 ? smoothstep(0.07, 0.2, fw) : 0.0;
  vec3 bondCol = uColor * (0.35 + 0.35 * (1.0 - facing)) * lit * fog;
  gl_FragColor = vec4(uColor * (0.022 + 0.022 * (1.0 - facing)) * fog + 0.5 * veil * pow(bondCol, vec3(2.2)), 1.0);
#else
  if (m < 0.35) discard;
  float ke = widen(0.04, fw * 0.246 / vSheet.z);               // Randsaum 0,04 lokale Einheiten
  float edgeAtoms = smoothstep(rim - 0.04 * ke, rimB, r) * bump / ke;
  vec3 col = uColor * (0.35 + 0.55 * atom / ka + 0.35 * (1.0 - facing) + 0.45 * edgeAtoms) * lit * fog;
  col = mix(col, col * vec3(1.35, 1.0, 0.62), 0.6 * warm * detail);
  gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
#endif
}
`;

// Platte: Ober- und Unterseite (Polarnetz) + Randband; aPart = (Seite, Band)
function slabGeometry(segA = 56, segR = 8) {
  const pos = [], part = [], idx = [];
  const face = (side) => {
    const base = pos.length / 3;
    for (let j = 0; j <= segR; j++) {
      const r = (0.5 * j) / segR;
      for (let i = 0; i < segA; i++) {
        const a = (i / segA) * Math.PI * 2;
        pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        part.push(side, 0);
      }
    }
    for (let j = 0; j < segR; j++) {
      for (let i = 0; i < segA; i++) {
        const a = base + j * segA + i, b = base + j * segA + ((i + 1) % segA);
        const c = a + segA, d = b + segA;
        if (side > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
      }
    }
  };
  face(1);
  face(-1);
  const base = pos.length / 3;
  for (let i = 0; i < segA; i++) {
    const a = (i / segA) * Math.PI * 2;
    pos.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
    part.push(1, 1, -1, 1);
  }
  for (let i = 0; i < segA; i++) {
    const a = base + i * 2, b = base + ((i + 1) % segA) * 2;
    idx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  return g;
}

const MOLECULES = {
  co2: [['C', 0, 0, 0], ['O', 0.116, 0, 0], ['O', -0.116, 0, 0]],
  n2: [['N', 0.055, 0, 0], ['N', -0.055, 0, 0]],
  h2o: [['O', 0, 0, 0], ['H', 0.0757, 0.0586, 0], ['H', -0.0757, 0.0586, 0]],
};
// Kalottenmodell: Kugeln mit dem van-der-Waals-Radius (Bondi 1964), damit die Größe der Moleküle zur Porenweite passt
// (CO₂ ≈ 0,33 nm breit = kinetischer Durchmesser)
const ELEMENT = {
  C: { r: 0.17, color: new THREE.Color(0.32, 0.33, 0.36) },
  O: { r: 0.152, color: new THREE.Color(0.9, 0.24, 0.22) },
  N: { r: 0.155, color: new THREE.Color(0.3, 0.5, 0.95) },
  H: { r: 0.12, color: new THREE.Color(0.95, 0.95, 0.97) },
};

// Feste Stammliste (Lage und Zufallswerte), unabhängig von der Temperatur; Größe, Schichtzahl, Abstand, Krümmung und
// Ausrichtung sind Funktionen von T und gleiten mit dem Regler (Pyrolyse-Labor). Zwei Sorten: Keime (Lage der großen
// Schichtpakete bei 800 °C, weit auseinander) und kleine Cluster dazwischen. Die Schichten wachsen von ≈ 0,8 nm (350 °C) auf
// ≈ 3 nm (800 °C, Wood et al. 2023); damit die Kohlenstoffmenge im Bild etwa gleich bleibt, wachsen die kleinen Cluster ab
// ≈ 560 °C nacheinander in den nächsten Keim ein, bevor er sie berührt (Kondensation, Modell). Keine Durchdringung.
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const seedSize = (u, T) => Math.min(nanoStructure(T).sheetNm * (1 + 0.25 * u.z), u.dMax);
function masterUnits(seed) {
  const rand = mulberry32(seed);
  const big = nanoStructure(800).sheetNm, small = nanoStructure(600).sheetNm;
  const units = [];
  const make = (c, z, dMax, isSeed) => {
    const u = {
      c, z, dMax, isSeed, n0: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize(), spin: rand() * 6.28,
      zl: gauss(rand), curv: 0.6 + 0.8 * rand(), shape: rand() < 0.5 ? -1 : 1, wave: rand(), slots: [], host: null, tm: Infinity,
    };
    for (let k = 0; k < 4; k++) u.slots.push({ jit: 1 + (rand() - 0.5) * 0.08, dRand: 0.88 + rand() * 0.24, seed: rand() });
    units.push(u);
  };
  const rndPos = () => new THREE.Vector3((rand() * 2 - 1) * HALF.x, (rand() * 2 - 1) * HALF.y, (rand() * 2 - 1) * HALF.z);
  for (let tries = 0; tries < 4000 && units.length < 70; tries++) {
    const c = rndPos(), z = gauss(rand), dMax = clamp(big * (1 + 0.2 * z), 1.8, 4.2);
    if (!units.some((u) => u.c.distanceTo(c) < 0.36 * (u.dMax + dMax) + 0.1)) make(c, z, dMax, true);
  }
  const seeds = units.slice();
  // kleine Cluster: Abstand nach ihrer größten eigenständigen Ausbildung (≈ 600 °C), zu Keimen nach deren Größe bei 600 °C
  for (let tries = 0; tries < 9000 && units.length < 360; tries++) {
    const c = rndPos(), z = gauss(rand), dMax = clamp(small * (1 + 0.25 * z), 0.45, 2.2);
    if (units.some((u) => u.c.distanceTo(c) < 0.38 * ((u.isSeed ? Math.min(u.dMax, small * 1.25) : u.dMax) + dMax) + 0.12)) continue;
    make(c, z, dMax, false);
  }
  // Einwachsen: nächster Keim; Beginn ≈ 20 °C bevor sich Keim und Cluster berühren würden (Kugelabschätzung)
  for (const u of units) {
    if (u.isSeed) continue;
    let best = Infinity;
    for (const s of seeds) { const g = u.c.distanceTo(s.c) - 0.5 * s.dMax; if (g < best) { best = g; u.host = s; } }
    const r = u.c.distanceTo(u.host.c);
    for (let T = 540; T <= 800; T += 5) {
      if (0.5 * seedSize(u.host, T) + 0.5 * seedSize(u, T) >= 0.95 * r) { u.tm = T - 20; break; }
    }
  }
  return units;
}

const ALIGN = new THREE.Vector3(0.25, 1, 0.1).normalize();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
// Sichtbare Schichten bei der Temperatur T (gleitende Werte); Schichten ohne Gewicht entfallen.
// Unter ≈ 300 °C gibt es noch keine aromatischen Schichten (Lignozellulose), sie wachsen 300–400 °C heran (pyroState.sheets).
// Krümmung als Krümmungsradius ≈ 1,6–2,4 nm (Modell, gekrümmte Fragmente nach Harris): lokale Krümmung = d / (2·R).
function sheetsAt(units, T) {
  const ns = nanoStructure(T);
  const born = pyroState(T).sheets;
  const sheets = [], vis = [];
  if (born <= 0) return { ns, sheets, vis };
  const R = 1.6 + 0.8 * ns.k;
  for (const u of units) {   // Keime stehen vorn in der Liste: ihre Lage ist bekannt, wenn die Cluster einwachsen
    const w = u.isSeed ? 1 : 1 - sstep(u.tm - 25, u.tm + 25, T);   // noch eigenständiger Anteil
    if (w <= 0.01) continue;
    const d = seedSize(u, T) * born * (0.3 + 0.7 * w);
    _n.copy(u.n0);
    if (ns.k > 0.3) _n.lerp(ALIGN, (ns.k - 0.3) * 0.35).normalize();
    if (!u.isSeed) _n.lerp(u.host.nT, 1 - w).normalize();
    else u.nT = (u.nT || new THREE.Vector3()).copy(_n);
    _c.copy(u.c);
    if (!u.isSeed) _c.lerp(u.host.c, 0.6 * (1 - w));
    _q.setFromUnitVectors(Z_AXIS, _n).multiply(_qs.setFromAxisAngle(Z_AXIS, u.spin));
    const Lf = ns.layers + 0.7 * u.zl;
    const lw = u.slots.map((_, k) => (k === 0 ? 1 : sstep(k + 0.2, k + 0.8, Lf)));
    const leff = lw.reduce((a, b) => a + b, 0);
    const curv = (d / (2 * R)) * u.curv;
    let layers = 0;
    u.slots.forEach((sl, k) => {
      if (lw[k] <= 0.01) return;
      layers++;
      const off = (k - (leff - 1) / 2) * ns.d002 * sl.jit;
      sheets.push({
        pos: _c.clone().addScaledVector(_n, off),
        q: _q.clone(),   // gleiche Form im Stapel; die turbostratische Verdrehung trägt das Gitter (Seed im Shader)
        d: d * sl.dRand * lw[k], curv, shape: u.shape * (1 + u.wave * 0.999), seed: sl.seed,
      });
    });
    vis.push({ c: _c.clone(), d, n: _n.clone(), layers, ref: u });
  }
  return { ns, sheets, vis };
}

// Abstand eines Punktes zur nächsten Schicht (Scheibe mit Radius R); Schichten als Zahlenfelder für Tempo
function sheetTable(sheets) {
  const n = new THREE.Vector3();
  return sheets.map((s) => {
    n.set(0, 0, 1).applyQuaternion(s.q);
    return [s.pos.x, s.pos.y, s.pos.z, n.x, n.y, n.z, s.d * 0.45];
  });
}

function nearestSheet(table, px, py, pz, stopBelow) {
  let d = Infinity;
  for (const [cx, cy, cz, nx, ny, nz, R] of table) {
    const vx = px - cx, vy = py - cy, vz = pz - cz;
    const dist2 = vx * vx + vy * vy + vz * vz;
    if (dist2 > (d + R) * (d + R)) continue;
    const h = vx * nx + vy * ny + vz * nz;
    const radial = Math.sqrt(Math.max(0, dist2 - h * h));
    const dd = radial < R ? Math.abs(h) : Math.hypot(h, radial - R);
    if (dd < d) {
      d = dd;
      if (d < stopBelow) break;
    }
  }
  return d;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 6);
  const rimL = new THREE.DirectionalLight(0x9fc2ff, 1.1);
  rimL.position.set(-6, -2, -7);
  scene.add(key, rimL);

  const geo = slabGeometry();
  const uniforms = { uColor: { value: new THREE.Color(0.62, 0.8, 1.0) }, uFogStart: { value: 10 }, uLight: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() } };
  const lineMat = new THREE.ShaderMaterial({ uniforms, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide });
  const fillMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide,
    defines: { SHEET_FILL: '' }, ...ADDITIVE,
  });
  const group = new THREE.Group();
  scene.add(group);

  // Mikropore als Sonde
  const probe = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({
    color: 0xffa040, opacity: 0.06, ...ADDITIVE,
  }));
  scene.add(probe);

  // Holz (unter ≈ 400 °C): Zellulose-Mikrofibrillen (Ø ≈ 3,5 nm, Fernandes et al. 2011) als nahezu parallele, leicht wellige
  // Stränge mit sechseckigem Querschnitt. Ihre Oberfläche zeigt die Glucanketten als Riefen (3 je Fläche, Abstand ≈ 0,58 nm;
  // Gitterebenen 0,53/0,60 nm) und die Glucose-Ringe als Buckel: 2 Ringe je 1,04 nm (Cellobiose), abwechselnd versetzt,
  // Nachbarketten um ¼ verschoben (Zellulose Iβ, Nishiyama et al. 2002). Dazwischen die Matrix (Modell): Hemizellulose-Ketten
  // aus Zuckerringen (Schritt ≈ 0,52 nm), Lignin-Knäuel aus aromatischen Ringen (Ring Ø ≈ 0,28 nm). Die Fibrillen werden dünner
  // und blasser, wenn die Zellulose zerfällt (315–400 °C), die Hemizellulose verschwindet 220–380 °C, die Lignin-Ringe gehen
  // in die aromatischen Schichten über, während diese heranwachsen (300–400 °C).
  const C_REP = 1.038;
  const chainTex = (() => {
    const W = 64, H = 48, data = new Uint8Array(W * H * 4);   // Breite: entlang der Fibrille (1 Cellobiose), Höhe: 1 Fläche
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const b = ((j + 0.5) / H) * 3, ci = Math.floor(b), t = b - ci - 0.5;
      const ridge = Math.cos(t * Math.PI) ** 2;
      const a = (((i + 0.5) / W) * 2 + ci * 0.5) % 2, k = Math.floor(a), f = a - k - 0.5;
      const bump = Math.exp(-(f * f) / 0.04 - ((t - (k ? 0.12 : -0.12)) ** 2) / 0.05);
      const h = Math.round(255 * (0.45 * ridge + 0.55 * ridge * bump));
      data.set([h, h, h, 255], (j * W + i) * 4);
    }
    const tex = new THREE.DataTexture(data, W, H);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  })();
  const wr = mulberry32(321);
  const fibrils = [];
  const FIB_R = 1.75, FIB_LEN = HALF.y * 2 + 2;
  chainTex.repeat.set(FIB_LEN / C_REP, 6);
  // Holz gedämpft (User 2026-10-24: „zu sehr überbelichtet“): dunklere Grundfarbe, wenig Umgebungslicht; envMap direkt,
  // sonst gilt scene.environmentIntensity und envMapIntensity wirkt nicht
  const woodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.36, 0.3, 0.21), roughness: 0.75, metalness: 0, envMap: ctx.env, envMapIntensity: 0.25, bumpMap: chainTex, bumpScale: 10, flatShading: true, transparent: true,
  });
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const cx = i * 3.9 + (j % 2 ? 1.9 : 0) + (wr() - 0.5) * 0.3, cz = j * 3.6 + (wr() - 0.5) * 0.3;
    if (Math.abs(cx) > HALF.x + 1 || Math.abs(cz) > HALF.z + 1) continue;
    const pts = [];
    for (let k = 0; k <= 4; k++) pts.push(new THREE.Vector3((wr() - 0.5) * 0.5, -FIB_LEN / 2 + (FIB_LEN * k) / 4, (wr() - 0.5) * 0.5));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, FIB_R, 6);
    const mesh = new THREE.Mesh(geo, woodMat);
    mesh.position.set(cx, 0, cz);
    mesh.rotation.z = 0.12;
    fibrils.push(mesh);
    scene.add(mesh);
  }
  const clearOf = (p, m) => fibrils.every((f) => Math.hypot(p.x - f.position.x, p.z - f.position.z) > FIB_R + m);
  const inBox = (p) => Math.abs(p.x) < HALF.x && Math.abs(p.y) < HALF.y && Math.abs(p.z) < HALF.z;
  const rndBox = () => new THREE.Vector3((wr() * 2 - 1) * HALF.x, (wr() * 2 - 1) * HALF.y, (wr() * 2 - 1) * HALF.z);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  // Hemizellulose: Ketten aus 4–8 Zuckerringen, meist längs der Fibrillen; Ringe abwechselnd gekippt (zweizählige Schraube)
  const hemi = [];
  for (let tries = 0; tries < 3000 && hemi.length < 260; tries++) {
    const p = rndBox();
    if (!clearOf(p, 0.3)) continue;
    const dir = new THREE.Vector3(gauss(wr), gauss(wr) + 2.2 * Math.sign(wr() - 0.5), gauss(wr)).normalize();
    const side = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.99 ? Z_AXIS : Y_AXIS).normalize();
    const n = 4 + Math.floor(wr() * 5);
    for (let k = 0; k < n && clearOf(p, 0.22) && inBox(p); k++) {
      const nrm = side.clone().applyAxisAngle(dir, k % 2 ? 0.6 : -0.6);
      hemi.push({ p: p.clone(), q: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, nrm), s: 0.17 });
      dir.add(new THREE.Vector3(gauss(wr), gauss(wr), gauss(wr)).multiplyScalar(0.12)).normalize();
      p.addScaledVector(dir, 0.52);
    }
  }
  // Lignin: Knäuel aus 3–6 aromatischen Ringen, verknüpft im Abstand ≈ 0,6 nm (z. B. β-O-4), Lage zufällig
  const lig = [];
  for (let tries = 0; tries < 2000 && lig.length < 110; tries++) {
    const p = rndBox();
    if (!clearOf(p, 0.5)) continue;
    const n = 3 + Math.floor(wr() * 4);
    for (let k = 0; k < n && clearOf(p, 0.25) && inBox(p); k++) {
      lig.push({ p: p.clone(), q: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, new THREE.Vector3(gauss(wr), gauss(wr), gauss(wr)).normalize()), s: 0.15 });
      p.add(new THREE.Vector3(gauss(wr), gauss(wr), gauss(wr)).normalize().multiplyScalar(0.6));
    }
  }
  const ringGeo = new THREE.CylinderGeometry(1, 1, 0.4, 6);   // Sechsring als flaches Prisma (Höhe 0,4 · Radius)
  const hemiMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.44, 0.36, 0.25), roughness: 0.7, metalness: 0, envMap: ctx.env, envMapIntensity: 0.3, transparent: true });
  const ligMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.36, 0.24, 0.13), roughness: 0.55, metalness: 0, envMap: ctx.env, envMapIntensity: 0.3, transparent: true });
  const hemiMesh = new THREE.InstancedMesh(ringGeo, hemiMat, hemi.length);
  const ligMesh = new THREE.InstancedMesh(ringGeo, ligMat, lig.length);
  scene.add(hemiMesh, ligMesh);
  const _wm = new THREE.Matrix4(), _ws = new THREE.Vector3();
  const setRings = (mesh, mat, list, f) => {
    mat.opacity = Math.min(1, f * 1.4);
    mesh.visible = f > 0.01;
    if (!mesh.visible) return;
    list.forEach((m, k) => mesh.setMatrixAt(k, _wm.compose(m.p, m.q, _ws.setScalar(m.s * (0.4 + 0.6 * f)))));
    mesh.instanceMatrix.needsUpdate = true;
  };
  let woodF = NaN, hemiF = NaN, ligF = NaN;
  function setWood(st) {
    if (st.fibril !== woodF) {
      woodF = st.fibril;
      woodMat.opacity = Math.min(1, st.fibril * 1.4);
      const vis = st.fibril > 0.01;
      for (const f of fibrils) { f.visible = vis; f.scale.set(0.35 + 0.65 * st.fibril, 1, 0.35 + 0.65 * st.fibril); }
    }
    if (st.matrix !== hemiF) setRings(hemiMesh, hemiMat, hemi, (hemiF = st.matrix));
    if (1 - st.sheets !== ligF) setRings(ligMesh, ligMat, lig, (ligF = 1 - st.sheets));
  }
  // Hotspots im Holz: Fibrille vorn in der Mitte, Lignin-Knäuel und Hemizellulose-Kette nahe der Bildmitte
  const front = (p) => Math.hypot(p.x, p.y) * 0.6 - p.z;
  const fib0 = fibrils.reduce((a, f) => (front(f.position) < front(a.position) ? f : a), fibrils[0]);
  const fibSpot = new THREE.Vector3(fib0.position.x - 0.12, 1, fib0.position.z + FIB_R * 0.88);
  const ligSpot = lig.reduce((a, m) => (front(m.p) < front(a) ? m.p : a), lig[0].p).clone();
  const hemiSpot = hemi.filter((m) => m.p.distanceTo(ligSpot) > 2.5).reduce((a, m) => (front(m.p) < front(a) ? m.p : a), hemi[0].p).clone();

  // Gasmoleküle
  const rand = mulberry32(55);
  const mols = [];
  const kinds = [...Array(20).fill('co2'), ...Array(12).fill('n2'), ...Array(10).fill('h2o')];
  for (const kind of kinds) {
    mols.push({
      kind, pos: new THREE.Vector3((rand() * 2 - 1) * HALF.x, (rand() * 2 - 1) * HALF.y, (rand() * 2 - 1) * HALF.z),
      vel: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.35),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
      spin: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.8),
      bound: null, cool: 0, ph: rand() * 6.28,
    });
  }
  const atomCount = mols.reduce((n, m) => n + MOLECULES[m.kind].length, 0);
  // Abgespaltene Gase (CO₂, H₂O) verlassen beim Aufheizen das Gefüge: Pool, der hinter den Gasmolekülen im selben Mesh liegt
  const ESC = 28, escKinds = ['co2', 'h2o'];
  const escapes = Array.from({ length: ESC }, () => ({ kind: 'co2', life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3() }));
  const atomMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ roughness: 0.35 }), atomCount + ESC * 3);
  {
    let i = 0;
    for (const m of mols) for (const [el] of MOLECULES[m.kind]) atomMesh.setColorAt(i++, ELEMENT[el].color);
    for (let k = 0; k < ESC * 3; k++) atomMesh.setColorAt(i++, ELEMENT.C.color);
  }
  scene.add(atomMesh);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hs = {
    sheet: { id: 'sheet', kind: 'dive', pos: new THREE.Vector3(), normal: new THREE.Vector3() },
    stack: { id: 'stack', kind: 'info', pos: new THREE.Vector3(), normal: null },
    micropore: { id: 'micropore', kind: 'info', pos: new THREE.Vector3(), normal: null },
    gas: { id: 'gas', kind: 'info', pos: new THREE.Vector3(), normal: null },
    fibril: { id: 'fibril', kind: 'info', pos: fibSpot, normal: new THREE.Vector3(0, 0, 1) },
    hemi: { id: 'hemi', kind: 'info', pos: hemiSpot, normal: null },
  };
  const sheetSpot = { pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) };
  let model = null;
  let poreD = 0;
  const camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.05, 200);
  const homePos = new THREE.Vector3(1.2, 1.6, 13);

  const units = masterUnits(1234);
  const CAP = units.length * 4;
  const sheetAttr = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  sheetAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aSheet', sheetAttr);
  const lines = new THREE.InstancedMesh(geo, lineMat, CAP);
  const fill = new THREE.InstancedMesh(geo, fillMat, CAP);
  fill.instanceMatrix = lines.instanceMatrix;
  lines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lines.frustumCulled = fill.frustumCulled = false;
  group.add(lines, fill);
  const _m = new THREE.Matrix4(), _sc = new THREE.Vector3();
  let shownT = ctx.temp, builtT = NaN, searchedT = NaN, prevT = ctx.temp, emitCredit = 0;

  // Schichten für die gezeigte Temperatur setzen; Hotspots und Mikropore nur alle ≈ 12 °C neu suchen (teuer)
  function rebuild(T) {
    builtT = T;
    model = sheetsAt(units, T);
    const st = pyroState(T);
    setWood(st);
    // Holz zeigt Fibrille + Matrix, Kohle Stapel, Mikropore und Gas; das Tauchziel führt im Holz zum Lignin-Ring (Ebene 7
    // zeigt dort ein Lignin-Bruchstück), in der Kohle zum großen Cluster
    const woody = st.sheets < 0.6;
    hs.fibril.hidden = st.fibril < 0.3;
    hs.hemi.hidden = Math.max(st.matrix, 1 - st.sheets) < 0.3;
    hs.stack.hidden = hs.micropore.hidden = hs.gas.hidden = woody;
    const { sheets } = model;
    sheets.forEach((sh, k) => {
      lines.setMatrixAt(k, _m.compose(sh.pos, sh.q, _sc.setScalar(sh.d)));
      sheetAttr.array.set([sh.curv, sh.shape, sh.d, sh.seed], k * 4);
    });
    lines.count = fill.count = sheets.length;
    lines.instanceMatrix.needsUpdate = true;
    sheetAttr.needsUpdate = true;
    probe.visible = !woody;
    if (sheets.length && Math.abs(T - searchedT) >= 12) searchHotspots(T);
    const spot = st.sheets < 0.5 || !sheets.length ? { pos: ligSpot, normal: Z_AXIS } : sheetSpot;
    hs.sheet.pos.copy(spot.pos);
    hs.sheet.normal.copy(spot.normal);
  }

  // Hotspots der Kohle nur alle ≈ 12 °C neu suchen (teuer): großer Cluster nahe der Mitte (Tauchziel), dicker Stapel,
  // größte leere Kugel (Mikropore), ein CO₂-Molekül
  function searchHotspots(T) {
    searchedT = T;
    const { sheets } = model;
    const near = (u) => u.c.length() + Math.abs(u.c.z - 1.5) * 0.3;
    const bigU = model.vis.filter((u) => u.d >= model.ns.sheetNm).sort((a, b) => near(a) - near(b))[0] || model.vis[0];
    const nrm = bigU.n.clone();
    if (nrm.dot(homePos.clone().sub(bigU.c)) < 0) nrm.negate();
    sheetSpot.pos.copy(bigU.c).addScaledVector(nrm, 0.25);
    sheetSpot.normal.copy(nrm);
    const stack = model.vis.filter((u) => u.layers >= 2 && u !== bigU).sort((a, b) => a.c.distanceTo(new THREE.Vector3(-2.5, 1, 1)) - b.c.distanceTo(new THREE.Vector3(-2.5, 1, 1)))[0] || bigU;
    hs.stack.pos.copy(stack.c);
    const r = mulberry32(99);
    const table = sheetTable(sheets);
    let best = null, bestD = 0;
    for (let k = 0; k < 2500; k++) {
      const px = (r() * 2 - 1) * 3, py = (r() * 2 - 1) * 2, pz = (r() * 2 - 1) * 2.5;
      const d = nearestSheet(table, px, py, pz, bestD);
      if (d > bestD && d < 1.0) { bestD = d; best = new THREE.Vector3(px, py, pz); }
    }
    // Abstand zur Schicht = zur Kernebene der Atome; freie Weite wie bei Schlitzporen-Modellen: Kernabstand − 0,34 nm
    // (zweimal der van-der-Waals-Radius von Kohlenstoff, 0,17 nm)
    poreD = Math.max(0, 2 * bestD - 0.34);
    hs.micropore.pos.copy(best || new THREE.Vector3());
    probe.position.copy(hs.micropore.pos);
    probe.scale.setScalar(Math.max(bestD - 0.17, 0.05));
  }

  // Nächster Punkt auf einer Schicht (Scheibe) zu p: Abstand, Fußpunkt, Normale zur Seite von p
  const _np = new THREE.Vector3(), _nn = new THREE.Vector3();
  function closestSheet(table, p, out) {
    let best = Infinity;
    for (const [cx, cy, cz, nx, ny, nz, R] of table) {
      const vx = p.x - cx, vy = p.y - cy, vz = p.z - cz;
      const dist2 = vx * vx + vy * vy + vz * vz;
      if (dist2 > (best + R) * (best + R)) continue;
      const h = vx * nx + vy * ny + vz * nz;
      const rx = vx - h * nx, ry = vy - h * ny, rz = vz - h * nz;
      const radial = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const f = radial > R ? R / radial : 1;
      const d = radial > R ? Math.hypot(radial - R, h) : Math.abs(h);
      if (d >= best) continue;
      best = d;
      out.p.set(cx + rx * f, cy + ry * f, cz + rz * f);
      out.n.set(nx, ny, nz).multiplyScalar(h < 0 ? -1 : 1);
    }
    return best;
  }

  // Gasmoleküle: freie Wärmebewegung in der Pore; nahe einer Schicht zieht die van-der-Waals-Kraft sie heran (Physisorption):
  // sie legen sich ≈ 0,33 nm flach auf die Schicht, verweilen kurz und lösen sich wieder – heißer kürzer (Modell).
  // Das markierte CO₂ (Hotspot) sitzt in der Mikropore (Sonde). Wände der Szene stoßen weich zurück.
  const ADS = { reach: 1.0, bind: 0.4, gap: 0.33 };
  const near = { p: new THREE.Vector3(), n: new THREE.Vector3() };
  const xAxis = new THREE.Vector3(1, 0, 0), _t = new THREE.Vector3(), _a = new THREE.Vector3();
  let sheetTab = [], sheetTabT = NaN;
  function placeMolecules(dt) {
    let i = 0;
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    if (builtT !== sheetTabT) { sheetTabT = builtT; sheetTab = sheetTable(model.sheets); }
    const k = model.ns.k, vmax = 0.4 + 0.3 * k;
    mols.forEach((mol, idx) => {
      if (dt > 0) {
        if (idx === 0 && probe.visible) {
          // markiertes CO₂: bleibt in der Mikropore und wackelt dort (adsorbiert in der engsten Pore)
          mol.bound = null;
          _a.copy(probe.position).add(_t.set(Math.sin(t0 * 1.7), Math.sin(t0 * 2.3 + 1), Math.cos(t0 * 1.3)).multiplyScalar(probe.scale.x * 0.35));
          mol.pos.lerp(_a, 1 - Math.exp(-dt * 2.5));
          mol.q.multiply(q.setFromEuler(new THREE.Euler(mol.spin.x * dt * 0.4, mol.spin.y * dt * 0.4, mol.spin.z * dt * 0.4)));
        } else if (mol.bound) {
          const b = mol.bound;
          b.until -= dt;
          _a.copy(b.p).addScaledVector(b.n, ADS.gap + 0.03 * Math.sin(t0 * 9 + mol.ph));
          mol.pos.lerp(_a, 1 - Math.exp(-dt * 6));
          mol.q.slerp(b.q, 1 - Math.exp(-dt * 5));
          if (b.until <= 0) {   // Desorption: löst sich von der Schicht, kurze Zeit ohne erneutes Anlagern
            mol.vel.copy(b.n).multiplyScalar(0.3 + 0.3 * rand()).add(_t.set(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.12));
            mol.bound = null; mol.cool = 1.5;
          }
        } else {
          mol.cool = Math.max(0, (mol.cool || 0) - dt);
          mol.vel.x += gauss(rand) * 0.5 * dt; mol.vel.y += gauss(rand) * 0.5 * dt; mol.vel.z += gauss(rand) * 0.5 * dt;
          if (sheetTab.length && mol.cool <= 0) {
            const d = closestSheet(sheetTab, mol.pos, near);
            if (d < ADS.bind) {
              _t.copy(near.n).cross(_a.set(0.3, 0.9, 0.1)).normalize();   // Molekülachse flach auf der Schicht
              mol.bound = { p: near.p.clone(), n: near.n.clone(), q: new THREE.Quaternion().setFromUnitVectors(xAxis, _t), until: (1.5 + 3.5 * rand()) * (1 - 0.6 * k) };
            } else if (d < ADS.reach) {
              mol.vel.addScaledVector(_a.copy(near.p).sub(mol.pos).normalize(), 1.4 * dt);
            }
          }
          mol.vel.clampLength(0.08, vmax);
          mol.pos.addScaledVector(mol.vel, dt);
          for (const ax of ['x', 'y', 'z']) {
            const over = Math.abs(mol.pos[ax]) - HALF[ax];
            if (over > 0) mol.vel[ax] -= Math.sign(mol.pos[ax]) * (2 + 6 * over) * dt;
          }
          mol.q.multiply(q.setFromEuler(new THREE.Euler(mol.spin.x * dt, mol.spin.y * dt, mol.spin.z * dt)));
        }
      }
      for (const [el, x, y, z] of MOLECULES[mol.kind]) {
        p.set(x, y, z).applyQuaternion(mol.q).add(mol.pos);
        s.setScalar(ELEMENT[el].r);
        atomMesh.setMatrixAt(i++, m.compose(p, q.identity(), s));
      }
    });
    atomMesh.instanceMatrix.needsUpdate = true;
    // Infopunkt am Ruheort des markierten CO₂ (über der Porenmitte), nicht am wackelnden Molekül: sonst zittert das
    // Abzeichen und tauscht mit dem der Mikropore die Plätze
    if (probe.visible) hs.gas.pos.copy(probe.position).add(_t.set(0, probe.scale.x * 0.35, 0));
    else hs.gas.pos.copy(mols[0].pos);
  }
  let t0 = 0;

  // Abgespaltene Moleküle: starten am Rand einer Schicht, fliegen nach außen, blenden am Ende aus (Farben je Element)
  const ESC_LIFE = 4.5;
  function spawnEscape() {
    const e = escapes.find((x) => x.life <= 0);
    if (!e || !model.sheets.length) return;
    const sh = model.sheets[Math.floor(rand() * model.sheets.length)];
    e.kind = escKinds[rand() < 0.55 ? 0 : 1];
    e.life = ESC_LIFE;
    e.pos.copy(sh.pos).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(sh.d * 0.2));
    e.vel.copy(e.pos).normalize().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.35)).multiplyScalar(0.7 + rand() * 0.7);
    e.q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
    e.spin.set(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(1.5);
  }
  const _col = new THREE.Color();
  function placeEscapes(dt) {
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    let i = atomCount;
    for (const e of escapes) {
      const mol = MOLECULES[e.kind];
      if (e.life > 0 && dt > 0) {
        e.life -= dt;
        e.pos.addScaledVector(e.vel, dt);
        e.q.multiply(q.setFromEuler(new THREE.Euler(e.spin.x * dt, e.spin.y * dt, e.spin.z * dt)));
      }
      const fade = e.life > 0 ? Math.min(1, (ESC_LIFE - e.life) / 0.4, e.life / 1.2) : 0;
      for (let k = 0; k < 3; k++) {
        if (k < mol.length && fade > 0) {
          const [el, x, y, z] = mol[k];
          p.set(x, y, z).applyQuaternion(e.q).add(e.pos);
          s.setScalar(ELEMENT[el].r * fade);
          atomMesh.setColorAt(i, _col.copy(ELEMENT[el].color));
        } else { p.set(0, 0, 0); s.setScalar(0); }
        atomMesh.setMatrixAt(i++, m.compose(p, q.identity(), s));
      }
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    atomMesh.instanceColor.needsUpdate = true;
  }

  rebuild(ctx.temp);
  placeMolecules(0);
  placeEscapes(0);
  const level = {
    scene, camera,
    unit: 1e-9,
    method: 'Modell nach XRD und HRTEM',
    tone: 1,
    grain: 0.025,
    dof: 3.5,
    bloom: 0.12,
    home: { pos: homePos, target: new THREE.Vector3(0, 0, 0) },
    cine: { orbit: 0.05, crane: 0.02, dolly: 0.025, drift: 0.01 },   // Leerlauf: halbe Ausschläge, die Infopunkte liegen tief gestaffelt
    orbit: { minDistance: 3, maxDistance: 26, enablePan: false, autoRotate: false },
    hotspots: [hs.sheet, hs.stack, hs.micropore, hs.gas, hs.fibril, hs.hemi],
    liveFacts: true,
    facts: () => [
      { value: model.sheets.length ? `≈ ${fmt(model.ns.sheetNm * pyroState(shownT).sheets, 1)} nm · ${fmt(model.ns.layers, 1)}` : '–', label: 'mittlerer Schichtdurchmesser (nach Wood et al. 2023) · Schichten je Stapel (Modell)' },
      { value: probe.visible ? `${fmt(poreD, 1)} nm` : '–', label: 'freie Weite der markierten Mikropore (Kernabstand − 0,34 nm)' },
    ],
    update(dt, t) {
      t0 = t;
      uniforms.uFogStart.value = camera.position.length() - 1;
      // Licht wandert langsam: Hauptlicht schwenkt, kühles Gegenlicht kreist
      uniforms.uLight.value.set(0.4 + 0.35 * Math.sin(t * 0.09), 0.8, 0.45 + 0.35 * Math.cos(t * 0.07)).normalize();
      key.position.set(4 + 3 * Math.sin(t * 0.09), 8, 6 + 3 * Math.cos(t * 0.07));
      rimL.position.set(-6 * Math.cos(t * 0.05), -2, -7 * Math.sin(t * 0.05 + 1));
      // Aufheizen setzt Gase frei (≈ 1 Molekül je 12 °C zwischen 150 und 800 °C)
      const dT = shownT - prevT;
      prevT = shownT;
      if (shownT !== builtT) rebuild(shownT);
      if (dT > 0 && dT < 200 && shownT > 150 && !reducedMotion) {
        emitCredit = Math.min(emitCredit + dT / 12, 6);
        while (emitCredit >= 1) { emitCredit--; spawnEscape(); }
      }
      placeMolecules(dt);
      placeEscapes(dt);
      return true;
    },
    setParam(name, value) {
      if (name !== 'temp') return;
      shownT = value;
      level.dirty = true;
    },
    dispose() {
      geo.dispose(); lineMat.dispose(); fillMat.dispose();
      atomMesh.geometry.dispose(); atomMesh.material.dispose();
      probe.geometry.dispose(); probe.material.dispose();
      for (const f of fibrils) f.geometry.dispose();
      ringGeo.dispose(); woodMat.dispose(); hemiMat.dispose(); ligMat.dispose(); chainTex.dispose();
    },
  };
  return level;
}
