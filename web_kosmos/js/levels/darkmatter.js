// Station 05A: Dunkle Materie (Einheit 1 Mpc), Abstecher vom Kosmischen Netz. Vorbild: Bild „Dark Matter in a Simulated
// Universe“ von Tom Abel und Ralf Kaehler (KIPAC/SLAC, AMNH-Show „Dark Universe“) – schwarze Fäden der Dunklen Materie
// vor hellem Grund, goldene Galaxien in den Halos; nachgebaut mit eigener Rechnung, das Bild selbst ist nicht eingebunden.
// Modell: 128³ Teilchen in einem periodischen Würfel von 160 Mpc (≈ Laniakea), Anfangsfeld im ΛCDM-Modell mit Planck-2018-
// Werten, bewegt in der Zeldovich-Näherung x = q + D(t)·ψ(q) (darkmatter.js, gerechnet im Worker). Gezeigt wird eine Kugel
// mit R = 80 Mpc. Dichtebild: Teilchen als weiche Punkte in ein eigenes Bild (Summe = projizierte Dichte, Kanal g = Dichte ×
// Geschwindigkeit längs der Sichtlinie), geteilt durch die Dichte einer gleichmäßigen Verteilung entlang desselben Sehstrahls
// (analytisch: n̄ · cos³θ / f² · ∫ s² ds) → Kontrast δ. Looks: Planetarium (Vorbild: Licht hinter der Materie, Schwärzung
// exp(−k δ)), Leuchtend (Dichte als Licht), Geschwindigkeit (auf uns zu blau, von uns weg rot). Schicht quer zur Blickrichtung
// durch die Mitte (Regler „Schichtdicke“) wie ein Schnitt durch eine Simulation. Galaxien = Spur-Teilchen der Halos, leuchten
// auf, wenn der Halo kollabiert (D·δ_lin = 1,686).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { disposeScene } from '../vol.js';
import { MPC } from '../astro.js';
import { makeField, atAge, AGE, particleMass } from '../darkmatter.js';

