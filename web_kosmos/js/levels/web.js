// Station 9: Kosmisches Netz (Einheit 1 Mpc), statistisches Voronoi-Modell (van de Weygaert & Icke 1989): Zellkerne =
// Mitten der Leerräume, Galaxien werden auf die Zellgrenzen geschoben – auf Wände (Ebene zwischen zwei Kernen), Fäden
// (Schnitt dreier Zellen) und Knoten (Ecke von vier Zellen, dort Galaxienhaufen). Anteile nach Cautun et al. 2014,
// grob auf Galaxien übertragen: Knoten 15 %, Fäden 45 %, Wände 25 %, Leerräume 15 %. Echte Haufen und Superhaufen an
// gemessenen Richtungen und Abständen (Abell 1989, NED; d = cz/H₀ mit H₀ = 70): Virgo, Fornax, Centaurus, Hydra,
// Norma (= Großer Attraktor), Perseus (mit der Perseus-Pisces-Kette), Coma, Hercules, Shapley. Strömung: Galaxien
// treiben zum Großen Attraktor und weiter zu Shapley – das Einzugsgebiet dieser Strömung ist Laniakea (Tully 2014);
// die Strömung hier schematisch aus Punktmassen, keine gemessene Geschwindigkeitskarte.
// Fahrt hinein zur Lokalen Gruppe (Station 8): Vorbeiflug an reifen Galaxien (pass, galaxyflight.js createFlyby) – Darstellung.

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { pointCloud, disposeScene, volume, bakeField, offscreen } from '../vol.js';
import { galToScene, mulberry32, gauss, blackbody, MPC } from '../astro.js';
import { galaxyAtlas, createFlyby } from '../galaxyflight.js';

const R = 250;
const at = (l, b, d) => new THREE.Vector3(...galToScene(l, b, d, 0));
// Haufen: id, l, b, d [Mpc], Reichtum (Zahl der Galaxien im Modell), Attraktor-Gewicht für die Strömung
export const CLUSTERS = [
  { id: 'virgo', l: 283.8, b: 74.5, d: 16.5, n: 1600, s: 1.5, m: 0.25 },
  { id: 'fornax', l: 236.7, b: -53.6, d: 19, n: 500, s: 1.0, m: 0.08 },
  { id: 'centaurus', l: 302.4, b: 21.6, d: 49, n: 700, s: 1.4, m: 0.2 },
  { id: 'hydra', l: 269.6, b: 26.5, d: 54, n: 500, s: 1.2, m: 0.12 },
  { id: 'ga', l: 325.3, b: -7.3, d: 68, n: 1400, s: 2.2, m: 1.0 },
  { id: 'perseus', l: 150.6, b: -13.3, d: 77, n: 1200, s: 1.8, m: 0.35 },
  { id: 'coma', l: 58.1, b: 88.0, d: 99, n: 1300, s: 1.6, m: 0.4 },
  { id: 'hercules', l: 31.6, b: 44.5, d: 157, n: 700, s: 2.0, m: 0.2 },
  { id: 'shapley', l: 312.0, b: 30.7, d: 206, n: 2200, s: 3.2, m: 1.6 },
].map((c) => ({ ...c, p: at(c.l, c.b, c.d) }));
const PP_END = at(125, -27, 66);   // Perseus-Pisces-Kette: von Perseus Richtung Pisces