const N = 128, L = 160, R = 80;
const T0 = 0.2;   // Start des Zeitraffers [Mrd. Jahre nach dem Urknall, z ≈ 20]
// Tempo [Mrd. Jahre je Sekunde]; Namen kurz wie an der Erde, sonst ragen sie in der Zeitleiste über den Rand
const SPEEDS = [[0.25, '250 Mio/s'], [0.5, '500 Mio/s'], [1, '1 Mrd/s'], [2, '2 Mrd/s']];
const SMOOTH = [[0.8, 'sehr fein'], [1.25, 'fein'], [2, 'mittel'], [3.5, 'grob']];
const num = (v, d = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

const LATTICE = /* glsl */ `
uniform float uD, uSlab, uDT;
uniform vec3 uFwd;
vec3 lattice(float id) {
  float x = mod(id, ${N}.0), y = mod(floor(id / ${N}.0), ${N}.0), z = floor(id / ${N * N}.0);
  // Startort zufällig in der eigenen Gitterzelle (± ½ Zelle): sonst zeichnet sich das Gitter in den Leerräumen ab
  vec3 j = fract(sin(vec3(id * 0.1031, id * 0.1137, id * 0.1271)) * 43758.5453) - 0.5;
  return (vec3(x, y, z) + 0.5 + j) * ${(L / N).toFixed(6)} - ${(L / 2).toFixed(1)};
}
vec3 wrapBox(vec3 p) { return mod(p + ${(L / 2).toFixed(1)}, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)}; }
// Gewicht: weicher Rand der Kugel und der Schicht quer zur Blickrichtung (durch die Mitte)
float keep(vec3 x) {
  float s = abs(dot(x - cameraPosition, uFwd) - uDT);
  return smoothstep(${R.toFixed(1)}, ${(R * 0.84).toFixed(1)}, length(x)) * (1.0 - smoothstep(0.42 * uSlab, 0.5 * uSlab, s));
}`;

// Dichtebild: jedes Teilchen ein Gauß-Fleck mit Summe 1 (Fläche ≈ 0,2606 · S²)
const DM_VERT = /* glsl */ `
${LATTICE}
uniform float uSplat, uFrt;
varying float vW, vV, vS;
void main() {
  vec3 x = wrapBox(lattice(float(gl_VertexID)) + uD * position);
  vW = keep(x);
  // Zeldovich: Geschwindigkeit ∝ ψ; Vorzeichen + = von uns weg
  vV = dot(position, normalize(x - cameraPosition)) / 7.0;
  gl_Position = vW > 0.0 ? projectionMatrix * modelViewMatrix * vec4(x, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  // Größe ≈ Zellweite auf dem Bild (uSplat × Zelle), mindestens 1,5 px
  vS = clamp(uSplat * uFrt * ${(L / N).toFixed(6)} / max(-(modelViewMatrix * vec4(x, 1.0)).z, 0.1), 1.5, 9.0);
  gl_PointSize = vS;
}`;
const DM_FRAG = /* glsl */ `
varying float vW, vV, vS;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float k = vW * exp(-3.0 * r2) / (0.2606 * vS * vS);
  gl_FragColor = vec4(k, k * vV, 0.0, 0.0);
}`;

const COMP_FRAG = /* glsl */ `
uniform sampler2D uDen;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCam, uFwd;
uniform float uNbar, uF, uSlab, uDT, uView, uAbs, uBg, uGlow, uVel, uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 glowRamp(float x) {
  vec3 c = mix(vec3(0.0), vec3(0.03, 0.05, 0.28), smoothstep(0.0, 0.35, x));
  c = mix(c, vec3(0.42, 0.22, 0.82), smoothstep(0.3, 0.62, x));
  c = mix(c, vec3(1.0, 0.78, 0.95), smoothstep(0.58, 0.85, x));
  return mix(c, vec3(1.7, 1.6, 1.45), smoothstep(0.85, 1.0, x));
}
void main() {
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(mat3(uCamWorld) * (v.xyz / v.w));
  float b = dot(uCam, dir), c = dot(uCam, uCam) - ${(R * R).toFixed(1)}, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float ct = max(dot(dir, uFwd), 0.05);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  t0 = max(t0, (uDT - 0.46 * uSlab) / ct); t1 = min(t1, (uDT + 0.46 * uSlab) / ct);
  if (t1 <= t0) discard;
  // gleichmäßige Verteilung entlang des Sehstrahls → mittlere Summe je Pixel
  float su = uNbar * ct * ct * ct / (uF * uF) * (t1 * t1 * t1 - t0 * t0 * t0) / 3.0;
  vec4 d = texture2D(uDen, vUv);
  float del = d.r / max(su, 1e-6);
  // Rand: Tiefe der Schicht im Vergleich zur Mitte (Kugelrand läuft weich aus)
  float depth = clamp((t1 - t0) * ct / min(uSlab, ${(2 * R).toFixed(1)}), 0.0, 1.0);
  float edge = smoothstep(0.0, 0.35, depth);
  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.04;
  vec3 col;
  float a = 1.0;
  if (uView < 0.5) {
    // Planetarium: Licht hinter der Materie, Dunkle Materie schwärzt; Leerräume hell, Fäden schwarz
    float I = uBg * exp(-uAbs * del) * (1.0 + grain);
    col = vec3(0.86, 0.87, 0.9) * I;
    a = edge;
  } else {
    float x = clamp((log(max(del, 1e-3)) / 2.302585 + 0.45) / 1.9, 0.0, 1.0);
    vec3 g = glowRamp(x) * uGlow * (1.0 + grain);
    if (uView > 1.5) {
      float w = clamp(d.g / max(d.r, 1e-5) * uVel, -1.0, 1.0);
      g = (length(g) + 0.02) * mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.35, 0.25), 0.5 + 0.5 * w) * (0.25 + 0.75 * abs(w));
    }
    col = g * edge;
    a = 0.0;
  }
  // Planetarium: vormultipliert über dem Himmel · Leuchtend/Geschwindigkeit: rein additiv (a = 0)
  gl_FragColor = vec4(uView < 0.5 ? col * a : col, a);
}`;

// Galaxien: Spur-Teilchen der Halos, Kern + Lichthof, Größe nach Halomasse; erscheinen beim Kollaps des Halos
const GAL_VERT = /* glsl */ `
${LATTICE}
attribute vec4 gal;   // Index, Helligkeit, Größe, D des Kollapses
uniform float uPx, uScale, uSize, uCut;
varying float vK;
void main() {
  vec3 x = wrapBox(lattice(gal.x) + uD * position);
  float on = smoothstep(gal.w * 0.85, gal.w * 1.05, uD) * step(uCut, gal.y);
  vK = keep(x) * on * gal.y;
  vec4 mv = modelViewMatrix * vec4(x, 1.0);
  gl_Position = vK > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = clamp(uScale * gal.z * uSize / max(-mv.z, 0.1), 2.0, 90.0) * uPx;
}`;
const GAL_FRAG = /* glsl */ `
uniform float uGain;
varying float vK;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float k = exp(-r2 * 30.0) * 1.8 + exp(-r2 * 7.0) * 0.45 + exp(-r2 * 2.5) * 0.14;
  gl_FragColor = vec4(vec3(1.0, 0.68, 0.32) * k * vK * uGain * 2.2, 1.0);
}`;
// Wege der Galaxien: Linie vom Startort q zum heutigen Ort (ohne Umlauf über den Rand des Würfels)
const PATH_VERT = /* glsl */ `
${LATTICE}
attribute vec2 gal;   // Index, 0 = Start, 1 = Ende
uniform float uCut;
attribute float bright;
varying float vK;
void main() {
  vec3 q = lattice(gal.x), x = q + gal.y * uD * position;
  vK = keep(q + uD * position) * step(uCut, bright);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, 1.0);
}`;
const PATH_FRAG = 'uniform float uGain; varying float vK; void main() { gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * 0.22 * vK * uGain, 1.0); }';

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const renderer = ctx.renderer;
  const n3 = N ** 3;
  const mp = particleMass(L, N);

  // Teilchen: position = ψ (Lage aus gl_VertexID), wird nach dem Rechnen gefüllt
  const psiAttr = new THREE.BufferAttribute(new Float32Array(n3 * 3), 3);
  const dmGeo = new THREE.BufferGeometry();
  dmGeo.setAttribute('position', psiAttr);
  const shared = { uD: { value: 1 }, uSlab: { value: 32 }, uDT: { value: 0 }, uFwd: { value: new THREE.Vector3(0, 0, -1) } };
  const dmMat = new THREE.ShaderMaterial({
    vertexShader: DM_VERT, fragmentShader: DM_FRAG, uniforms: { ...shared, uSplat: { value: 1.6 }, uFrt: { value: 400 } },
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const dmPts = new THREE.Points(dmGeo, dmMat);
  dmPts.frustumCulled = false;
  const dmScene = new THREE.Scene().add(dmPts);
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;

  const cu = {
    ...shared, uDen: { value: rt.texture }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    uNbar: { value: n3 / L ** 3 }, uF: { value: 1 }, uView: { value: 0 }, uAbs: { value: 1.1 }, uBg: { value: 0.34 }, uGlow: { value: 1 }, uVel: { value: 1.6 }, uTime: { value: 0 },
  };
  const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: COMP_FRAG, uniforms: cu, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  comp.frustumCulled = false;
  comp.renderOrder = 1;
  scene.add(comp);

  // Galaxien + Wege (Geometrie nach dem Rechnen)
  const gu = { ...shared, uPx: { value: 1 }, uScale: { value: 600 }, uSize: { value: 1 }, uCut: { value: 0 }, uGain: { value: 1.4 } };
  const galMat = new THREE.ShaderMaterial({ vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, uniforms: gu, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  const gals = new THREE.Points(new THREE.BufferGeometry(), galMat);
  gals.frustumCulled = false;
  gals.renderOrder = 3;
  scene.add(gals);
  const pu = { ...shared, uCut: gu.uCut, uGain: { value: 1 } };
  const paths = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ vertexShader: PATH_VERT, fragmentShader: PATH_FRAG, uniforms: pu, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
  paths.frustumCulled = false;
  paths.renderOrder = 2;
  paths.visible = false;
  scene.add(paths);

  // Abzeichen: Orte aus den Halos (folgen ihrem Spur-Teilchen durch die Zeit)
  const HS = ['cluster', 'halo', 'filament', 'void', 'caustic', 'rotation', 'lensing', 'bullet', 'search', 'budget'];
  const spots = Object.fromEntries(HS.map((id) => [id, { pos: new THREE.Vector3(), track: null, off: new THREE.Vector3() }]));
  let field = null;
  const lat = (i) => new THREE.Vector3(i % N, Math.floor(i / N) % N, Math.floor(i / (N * N))).addScalar(0.5).multiplyScalar(L / N).subScalar(L / 2);
  const wrapV = (p) => p.set(...p.toArray().map((c) => ((c + L / 2) % L + L) % L - L / 2));
  const posAt = (i, D, out = new THREE.Vector3()) => wrapV(out.copy(lat(i)).addScaledVector(new THREE.Vector3(field.psi[i * 3], field.psi[i * 3 + 1], field.psi[i * 3 + 2]), D));

  function place() {
    const H = field.halos.map((h, k) => ({ ...h, k, p: posAt(h.i, 1) }));
    // Abzeichen in der Ebene quer zur Heim-Blickrichtung (dort liegt die Schicht beim Ankommen), über das Bild verteilt
    const hd = home.pos.clone().normalize(), inPlane = (p, r) => Math.abs(p.dot(hd)) < 9 && p.length() < r;
    const near = H.filter((h) => inPlane(h.p, 56));
    const pick = (list, f) => list.find(f) || list[0] || H[0];
    const used = new Set();
    const take = (h) => { used.add(h.k); return h; };
    const free = (h) => !used.has(h.k) && [...used].every((k) => H[k].p.distanceTo(h.p) > 15);
    const set = (id, h, off = [0, 0, 0]) => { spots[id].track = h.i; spots[id].off.set(...off); };
    const big = take(pick(near, () => true));
    set('cluster', big);
    // engstes Paar großer Halos nahe der Mitte → Faden (Mitte) und Bullet-Cluster (der kleinere)
    let pair = null;
    const top = near.slice(0, 14);
    for (const a of top) for (const b of top) if (a.k < b.k && !used.has(a.k) && !used.has(b.k)) { const d = a.p.distanceTo(b.p); if (d > 6 && d < 24 && (!pair || d < pair.d)) pair = { a, b, d }; }
    if (pair) { take(pair.a); take(pair.b); set('bullet', pair.b); spots.filament.track = null; spots.filament.mid = [pair.a.i, pair.b.i]; } else { set('bullet', take(pick(near, free))); spots.filament.mid = [big.i, H[1].i]; }
    set('lensing', take(pick(near, free)));
    set('halo', take(pick(near.slice(Math.floor(near.length * 0.3)), free)));
    set('rotation', take(pick(near.slice(Math.floor(near.length * 0.5)), free)));
    set('search', take(pick(near.slice(Math.floor(near.length * 0.6)), free)));
    set('caustic', big, [5, 3.5, 0]);
    // Leerraum: Gitterpunkt nahe der Mitte mit größtem Abstand zu allen Halos
    let best = null;
    for (let x = -48; x <= 48; x += 4) for (let y = -48; y <= 48; y += 4) for (let z = -48; z <= 48; z += 4) {
      const p = new THREE.Vector3(x, y, z);
      if (!inPlane(p, 50)) continue;
      const d = Math.min(...H.map((h) => h.p.distanceTo(p)));
      if (!best || d > best.d) best = { p, d };
    }
    spots.void.fixed = best.p;
    spots.budget.fixed = new THREE.Vector3(0, 1, 0).addScaledVector(hd, -hd.y).normalize().multiplyScalar(R * 0.6);
  }
  function trackSpots(D) {
    if (!field) return;
    const tmp = new THREE.Vector3();
    for (const id of HS) {
      const s = spots[id];
      if (s.fixed) s.pos.copy(s.fixed);
      else if (s.mid) s.pos.copy(posAt(s.mid[0], D)).add(posAt(s.mid[1], D, tmp)).multiplyScalar(0.5);
      else if (s.track !== null) posAt(s.track, D, s.pos).add(s.off);
    }
  }

  function upload(f) {
    field = f;
    psiAttr.array.set(f.psi);
    psiAttr.needsUpdate = true;
    // Galaxien: zentrale Galaxie groß, Begleiter kleiner; Helligkeit nach Halomasse (log), Rang für „Ab Halomasse“
    const ga = [], gp = [], pa = [], pp = [], pb = [];
    const mMax = Math.log(f.halos[0].m), mMin = Math.log(f.halos[f.halos.length - 1].m);
    f.halos.forEach((h) => {
      const w = (Math.log(h.m) - mMin) / Math.max(1e-6, mMax - mMin);
      h.gal.forEach((j, k) => {
        gp.push(f.psi[j * 3], f.psi[j * 3 + 1], f.psi[j * 3 + 2]);
        ga.push(j, 0.3 + 0.7 * w, k ? 0.25 + 0.15 * ((j * 7919) % 97) / 97 : 0.5 + 2.2 * w * w, h.form);
        if (!k) for (const e of [0, 1]) { pp.push(f.psi[j * 3], f.psi[j * 3 + 1], f.psi[j * 3 + 2]); pa.push(j, e); pb.push(0.25 + 0.75 * w); }
      });
    });
    gals.geometry.dispose();
    gals.geometry = new THREE.BufferGeometry();
    gals.geometry.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    gals.geometry.setAttribute('gal', new THREE.Float32BufferAttribute(ga, 4));
    paths.geometry.dispose();
    paths.geometry = new THREE.BufferGeometry();
    paths.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    paths.geometry.setAttribute('gal', new THREE.Float32BufferAttribute(pa, 2));
    paths.geometry.setAttribute('bright', new THREE.Float32BufferAttribute(pb, 1));
    place();
    trackSpots(atAge(T).D);
    dirty = true;
  }
  // Rechnen im Worker (sonst im Hauptfaden), neue Saat oder Glättung rechnet neu
  let seed = 7, rs = 1.25, job = 0;
  function compute() {
    const id = ++job, args = { N, L, Rs: rs, seed };
    return new Promise((res) => {
      let wk = null;
      try { wk = new Worker(new URL('../darkmatter_worker.js', import.meta.url), { type: 'module' }); } catch (e) { wk = null; }
      const done = (f) => { if (wk) wk.terminate(); if (id === job) upload(f); res(); };
      if (!wk) { done(makeField(args)); return; }
      wk.onmessage = (e) => done(e.data);
      wk.onerror = () => { wk.terminate(); wk = null; done(makeField(args)); };
      wk.postMessage(args);
    });
  }

  let dirty = true;
  // Dichtebild in eigener Auflösung (Bruchteil der Bühne)
  let resScale = ctx.detail > 0.9 ? 0.75 : 0.55, W = 2, Hh = 2;
  function fit() { rt.setSize(Math.max(2, Math.round(W * resScale)), Math.max(2, Math.round(Hh * resScale))); dirty = true; }
  // Zeit: Alter T [Mrd. Jahre]; Zeitraffer läuft vom frühen Universum bis heute, hält dort 2,5 s und beginnt neu
  let T = AGE, spdIdx = 3, playing = false, hold = 0, rsIdx = 1;
  const stamp = () => { const { z } = atAge(T); return `${num(T)} Mrd. J. nach dem Urknall · z = ${z < 0.05 ? '0' : num(z, z < 1 ? 2 : 1)}`; };
  const lookOnly = (k, t) => ({ active: () => cu.uView.value === k, only: `Wirkt nur im Look „${t}“ (Ansicht).` });
  registerLayers('darkmatter', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: false,
      fmt: (i) => SPEEDS[Math.round(i)][1],
      hint: 'Vom fast glatten Universum (z ≈ 20) bis heute: Die Schwerkraft verstärkt die winzigen Dichteschwankungen, Materie fließt aus den Leerräumen in Wände, Fäden und Knoten; dort leuchten die ersten Galaxien auf.',
      set: (i, p) => { spdIdx = Math.round(i); if (p && !playing && T >= AGE - 0.01) T = T0; playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${stamp()} · ${playing ? SPEEDS[spdIdx][1] : 'angehalten'}` },
    { id: 'dmAbs', type: 'range', group: 'Dunkle Materie', label: 'Schwärzung durch die Materie', value: 1.1, min: 0.25, max: 2, step: 0.05, unit: '×', set: (v) => { cu.uAbs.value = v; }, ...lookOnly(0, 'Planetarium') },
    { id: 'dmBg', type: 'range', label: 'Helligkeit des Hintergrunds', value: 0.34, min: 0.2, max: 1.2, step: 0.05, unit: '×', set: (v) => { cu.uBg.value = v; }, ...lookOnly(0, 'Planetarium') },
    { id: 'dmGlow', type: 'range', label: 'Leuchtkraft der Dichte', value: 1, min: 0.25, max: 3, step: 0.25, unit: '×', set: (v) => { cu.uGlow.value = v; }, active: () => cu.uView.value > 0, only: 'Wirkt in den Looks „Leuchtend“ und „Geschwindigkeit“ (Ansicht).' },
    { id: 'dmVel', type: 'range', label: 'Farbstärke der Geschwindigkeit', value: 1.6, min: 0.5, max: 4, step: 0.1, unit: '×', set: (v) => { cu.uVel.value = v; }, ...lookOnly(2, 'Geschwindigkeit') },
    { id: 'dmSlab', type: 'range', label: 'Schichtdicke', value: 32, min: 8, max: 160, step: 8, unit: ' Mpc', hint: 'Schnitt quer zur Blickrichtung durch die Mitte; 160 Mpc = ganze Kugel. Dünne Schichten zeigen feine Fäden und Kaustiken, dicke die Überlagerung vieler Strukturen.',
      set: (v) => { shared.uSlab.value = v >= 160 ? 1e4 : v; dirty = true; } },
    { id: 'dmSplat', type: 'range', label: 'Größe der Teilchen', value: 1.6, min: 0.5, max: 2.5, step: 0.1, unit: '× Zelle', set: (v) => { dmMat.uniforms.uSplat.value = v; dirty = true; } },
    { id: 'dmRes', type: 'range', label: 'Auflösung des Dichtebilds', value: ctx.detail > 0.9 ? 0.75 : 0.55, min: 0.35, max: 1, step: 0.05, unit: '×', set: (v) => { resScale = v; fit(); } },
    { id: 'galGain', type: 'range', group: 'Galaxien', label: 'Helligkeit', value: 1.4, min: 0, max: 3, step: 0.1, unit: '×', set: (v) => { gu.uGain.value = v; pu.uGain.value = v; } },
    { id: 'galSize', type: 'range', label: 'Größe', value: 1, min: 0.4, max: 2.5, step: 0.1, unit: '×', set: (v) => { gu.uSize.value = v; } },
    { id: 'galCut', type: 'range', label: 'Nur schwere Halos', value: 0, min: 0, max: 0.9, step: 0.1, fmt: (v) => (v ? `oberste ${Math.round((1 - v) * 100)} %` : 'alle'), set: (v) => { gu.uCut.value = v ? 0.25 + 0.75 * v : 0; } },
    { id: 'smooth', type: 'range', group: 'Modell', label: 'Kleinste Strukturen', value: rsIdx, min: 0, max: SMOOTH.length - 1, step: 1, fmt: (i) => SMOOTH[Math.round(i)][1],
      hint: 'Glättung des Anfangsfelds (1,25 Mpc = eine Zelle, Standard). „Fein“ zeigt mehr Kaustiken, verschmiert aber Knoten stärker – eine Grenze der Zeldovich-Näherung. Rechnet neu (≈ 2 s).',
      set: (i) => { const k = Math.round(i); if (k !== rsIdx) { rsIdx = k; rs = SMOOTH[k][0]; compute(); } } },
  ]);
  const go = (t) => { T = t; dirty = true; };
  const controls = [
    { id: 'look', label: 'Look', value: 'amnh', options: [['amnh', 'Planetarium'], ['glow', 'Leuchtend'], ['vel', 'Geschwindigkeit']],
      set: (v) => { cu.uView.value = { amnh: 0, glow: 1, vel: 2 }[v] ?? 0; } },
    { id: 'gal', label: 'Galaxien', value: 'on', options: [['on', 'An'], ['off', 'Aus']], set: (v) => { gals.visible = v === 'on'; } },
    { id: 'paths', label: 'Wege', value: 'off', options: [['off', 'Aus'], ['on', 'Seit dem Anfang']], set: (v) => { paths.visible = v === 'on'; } },
    { id: 'age', type: 'range', show: true, label: 'Zeitpunkt', value: AGE, min: T0, max: AGE, step: 0.05, fmt: (v) => `${num(v)} Mrd. J.`, get: () => T, set: (v) => go(v) },
    { id: 'start', type: 'action', show: true, label: 'Anfang', button: 'z ≈ 20', run: () => go(T0) },
    { id: 'z2', type: 'action', show: true, label: 'Mittag der Sternentstehung', button: 'z ≈ 2', run: () => go(3.3) },
    { id: 'now', type: 'action', show: true, label: 'Heute', button: 'Heute', run: () => go(AGE) },
    { id: 'reseed', type: 'action', show: true, label: 'Anderes Universum', button: 'Neu würfeln', run: () => { seed = 1 + Math.floor(Math.random() * 9999); compute(); } },
  ];

  const hotspots = HS.map((id) => ({ id, kind: 'info', pos: spots[id].pos, visible: () => !!field }));
  const home = { pos: new THREE.Vector3(62, 38, 112), target: new THREE.Vector3(0, 0, 0) };
  const seen = new THREE.Matrix4(), fwd = new THREE.Vector3();
  let lastD = -1;

  return {
    scene, camera, unit: MPC, hotspots, controls, home,
    orbit: { minDistance: 4, maxDistance: 600, cineSpeed: 0.35 },
    ready: compute().then(() => Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(dmScene, camera)])),
    look: { exposure: 1.1, bloom: 0.12, sat: 1.02, con: 0.1, sh: [1.0, 0.98, 0.96] },
    update(dt, t, cam) {
      if (playing) {
        if (T >= AGE) { hold += dt; if (hold > 2.5) { hold = 0; T = T0; } } else T = Math.min(AGE, T + dt * SPEEDS[spdIdx][0]);
      }
      const { D } = atAge(T);
      shared.uD.value = D;
      cu.uTime.value = t;
      trackSpots(D);
      cam.updateMatrixWorld();
      cam.getWorldDirection(fwd);
      shared.uFwd.value.copy(fwd);
      shared.uDT.value = Math.max(0, -cam.position.dot(fwd));
      cu.uCam.value.copy(cam.position);
      cu.uCamWorld.value.copy(cam.matrixWorld);
      cu.uInvProj.value.copy(cam.projectionMatrixInverse);
      cu.uF.value = dmMat.uniforms.uFrt.value = (rt.height / 2) / Math.tan((cam.fov * Math.PI) / 360);
      // Dichtebild neu nur bei Bewegung der Kamera oder der Zeit
      if (!field || (!dirty && D === lastD && seen.equals(cam.matrixWorld))) return;
      seen.copy(cam.matrixWorld); lastD = D; dirty = false;
      const prev = renderer.getRenderTarget(), ca = renderer.getClearAlpha(), cc = renderer.getClearColor(new THREE.Color());
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(dmScene, cam);
      renderer.setClearColor(cc, ca);
      renderer.setRenderTarget(prev);
    },
    live: () => (!field ? 'Anfangsfeld wird gerechnet …'
      : `${stamp()} · ${num(n3 / 1e6, 1)} Mio. Teilchen zu je ${num(mp / 1e10, 1)} · 10¹⁰ Sonnenmassen · schwerster Halo ≈ ${num(field.halos[0].m * mp / 1e14, 1)} · 10¹⁴ M☉ (Modell)`),
    setPixelRatio(pr, H) {
      W = Math.round(H * camera.aspect); Hh = H; fit();
      gu.uPx.value = pr; gu.uScale.value = (H / 2) / Math.tan((camera.fov * Math.PI) / 360) / pr;
    },
    dispose: () => { job++; disposeScene(scene); dmGeo.dispose(); dmMat.dispose(); rt.dispose(); },
  };
}