// Gas: Feld r = Wand, g = Faden, b = Knoten, a = Faden zum Virgo-Haufen. Abstand zur Zellgrenze = Abstand zur
// mittelsenkrechten Ebene der beiden nächsten Kerne (Faden: zwei Ebenen, Knoten: drei). Gas über das ganze Netz (User
// 28.10.2026, Vorschau „Gas über das ganze Netz“): Breiten und Rauschen wachsen mit der Ausdehnung gegenüber den 75 Mpc
// von vorher (WS), Fäden schwächer (WS^0,25), sonst wären sie im weiten Bild nur noch Haarlinien
const GAS_EXT = R, WS = GAS_EXT / 75, WS2 = Math.sqrt(WS);
const GAS_FIELD = /* glsl */ `
float bis(vec3 p, vec3 a, vec3 b) { vec3 u = b - a; return dot(p - 0.5 * (a + b), u) / length(u); }
vec4 field(vec3 p) {
  float d1 = 1e12, d2 = 1e12, d3 = 1e12, d4 = 1e12;
  vec3 a = vec3(0.0), b = a, c = a, d = a;
  for (int i = 0; i < NN; i++) {
    vec3 q = NUC[i];
    float e = dot(p - q, p - q);
    if (e < d1) { d4 = d3; d = c; d3 = d2; c = b; d2 = d1; b = a; d1 = e; a = q; }
    else if (e < d2) { d4 = d3; d = c; d3 = d2; c = b; d2 = e; b = q; }
    else if (e < d3) { d4 = d3; d = c; d3 = e; c = q; }
    else if (e < d4) { d4 = e; d = q; }
  }
  float ab = bis(p, a, b), ac = bis(p, a, c), ad = bis(p, a, d);
  vec3 s0 = -0.3 * VIRGO, s1 = 1.3 * VIRGO;
  float t = clamp(dot(p - s0, s1 - s0) / dot(s1 - s0, s1 - s0), 0.0, 1.0);
  vec3 dv = p - mix(s0, s1, t);
  return vec4(exp(-ab * ab / (24.0 * WS2)), exp(-(ab * ab + ac * ac) / (11.5 * WS2)), exp(-(ab * ab + ac * ac + ad * ad) / (20.0 * WS2)), exp(-dot(dv, dv) / 13.5));
}
`;
const GAS_BODY = /* glsl */ `
uniform highp sampler3D uField;
uniform float uGain, uMode, uReach, uWidth, uCon;
uniform vec4 uCl[6];
uniform float uClW[6];
// Temperatur-Rampe wie in Simulationsbildern (IllustrisTNG): kalt blau → warm violett → heiß orange → sehr heiß weiß
vec3 tRamp(float h) {
  vec3 c = mix(vec3(0.10, 0.20, 0.95), vec3(0.62, 0.28, 0.95), smoothstep(0.0, 0.4, h));
  c = mix(c, vec3(1.0, 0.52, 0.18), smoothstep(0.35, 0.75, h));
  return mix(c, vec3(1.0, 0.93, 0.80), smoothstep(0.75, 1.0, h));
}
void sampleVol(vec3 p, out vec3 e, out float s) {
  s = 0.0;
  // Fadenbreite live: exp(-d²/k)^(1/w²) = exp(-d²/(k·w²)), ohne das Feld neu zu backen
  vec4 f = pow(texture(uField, p / (2.0 * EXT) + 0.5), vec4(1.0 / (uWidth * uWidth)));
  float edge = pow(smoothstep(uReach, uReach * 0.25, length(p)), 1.6);
  float n = fbm(p * (0.22 / WS) + vec3(0.0, uTime * 0.012, uTime * 0.008), OCT);
  float rid = ridged(p * (0.45 / WS) + vec3(uTime * 0.01, 0.0, 0.0), 3);
  float clump = clamp(0.6 + 1.8 * n, 0.0, 2.0);
  float hot = 0.0, sh = 0.0, gl = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 d = p - uCl[i].xyz;
    float x2 = dot(d, d) / (uCl[i].w * uCl[i].w), rho = uClW[i] / (1.0 + x2);
    hot += rho * rho * smoothstep(144.0, 16.0, x2) + 0.04 * rho * smoothstep(400.0, 36.0, x2);
    sh += uClW[i] * exp(-pow((sqrt(x2) - 4.5) / 0.7, 2.0));
    // breiter Röntgen-Halo: der Kern (rc ≈ 1 Mpc) ist kleiner als ein Rechenschritt und fiele sonst durch
    gl += uClW[i] * exp(-x2 / 30.0);
  }
  // Kontrast: Potenz auf die Dichte – höher = Leerräume dunkler, Fäden heben sich ab
  float g = pow((0.3 * f.r + f.g * (0.6 + 0.8 * rid) + f.a + 1.4 * f.b) * clump + 0.6 * sqrt(hot) + 0.8 * sh * clump, uCon);
  if (uMode < 1.5) {
    float h = clamp(0.12 * f.r + 0.3 * f.g + 0.6 * f.b + 1.1 * sqrt(hot) + 0.7 * sh * (0.5 + n), 0.0, 1.0);
    e = tRamp(h) * g * 0.02 * NORM;
  } else if (uMode > 2.5) {
    float h = clamp(0.1 * f.r + 0.35 * f.g + 0.7 * f.b + 1.1 * sqrt(hot), 0.0, 1.0);
    if (uMode < 3.5) {
      // Dichte wie Simulationsbilder (Vorlage 1): Leerraum dunkelblau, Faden hellblau-weiß, Knoten rot
      vec3 c = mix(vec3(0.03, 0.16, 0.42), vec3(0.62, 0.80, 1.0), smoothstep(0.02, 0.3, h));
      c = mix(c, vec3(1.0, 0.95, 0.92), smoothstep(0.3, 0.55, h));
      c = mix(c, vec3(0.95, 0.25, 0.15), smoothstep(0.55, 0.9, h));
      e = c * (0.0025 / uCon + g * 0.02) * NORM;
    } else {
      // Leuchtnetz (Vorlage 2): Leerräume dunkel, Fäden cyanblau, Knoten gelblich-weiß
      vec3 c = mix(vec3(0.08, 0.22, 0.85), vec3(0.45, 0.80, 1.0), smoothstep(0.05, 0.4, h));
      c = mix(c, vec3(1.0, 0.95, 0.70), smoothstep(0.5, 0.9, h));
      e = c * pow(g, 1.4) * 0.03 * NORM;
    }
  } else {
    // Röntgengas: nur das heiße Haufengas leuchtet, das Netz ist nur angedeutet
    float x = (hot + 0.5 * gl) * (0.7 + 0.6 * n) + 0.08 * sh * clump + 0.06 * NORM * NORM * (f.b + f.a) * clump;
    e = mix(vec3(0.75, 0.25, 1.0), vec3(1.0, 0.85, 0.55), clamp(hot + 0.6 * gl, 0.0, 1.0)) * x * 0.4;
  }
  e *= uGain * edge;
}
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const rand = mulberry32(77);
  const NN = 900, CELL = 50;
  const nuc = [];
  while (nuc.length < NN) {
    const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(R * 1.15);
    if (p.length() < R * 1.15) nuc.push(p);
  }
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  nuc.forEach((p, i) => {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  function nearest(p, n = 4) {
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
    let cand = [];
    for (let reach = 1; reach <= 3 && cand.length < n + 2; reach++) {
      cand = [];
      for (let x = -reach; x <= reach; x++) for (let y = -reach; y <= reach; y++) for (let z = -reach; z <= reach; z++) {
        const g = grid.get(key(cx + x, cy + y, cz + z));
        if (g) cand.push(...g);
      }
    }
    return cand.map((i) => [i, nuc[i].distanceToSquared(p)]).sort((a, b) => a[1] - b[1]).slice(0, n).map((x) => nuc[x[0]]);
  }
  // Projektion auf die mittelsenkrechte Ebene zwischen a und b
  const toPlane = (p, a, b) => {
    const u = b.clone().sub(a).normalize();
    const m = a.clone().add(b).multiplyScalar(0.5);
    return p.addScaledVector(u, -p.clone().sub(m).dot(u));
  };
  const pos = [], col = [], size = [];
  const push = (p, T, k, s) => {
    const fade = Math.min(1, Math.max(0, (R - p.length()) / (R * 0.3)));
    if (fade <= 0) return;
    pos.push(p.x, p.y, p.z);
    col.push(...blackbody(T).map((v) => v * k * fade));
    size.push(s);
  };
  const n = Math.round(170000 * ctx.detail);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(R);
    if (p.length() > R) { i--; continue; }
    const [a, b, c, d] = nearest(p);
    const r = rand();
    const kind = r < 0.15 ? 3 : r < 0.6 ? 2 : r < 0.85 ? 1 : 0;
    // mehr Durchgänge: Fäden und Knoten werden scharf, Wände bleiben flächig
    if (kind >= 1) for (let it = 0; it < (kind === 1 ? 2 : kind === 2 ? 12 : 16); it++) {
      toPlane(p, a, b);
      if (kind >= 2) toPlane(p, a, c);
      if (kind >= 3) toPlane(p, a, d);
    }
    const sc = [6, 1.1, 0.9, 0.9][kind];
    p.add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(sc * (kind === 3 ? Math.abs(gauss(rand)) : 1)));
    const T = kind === 3 ? 4300 + rand() * 900 : 5200 + rand() * 2600;
    push(p, T, [0.14, 0.9, 2.6, 4.2][kind] * (0.4 + rand() * 1.2), 0.22);
  }
  // echte Haufen + Lokale Gruppe mit Faden zum Virgo-Haufen, Perseus-Pisces-Kette
  const cluster = (c, m, s, k) => { for (let i = 0; i < m; i++) push(c.clone().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(s * Math.abs(gauss(rand)))), 4400 + rand() * 900, k * 3 * (0.5 + rand()), 0.22); };
  for (const c of CLUSTERS) cluster(c.p, Math.round(c.n * (0.4 + 0.6 * ctx.detail)), c.s, 1.0);
  cluster(new THREE.Vector3(), 60, 0.6, 0.9);
  const virgo = CLUSTERS.find((c) => c.id === 'virgo').p, ga = CLUSTERS.find((c) => c.id === 'ga').p, perseus = CLUSTERS.find((c) => c.id === 'perseus').p;
  for (let i = 0; i < 900; i++) {
    const t = rand() * 1.6 - 0.3;
    push(virgo.clone().multiplyScalar(t).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(1.6)), 5600 + rand() * 2000, 2 * (0.5 + rand()), 0.22);
  }
  for (let i = 0; i < 1800; i++) {
    const t = rand();
    push(perseus.clone().lerp(PP_END, t).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(2.2)), 4800 + rand() * 2000, 2.4 * (0.5 + rand()), 0.22);
  }
  const web = pointCloud(pos, col, size, { min: 1.15 });
  scene.add(web);

  // Strömung (Laniakea): Teilchen treiben im Feld der Attraktoren (Punktmassen, geglättet) – Punkte + kurze Spuren
  const NP = Math.round(900 * ctx.detail) + 300;
  const fp = new Float32Array(NP * 3), fl = new Float32Array(NP * 6), vel = new Float32Array(NP * 3), age = new Float32Array(NP);
  const spawn = (i) => {
    const p = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(R * 0.95 * Math.cbrt(rand()));
    fp.set([p.x, p.y, p.z], i * 3);
    vel.set([0, 0, 0], i * 3);
    age[i] = rand() * 40;
  };
  for (let i = 0; i < NP; i++) spawn(i);
  const flowPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x8fd8ff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  flowPts.geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flowLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  flowLines.geometry.setAttribute('position', new THREE.BufferAttribute(fl, 3));
  const flow = new THREE.Group();
  flow.add(flowPts, flowLines);
  flow.visible = false;
  scene.add(flow);
  const tmp = new THREE.Vector3(), acc = new THREE.Vector3();
  function stepFlow(dt) {
    const h = Math.min(dt, 0.05) * 60;
    for (let i = 0; i < NP; i++) {
      const x = fp[i * 3], y = fp[i * 3 + 1], z = fp[i * 3 + 2];
      acc.set(0, 0, 0);
      for (const c of CLUSTERS) {
        tmp.set(c.p.x - x, c.p.y - y, c.p.z - z);
        const d2 = tmp.lengthSq() + 400;
        acc.addScaledVector(tmp, c.m * 900 / (d2 * Math.sqrt(d2)));
      }
      vel[i * 3] = (vel[i * 3] + acc.x * h) * 0.985; vel[i * 3 + 1] = (vel[i * 3 + 1] + acc.y * h) * 0.985; vel[i * 3 + 2] = (vel[i * 3 + 2] + acc.z * h) * 0.985;
      fp[i * 3] += vel[i * 3] * h; fp[i * 3 + 1] += vel[i * 3 + 1] * h; fp[i * 3 + 2] += vel[i * 3 + 2] * h;
      fl.set([fp[i * 3], fp[i * 3 + 1], fp[i * 3 + 2], fp[i * 3] - vel[i * 3] * 4, fp[i * 3 + 1] - vel[i * 3 + 1] * 4, fp[i * 3 + 2] - vel[i * 3 + 2] * 4], i * 6);
      age[i] += h;
      let near = false;
      for (const c of CLUSTERS) if (c.m >= 1 && Math.hypot(c.p.x - fp[i * 3], c.p.y - fp[i * 3 + 1], c.p.z - fp[i * 3 + 2]) < 9) { near = true; break; }
      if (near || age[i] > 160 || Math.hypot(fp[i * 3], fp[i * 3 + 1], fp[i * 3 + 2]) > R) spawn(i);
    }
    flowPts.geometry.attributes.position.needsUpdate = true;
    flowLines.geometry.attributes.position.needsUpdate = true;
  }

  // Gas über das ganze Netz (bis GAS_EXT): dieselben Zellkerne wie die Galaxien → Wände, Fäden, Knoten des Gases liegen
  // genau auf dem Netz; dazu der Faden Lokale Gruppe → Virgo und das heiße Haufengas (β-Modell, Leuchten ∝ Dichte²)
  const v3 = (p) => `vec3(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
  const field = bakeField(ctx.renderer, { size: 192, extent: GAS_EXT, body: `const int NN = ${nuc.length};
const vec3 NUC[NN] = vec3[NN](${nuc.map(v3).join(', ')});
const vec3 VIRGO = ${v3(virgo)};
const float WS2 = ${WS2.toFixed(4)};
${GAS_FIELD}` });
  const CL = [['virgo', 1, 0.9], ['fornax', 0.5, 0.5], ['centaurus', 0.9, 0.9], ['hydra', 0.7, 0.7], ['ga', 1.1, 1.2]]
    .map(([id, w, rc]) => [CLUSTERS.find((c) => c.id === id).p, w, rc]).concat([[new THREE.Vector3(), 0.25, 0.35]]);
  // NORM: der Strahl läuft WS-mal so weit durch Gas wie bei 75 Mpc → Helligkeit zurück auf das Maß von vorher (eigener
  // Faktor, der Regler „Helligkeit“ setzt uGain beim Laden auf 1)
  const gasMesh = volume({ radius: GAS_EXT, body: `#define OCT ${ctx.detail > 0.7 ? 4 : 3}\n#define EXT ${GAS_EXT.toFixed(1)}\n#define NORM ${(1 / WS).toFixed(4)}\nconst float WS = ${WS.toFixed(4)};\n${GAS_BODY}`,
    steps: ctx.detail > 0.9 ? 160 : 128, maxSteps: 192, uniforms: {
      uField: { value: field.texture }, uGain: { value: 1 }, uMode: { value: 0 }, uReach: { value: GAS_EXT }, uWidth: { value: 1 }, uCon: { value: 1 },
      uCl: { value: CL.map(([p, , rc]) => new THREE.Vector4(p.x, p.y, p.z, rc)) }, uClW: { value: CL.map((c) => c[1]) },
    } });
  const gas = offscreen(ctx.renderer, gasMesh);
  gas.quad.renderOrder = 1;
  gas.quad.visible = false;
  scene.add(gas.quad);
  // funkelnde Galaxien: hellste Punkte nahe der Lokalen Gruppe, Helligkeit schwankt langsam (unter 0,5 Hz) – Darstellung
  const tw = { pos: [], base: [], ph: [], om: [] };
  for (let i = 0; i < pos.length / 3 && tw.ph.length < 420; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.hypot(x, y, z) > 60 || col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2] < 3.2) continue;
    tw.pos.push(x, y, z); tw.base.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); tw.ph.push(rand() * 6.28); tw.om.push(0.5 + rand() * 2);
  }
  const twinkle = pointCloud(tw.pos, tw.base, tw.ph.map(() => 0.5), { min: 2.2 });
  twinkle.visible = false;
  scene.add(twinkle);
  const twCol = twinkle.geometry.attributes.color;
  let gasT = 0;

  const home = { pos: new THREE.Vector3(100, 120, 250), target: new THREE.Vector3(0, 0, 0) };
  const hd = home.pos.clone().normalize();
  const voidC = nuc.filter((p) => p.length() > 45 && p.length() < 90).sort((a, b) => b.clone().normalize().dot(hd) - a.clone().normalize().dot(hd))[0] || nuc[0];
  const hotspots = [
    { id: 'lg', kind: 'dive', to: 'local', pos: new THREE.Vector3() },
    // Dunkle Materie (Station 05A): eigener Modellwürfel, Abzeichen über der Lokalen Gruppe zwischen Virgo und Großem Attraktor
    { id: 'dm', kind: 'dive', to: 'darkmatter', pos: virgo.clone().add(ga).multiplyScalar(0.3).add(new THREE.Vector3(0, -22, 0)) },
    { id: 'virgo', kind: 'info', pos: virgo },
    { id: 'ga', kind: 'info', pos: ga },
    { id: 'void', kind: 'info', pos: voidC.clone() },
    { id: 'shapley', kind: 'info', pos: CLUSTERS.find((c) => c.id === 'shapley').p },
    { id: 'coma', kind: 'info', pos: CLUSTERS.find((c) => c.id === 'coma').p },
    { id: 'perseus', kind: 'info', pos: perseus },
    { id: 'flow', kind: 'info', pos: ga.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 18, 0)), visible: () => flow.visible },
    ...['fornax', 'centaurus', 'hydra', 'hercules'].map((id) => ({ id, kind: 'label', cls: 'hsl--faint', pos: CLUSTERS.find((c) => c.id === id).p })),
  ];
  let flowK = 1, flowG = 1;
  const flowAlpha = () => { flowPts.material.opacity = Math.min(1, 0.4 * flowG); flowLines.material.opacity = Math.min(1, 0.14 * flowG); };
  const flowOnly = 'Wirkt, sobald unter Ansicht „Strömung“ auf Laniakea steht.';
  const gasOnly = 'Wirkt, sobald unter Ansicht „Gas“ eingeschaltet ist.';
  const gu = gasMesh.material.uniforms;
  let gasK = 1, twK = 1, twT = 0;
  registerLayers('web', [
    { id: 'netGain', type: 'range', group: 'Netz der Galaxien', label: 'Helligkeit', value: 1, min: 0.25, max: 5, step: 0.25, unit: '×', set: (v) => { web.material.uniforms.uGain.value = v; } },
    { id: 'flowK', type: 'range', group: 'Strömung (Laniakea)', label: 'Tempo', value: 1, min: 0.25, max: 6, step: 0.25, unit: '×', set: (v) => { flowK = v; }, active: () => flow.visible, only: flowOnly },
    { id: 'flowGain', type: 'range', label: 'Helligkeit', value: 1, min: 0.25, max: 6, step: 0.25, unit: '×', set: (v) => { flowG = v; flowAlpha(); }, active: () => flow.visible, only: flowOnly },
    { id: 'gasGain', type: 'range', group: 'Gaswolke', label: 'Helligkeit', value: 1, min: 0.25, max: 4, step: 0.25, unit: '×', set: (v) => { gu.uGain.value = v; gas.invalidate(); }, active: () => gas.quad.visible, only: gasOnly },
    { id: 'gasK', type: 'range', label: 'Bewegung', value: 1, min: 0, max: 4, step: 0.25, fmt: (v) => (v ? `${v} ×` : 'steht'), set: (v) => { gasK = v; }, active: () => gas.quad.visible, only: gasOnly },
    // Reichweite blendet nur aus (Feld bleibt), Fadenbreite und Kontrast wirken live im Strahl
    { id: 'gasReach', type: 'range', label: 'Reichweite', value: GAS_EXT, min: 25, max: GAS_EXT, step: 25, unit: ' Mpc', set: (v) => { gu.uReach.value = v; gas.invalidate(); }, active: () => gas.quad.visible, only: gasOnly },
    { id: 'gasWidth', type: 'range', label: 'Fadenbreite', value: 1, min: 0.5, max: 1.5, step: 0.25, unit: '×', set: (v) => { gu.uWidth.value = v; gas.invalidate(); }, active: () => gas.quad.visible, only: gasOnly },
    { id: 'gasCon', type: 'range', label: 'Kontrast', value: 1, min: 0.5, max: 2.5, step: 0.25, unit: '×', set: (v) => { gu.uCon.value = v; gas.invalidate(); }, active: () => gas.quad.visible, only: gasOnly },
    { id: 'gasSteps', type: 'range', label: 'Detail (Schritte)', value: gu.uSteps.value, min: 64, max: 160, step: 32, set: (v) => { gu.uSteps.value = v; gas.invalidate(); }, active: () => gas.quad.visible, only: gasOnly },
    { id: 'twK', type: 'range', group: 'Funkeln', label: 'Tempo', value: 1, min: 0.25, max: 3, step: 0.25, unit: '×', set: (v) => { twK = v; }, active: () => twinkle.visible, only: 'Wirkt, sobald unter Ansicht „Funkeln“ an ist.' },
  ]);
  // Vorbeiflug an Galaxien auf der Fahrt hinein zur Lokalen Gruppe (User 27.10.2026, nur im Flug sichtbar)
  const flyby = createFlyby(galaxyAtlas());
  scene.add(flyby.group);
  const controls = [{ id: 'flow', label: 'Strömung', value: 'off', options: [['off', 'Aus'], ['on', 'Laniakea']], set: (v) => { flow.visible = v === 'on'; } },
    // Gas: Temperatur = Farben wie in IllustrisTNG, Röntgengas = nur heißes Haufengas (User 28.10.2026, Vorschau Gas:B + Gas:C)
    // Dichte (blau-weiß-rot) + Leuchtnetz (cyanblau) = Vorlagen 1 + 2 (User 28.10.2026, Vorschau „Gas über das ganze Netz“ Gas:B + Gas:C)
    { id: 'gas', label: 'Gas', value: 'off', options: [['off', 'Aus'], ['temp', 'Temperatur'], ['dens', 'Dichte'], ['glow', 'Leuchtnetz'], ['xray', 'Röntgengas']],
      set: (v) => { gu.uMode.value = { xray: 2, dens: 3, glow: 4 }[v] || 1; gas.quad.visible = v !== 'off'; gas.invalidate(); } },
    { id: 'tw', label: 'Funkeln', value: 'off', options: [['off', 'Aus'], ['on', 'An']], set: (v) => { twinkle.visible = v === 'on'; } }];
  return {
    scene, camera, unit: MPC, hotspots, controls, home,
    orbit: { minDistance: 8, maxDistance: 900, cineSpeed: 0.5 },
    pass: flyby,
    // Shader des Vorbeiflugs schon beim Laden binden (compileAsync übergeht Unsichtbares) – kein Hänger beim ersten Flug
    ready: (async () => {
      flyby.group.visible = true; await ctx.renderer.compileAsync(scene, camera); flyby.group.visible = false;
      await field.ready; await ctx.renderer.compileAsync(gas.scene, camera);
    })(),
    look: { exposure: 1.2, bloom: 0.1, sat: 1.05, con: 0.12, sh: [0.93, 0.97, 1.1] },
    update(dt, t, cam) {
      if (flow.visible) for (let i = 0, n = Math.ceil(flowK); i < n; i++) stepFlow(dt * flowK / n);
      gasT += dt * gasK;
      twT += dt * twK;
      if (gas.quad.visible) { gu.uTime.value = gasT; gas.invalidate(); gas.render(cam); }
      if (twinkle.visible) {
        for (let i = 0; i < tw.ph.length; i++) {
          const k = 0.25 + 2.2 * Math.pow(0.5 + 0.5 * Math.sin(twT * tw.om[i] + tw.ph[i]), 4);
          twCol.setXYZ(i, tw.base[i * 3] * k, tw.base[i * 3 + 1] * k, tw.base[i * 3 + 2] * k);
        }
        twCol.needsUpdate = true;
      }
    },
    live: () => (flow.visible ? 'Strömung schematisch: zum Großen Attraktor und weiter zum Shapley-Superhaufen (Laniakea = Einzugsgebiet)' : 'Modell-Netz um echte Haufen: Virgo, Fornax, Centaurus, Hydra, Norma, Perseus–Pisces, Coma, Hercules, Shapley'),
    setPixelRatio(pr, H) { web.userData.setPx(pr, H, camera.fov); twinkle.userData.setPx(pr, H, camera.fov); gas.setSize(Math.round(H * camera.aspect), H); },
    dispose: () => { disposeScene(scene); gas.dispose(); field.dispose(); },
  };
}
