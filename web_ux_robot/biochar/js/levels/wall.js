// Ebene 4: Innenwand eines Gefäßes (Einheit µm) – Hoftüpfel mit Blick in die Kammer, Mikrofibrillen-Riefen, feine
// Warzen-Körnung, Mikrorisse, Bruchkante, Bakterien in Ketten unter einem Biofilm-Schleier, Pilzhyphe mit Sporen,
// Asche als sechseckige Kristallplättchen (Calciumoxalat bzw. nach dem Verkohlen Calcit in gleicher Form).

import * as THREE from 'three';
import { SEM_GLSL, SEM_DET, semMaterial, semDetector } from '../sem.js';
import { disposeGroup } from '../walls.js';
import { mulberry32, gauss, fbm3, vnoisef } from '../util.js';

const R = 16;          // Gefäßradius (Lumen Ø 32 µm)
const TH = 1.6;        // Wanddicke
const S = 15;          // halbe Bogenlänge des Ausschnitts
const Y0 = -17;
const PIT = { sx: 6.0, sy: 5.8, rb: 2.5 };
const HYPHA_PIT = new THREE.Vector2(3.0, -8.7);   // erweiterter Tüpfel (Zelle 0/−2), in den die Hyphe wächst
const BAC = { s: 7.2, y: -3.6 };                   // Mitte der Bakterienkolonie

const topY = (s) => 6.5 + 4.4 * (fbm3(s * 0.12 + 4, 1.3, 0.7, 3) - 0.5) + 0.9 * (fbm3(s * 0.9, 7.1, 2.2, 2) - 0.5);
const surf = (s, y, r) => new THREE.Vector3(r * Math.sin(s / R), y, -r * Math.cos(s / R));
const inward = (s) => new THREE.Vector3(-Math.sin(s / R), 0, Math.cos(s / R));
const along = (s) => new THREE.Vector3(Math.cos(s / R), 0, Math.sin(s / R));

// Risslinie in (s, y) – gleiche Formel im Shader
const crack1Y = (s) => -5 + 4.4 * (vnoisef(s * 0.35, 1, 2) - 0.5) + 0.5 * (vnoisef(s * 1.7, 3, 1) - 0.5);

const FRAG_COMMON = /* glsl */ `
uniform vec3 uDet;
uniform vec3 uTint;
uniform float uR;
uniform vec2 uHyPit;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
${SEM_GLSL}
vec2 hash22(vec2 p) { return vec2(hash13(vec3(p, 1.7)), hash13(vec3(p, 9.2))); }
float crack1Y(float s) { return -5.0 + 4.4 * (vnoise(vec3(s * 0.35, 1.0, 2.0)) - 0.5) + 0.5 * (vnoise(vec3(s * 1.7, 3.0, 1.0)) - 0.5); }
float crack2S(float y) { return 11.0 + 3.0 * (vnoise(vec3(y * 0.3, 4.0, 6.0)) - 0.5) + 0.4 * (vnoise(vec3(y * 1.9, 2.0, 8.0)) - 0.5); }
// Risse: 0 außerhalb, sonst Abstand zur Risskante (< 0 = im Riss)
float cracks(vec2 st, out float rim) {
  float w1 = (0.16 + 0.14 * vnoise(vec3(st.x * 0.8, 5.0, 0.0))) * smoothstep(-15.5, -11.0, st.x) * smoothstep(3.5, -0.5, st.x);
  float d1 = abs(st.y - crack1Y(st.x)) - w1;
  float w2 = (0.12 + 0.12 * vnoise(vec3(st.y * 0.9, 1.0, 7.0))) * smoothstep(-17.0, -12.0, st.y);
  float d2 = abs(st.x - crack2S(st.y)) - w2;
  rim = 0.0;
  if (w1 > 0.02) rim = max(rim, 1.0 - smoothstep(0.0, 0.25, d1));
  if (w2 > 0.02) rim = max(rim, 1.0 - smoothstep(0.0, 0.25, d2));
  return min(w1 > 0.02 ? d1 : 1.0, w2 > 0.02 ? d2 : 1.0);
}
`;

const SURF_FRAG = /* glsl */ `
uniform float uSide;
${FRAG_COMMON}
const float TH = ${TH.toFixed(2)};
const float RB = ${PIT.rb.toFixed(2)};
void main() {
  vec2 st = vUv;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float phi = st.x / uR;
  vec3 Ts = vec3(cos(phi), 0.0, sin(phi));
  vec2 grad = vec2(0.0);
  float extra = 0.0;
  float aa = fwidth(st.x) + fwidth(st.y);          // µm je Pixel: feine Muster blenden aus, bevor sie flimmern
  if (st.x > -12.5 && st.x < 9.0 && st.y > -15.0 && st.y < 3.5) {
    // Hoftüpfel, versetzt angeordnet
    vec2 q = st / vec2(${PIT.sx.toFixed(1)}, ${PIT.sy.toFixed(1)});
    q.x += mod(floor(q.y), 2.0) * 0.5;
    vec2 cell = floor(q);
    vec2 f = (fract(q) - 0.5) * vec2(${PIT.sx.toFixed(1)}, ${PIT.sy.toFixed(1)}) - (hash22(cell) - 0.5) * 0.5;
    float h = hash13(vec3(cell, 4.0));
    float r = length(f);
    if (h < 0.9 && r < RB) {
      grad += -1.1 * f / (RB * RB);
      float ang = 0.75 + (h - 0.5) * 0.6;
      mat2 Rm = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
      vec2 sl = vec2(0.9, h > 0.62 ? 0.7 : 0.26);
      float slit = length((Rm * f) / sl);
      if (slit < 1.0) {
        if (uSide < 0.5) discard;
        // Blick durch den Porus in die linsenförmige Kammer: Strahl schrittweise in die Wand verfolgen (Parallaxe)
        vec3 Vt = vec3(dot(V, Ts), V.y, dot(V, N));
        vec2 off = -Vt.xy / max(Vt.z, 0.2);
        float g = -1.0;
        for (int i = 1; i <= 8; i++) {
          float d = TH * float(i) / 8.0;
          float rch = RB * 0.92 * sin(3.14159 * (0.12 + 0.76 * d / TH));
          if (length(f + off * d) > rch) { g = mix(0.46, 0.12, d / TH); break; }   // Kammerwand: oben heller
        }
        if (g < 0.0) {
          vec2 qb = Rm * (f + off * TH);
          qb = vec2(-qb.y, qb.x);                    // Gegenporus der Nachbarzelle, um 90° gedreht
          if (length(qb / sl) < 1.0) discard;         // ganz hindurch
          g = 0.08;                                    // Rückwand der Kammer
        }
        g *= 0.85 + 0.3 * vnoise(vWorld * 6.0);
        gl_FragColor = semOut(g, uTint);
        return;
      }
      extra += 0.5 * (1.0 - smoothstep(0.0, 0.35, slit - 1.0));                     // Rand des Porus
      extra += 0.34 * (1.0 - smoothstep(0.0, 0.5, abs(r - (RB - 0.35))));          // Hofrand (Wulst)
      extra -= 0.14 * (1.0 - smoothstep(0.2, 1.9, r));                              // Kammer fällt zum Porus ab
    }
  } else {
    // vereinzelte einfache Tüpfel
    vec2 q = st / 4.0;
    vec2 cell = floor(q);
    vec2 f = (fract(q) - 0.5) * 4.0 - (hash22(cell) - 0.5) * 2.0;
    if (hash13(vec3(cell, 8.0)) < 0.18) {
      float r = length(f / vec2(0.45, 0.32));
      if (r < 1.0) discard;
      extra += 0.4 * (1.0 - smoothstep(0.0, 0.6, r - 1.0));
    }
  }
  vec2 hf = st - uHyPit;
  float hr = length(hf);
  if (hr < 1.7) discard;
  extra += 0.5 * (1.0 - smoothstep(0.0, 0.4, hr - 1.7));
  float rim;
  if (cracks(st, rim) < 0.0) discard;
  extra += 0.55 * rim;
  if (uSide > 0.5) {
    // Mikrofibrillen-Riefen der innersten Wandschicht (S3): flache Spirale ≈ 75° zur Zellachse, Abstand ≈ 0,2 µm
    vec2 nrm = vec2(-0.2588, 0.9659);
    float across = dot(st, nrm) + 0.25 * vnoise(vec3(st * 1.3, 2.0));
    float fadeR = 1.0 - smoothstep(0.03, 0.09, aa);
    float ph = across * 31.416;
    grad += 0.32 * fadeR * cos(ph) * nrm;
    extra += 0.025 * fadeR * sin(ph);
    // feine Körnung (Warzen Ø 0,15–0,3 µm), aus der Ferne ausgeblendet
    vec2 wq = st / 0.55;
    vec2 wc = floor(wq);
    vec2 wf = (fract(wq) - 0.2 - 0.6 * hash22(wc + 17.0)) * 0.55;
    float wr = 0.075 + 0.07 * hash13(vec3(wc, 9.0));
    float wd = length(wf);
    float fadeW = 1.0 - smoothstep(0.025, 0.07, aa);
    if (wd < wr && hash13(vec3(wc, 3.0)) < 0.45) {
      grad += -0.7 * fadeW * wf / wr;
      extra += 0.07 * fadeW * smoothstep(wr * 0.4, wr, wd);
    }
  }
  N = normalize(N - uSide * (grad.x * Ts + grad.y * vec3(0.0, 1.0, 0.0)));
  float g = semShade(N, V, uDet, 0.4) + extra;
  g *= 0.86 + 0.28 * vnoise(vWorld * 3.2);
  gl_FragColor = semOut(g, uTint);
}
`;

const EDGE_FRAG = /* glsl */ `
${FRAG_COMMON}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float g = semShade(N, V, uDet, 0.42);
  // Bruchfläche: Schichten der Zellwand und Nanoporen als dunkle Körnung
  g *= 0.85 + 0.15 * sin(vUv.y * 6.2832 * 3.0 + vnoise(vWorld * 2.0) * 2.0);
  float pore = smoothstep(0.6, 0.72, vnoise(vWorld * 11.0));
  g = mix(g, 0.08, 0.75 * pore) + 0.25 * smoothstep(0.52, 0.6, vnoise(vWorld * 11.0)) * (1.0 - pore);
  float rim;
  if (cracks(vec2(vUv.x, vWorld.y), rim) < 0.0) discard;
  gl_FragColor = semOut(g + 0.5 * rim, uTint);
}
`;

// Biofilm: dünner, leicht faltiger Schleier aus extrazellulären Polymeren über der Kolonie, zum Rand ausfransend
const FILM_FRAG = /* glsl */ `
${FRAG_COMMON}
uniform vec2 uC, uRad;
void main() {
  vec2 d = (vUv - uC) / uRad;
  float e = length(d) + 0.45 * (vnoise(vec3(vUv * 0.8, 4.0)) - 0.5) + 0.12 * (vnoise(vec3(vUv * 3.0, 9.0)) - 0.5);
  float mask = 1.0 - smoothstep(0.62, 0.95, e);
  float holes = smoothstep(0.62, 0.7, vnoise(vec3(vUv * 1.6, 1.0)));       // eingerissene Stellen
  float a = mask * (1.0 - holes) * 0.55;
  if (a < 0.01) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float w = vnoise(vec3(vUv * 2.4, 2.0));
  float g = semShade(N, V, uDet, 0.32) + 0.18 * smoothstep(0.55, 0.75, w) + 0.25 * (1.0 - smoothstep(0.0, 0.08, abs(e - 0.78)));
  gl_FragColor = vec4(pow(uTint * clamp(g, 0.0, 1.5), vec3(2.2)), a);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

function uniforms(extra = {}) {
  return {
    uDet: SEM_DET,
    uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
    uR: { value: R },
    uHyPit: { value: HYPHA_PIT },
    ...extra,
  };
}

// Fläche auf dem Zylinder (Wand, Schleier): s, y im Raster, Radius je Punkt
function cylPatch(s0, s1, y0, y1fn, NS, NY, radiusAt, side) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i < NS; i++) {
    const s = s0 + ((s1 - s0) * i) / (NS - 1);
    const y1 = y1fn(s);
    const n = inward(s).multiplyScalar(side);
    for (let j = 0; j < NY; j++) {
      const y = y0 + ((y1 - y0) * j) / (NY - 1);
      const p = surf(s, y, radiusAt(s, y));
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      uv.push(s, y);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NY - 1; j++) {
      const a = i * NY + j, b = (i + 1) * NY + j;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function fractureRibbon() {
  const NS = 400, NT = 6;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < NS; i++) {
    const s = -S + (2 * S * i) / (NS - 1);
    const y = topY(s);
    for (let j = 0; j < NT; j++) {
      const t = j / (NT - 1);
      const p = surf(s, y + 0.25 * Math.sin(t * Math.PI) * (fbm3(s * 2, t, 1, 2) - 0.3), R + TH * t);
      pos.push(p.x, p.y, p.z);
      uv.push(s, t);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NT - 1; j++) {
      const a = i * NT + j, b = (i + 1) * NT + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  let up = 0;
  for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
  return g;
}

// Röhrenradius entlang der Kurve modulieren (Septen, leichte Wellen)
function modulateTube(geo, curve, segs, radial, f) {
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const k = f(i);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function create(ctx) {
  const rand = mulberry32(9001);
  const scene = new THREE.Scene();

  const inner = new THREE.Mesh(cylPatch(-S, S, Y0, topY, 220, 160, () => R, 1), new THREE.ShaderMaterial({
    uniforms: uniforms({ uSide: { value: 1 } }), vertexShader: VERT, fragmentShader: SURF_FRAG,
  }));
  const outer = new THREE.Mesh(cylPatch(-S, S, Y0, topY, 200, 150, () => R + TH, -1), new THREE.ShaderMaterial({
    uniforms: uniforms({ uSide: { value: 0 } }), vertexShader: VERT, fragmentShader: SURF_FRAG,
  }));
  const edge = new THREE.Mesh(fractureRibbon(), new THREE.ShaderMaterial({
    uniforms: uniforms(), vertexShader: VERT, fragmentShader: EDGE_FRAG,
  }));
  scene.add(inner, outer, edge);

  const onWall = (s, y, lift) => surf(s, y, R).add(inward(s).multiplyScalar(lift));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Bakterien: Stäbchen ≈ 0,7 µm dick, 1,5–2,5 µm lang – Ketten (Streptobazillen), Einzelzellen und Teilungspaare
  const bacteria = [];
  for (let c = 0; c < 8; c++) {
    let s = gauss(rand, BAC.s, 1.8), y = gauss(rand, BAC.y, 1.5);
    let ang = rand() * Math.PI;
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const len = 0.75 + rand() * 0.45;
      const half = (1 + 0.72) * len / 2;
      bacteria.push({ s, y, ang, len, ph: rand() * 6.28 });
      ang += (rand() - 0.5) * 0.5;                    // Kette biegt sich leicht
      s += Math.cos(ang) * (half * 2 + 0.08);
      y += Math.sin(ang) * (half * 2 + 0.08);
    }
  }
  for (let k = 0; k < 14; k++) {
    const s = gauss(rand, BAC.s, 2.2), y = gauss(rand, BAC.y, 1.9), ang = rand() * Math.PI;
    bacteria.push({ s, y, ang, len: 0.7 + rand() * 0.6, ph: rand() * 6.28 });
    if (k % 4 === 0) bacteria.push({ s: s + Math.cos(ang) * 1.9, y: y + Math.sin(ang) * 1.9, ang, len: 0.6, ph: rand() * 6.28 });
  }
  const live = bacteria.filter((b) => Math.hypot(b.s - HYPHA_PIT.x, b.y - HYPHA_PIT.y) > 3 && b.s < S - 1 && b.y < topY(b.s) - 1);
  const bacMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.36, 1, 4, 12), semMaterial({ base: 0.5, noise: 4 }), live.length);
  // Schleimfäden: von einigen Zellen zur Wand
  const strands = live.filter((_, k) => k % 3 === 0).map((b) => ({ b, ds: (rand() - 0.5) * 2.4, dy: (rand() - 0.5) * 2.4 }));
  const strandMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), semMaterial({ base: 0.55, noise: 3 }), strands.length);
  const centers = [];
  const placeBacteria = (t) => {
    live.forEach((b, k) => {
      const a = b.ang + 0.05 * Math.sin(t * 0.7 + b.ph);
      const dir = along(b.s).multiplyScalar(Math.cos(a)).addScaledVector(yAxis, Math.sin(a)).normalize();
      q.setFromUnitVectors(yAxis, dir);
      sc.set(1, b.len, 1);
      centers[k] = onWall(b.s, b.y, 0.33);
      bacMesh.setMatrixAt(k, m.compose(centers[k], q, sc));
    });
    bacMesh.instanceMatrix.needsUpdate = true;
    strands.forEach((st, k) => {
      const from = centers[live.indexOf(st.b)];
      const to = onWall(st.b.s + st.ds, st.b.y + st.dy, 0.02);
      const d = to.clone().sub(from);
      const len = d.length();
      q2.setFromUnitVectors(yAxis, d.divideScalar(len));
      strandMesh.setMatrixAt(k, m.compose(from.clone().lerp(to, 0.5), q2, sc.set(0.045, len, 0.045)));
    });
    strandMesh.instanceMatrix.needsUpdate = true;
  };
  placeBacteria(0);
  scene.add(bacMesh, strandMesh);
  const film = new THREE.Mesh(
    cylPatch(BAC.s - 5.5, BAC.s + 5.5, BAC.y - 5, () => BAC.y + 5, 70, 64, (s, y) => R - (0.78 + 0.3 * fbm3(s * 0.6, y * 0.6, 3.3, 2)), 1),
    new THREE.ShaderMaterial({
      uniforms: uniforms({ uC: { value: new THREE.Vector2(BAC.s, BAC.y) }, uRad: { value: new THREE.Vector2(5.2, 4.6) } }),
      vertexShader: VERT, fragmentShader: FILM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
  film.renderOrder = 2;
  scene.add(film);

  // Pilzhyphe: Ø 1,8 µm, wächst über die Wand und in den erweiterten Tüpfel; ein Seitenast trägt eine Sporenkette
  const hyMat = semMaterial({ base: 0.42, noise: 2.5 });
  const path = [[-17, 1.5], [-12, -0.8], [-7, -2.2], [-2.5, -4.6], [1.2, -7.4]].map(([s, y]) => onWall(s, y, 0.92));
  path.push(onWall(HYPHA_PIT.x, HYPHA_PIT.y, 0.2), onWall(HYPHA_PIT.x + 0.3, HYPHA_PIT.y - 0.2, -2.6));
  const hyCurve = new THREE.CatmullRomCurve3(path);
  const septum = (i) => 1 + 0.05 * Math.sin(i * 0.9) - 0.16 * Math.exp(-Math.pow(((i % 34) - 17) / 2.2, 2));
  scene.add(new THREE.Mesh(modulateTube(new THREE.TubeGeometry(hyCurve, 160, 0.9, 14), hyCurve, 160, 14, septum), hyMat));
  const branch = new THREE.CatmullRomCurve3([[-7, -2.2], [-6.2, 0.6], [-4.4, 3.2], [-2.6, 4.6]].map(([s, y]) => onWall(s, y, 0.85)));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(branch, 60, 0.8, 12), hyMat));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), hyMat);
  tip.position.copy(branch.getPoint(1));
  scene.add(tip);
  // Sporen (Konidien, ≈ 2–3 µm): Kette am Astende, einzelne lose auf der Wand
  const spores = [];
  const tipDir = branch.getTangent(1).normalize();
  for (let k = 0; k < 4; k++) {
    const p = branch.getPoint(1).addScaledVector(tipDir, 1.7 + k * 2.15);
    spores.push({ p, dir: tipDir, s: [0.95 - k * 0.05, 1.25, 0.95 - k * 0.05] });
  }
  for (const [s, y] of [[-10.5, 2.5], [-4.2, -9.5], [0.8, 1.6], [-13, -5.5]]) {
    const dir = along(s).applyAxisAngle(inward(s), rand() * 3);
    spores.push({ p: onWall(s, y, 0.95), dir, s: [1.0, 1.35, 0.95] });
  }
  const spMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 22, 16), semMaterial({ base: 0.46, noise: 7 }), spores.length);
  spores.forEach((sp, k) => spMesh.setMatrixAt(k, m.compose(sp.p, q.setFromUnitVectors(yAxis, sp.dir), sc.fromArray(sp.s))));
  spMesh.instanceMatrix.needsUpdate = true;
  scene.add(spMesh);

  // Asche: sechseckige Plättchen flach auf der Wand, dazu eine Druse (strahlig verwachsene Prismen)
  const crystals = [];
  for (let k = 0; k < 22; k++) {
    const s = -14 + rand() * 27, y = -16 + rand() * 18, size = 0.3 + rand() * 0.7;
    if (Math.hypot(s - BAC.s, y - BAC.y) < 4) continue;
    const n = inward(s);
    const tilt = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5);
    q.setFromUnitVectors(yAxis, n.clone().add(tilt).normalize());
    q.multiply(q2.setFromAxisAngle(yAxis, rand() * Math.PI));
    crystals.push({ p: onWall(s, y, size * 0.14), q: q.clone(), s: [size, size * 0.26, size * (0.75 + 0.35 * rand())] });
  }
  const NEEDLE = { s: -9.5, y: -12.2 };
  const dc = onWall(NEEDLE.s, NEEDLE.y, 0.55);
  for (let k = 0; k < 11; k++) {
    const a = k * 2.39996, el = 0.25 + 0.6 * (k / 11);
    const dir = inward(NEEDLE.s).multiplyScalar(Math.sin(el + 0.6))
      .addScaledVector(along(NEEDLE.s), Math.cos(a) * Math.cos(el)).addScaledVector(yAxis, Math.sin(a) * Math.cos(el)).normalize();
    const len = 1.1 + rand() * 0.6;
    crystals.push({ p: dc.clone().addScaledVector(dir, len * 0.45), q: new THREE.Quaternion().setFromUnitVectors(yAxis, dir), s: [0.32, len, 0.32] });
  }
  const crMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), semMaterial({ base: 0.5, noise: 5, edge: 0.4 }), crystals.length);
  crystals.forEach((c, k) => crMesh.setMatrixAt(k, m.compose(c.p, c.q, sc.fromArray(c.s))));
  crMesh.instanceMatrix.needsUpdate = true;
  scene.add(crMesh);

  // Hotspot-Stellen: Tüpfel (Gitterzelle −1/−1), Riss, Bruchkante
  const pitCell = [-1, -1];
  const pitS = (pitCell[0] + 0.5 - (Math.abs(pitCell[1]) % 2) * 0.5) * PIT.sx;
  const pitY = (pitCell[1] + 0.5) * PIT.sy;
  const crackS = -9;
  const edgeS = -2.5;
  const edgePos = surf(edgeS, topY(edgeS) + 0.15, R + TH / 2);
  const camera = new THREE.PerspectiveCamera(40, ctx.aspect, 0.1, 400);
  return {
    scene, camera,
    unit: 1e-6,
    method: 'REM · Sekundärelektronen (Modell)',
    tone: 0,
    grain: 0.07,
    dof: 2.2,
    bloom: 0.06,
    home: { pos: new THREE.Vector3(3, 12, 6), target: surf(0, -3, R) },
    orbit: { minDistance: 5, maxDistance: 38, minAzimuthAngle: -0.9, maxAzimuthAngle: 1.1, minPolarAngle: 0.35, maxPolarAngle: 1.75, enablePan: false },
    hotspots: [
      { id: 'fracture', kind: 'dive', pos: edgePos, normal: new THREE.Vector3(0, 1, 0) },
      { id: 'pits', kind: 'info', pos: onWall(pitS, pitY, 0.4), normal: inward(pitS) },
      { id: 'bacteria', kind: 'info', pos: onWall(BAC.s, BAC.y, 1.3), normal: inward(BAC.s) },
      { id: 'hypha', kind: 'info', pos: hyCurve.getPoint(0.3).add(inward(-9).multiplyScalar(0.9)), normal: inward(-9) },
      { id: 'ash', kind: 'info', pos: onWall(NEEDLE.s, NEEDLE.y, 1.6), normal: inward(NEEDLE.s) },
      { id: 'crack', kind: 'info', pos: onWall(crackS, crack1Y(crackS), 0.2), normal: inward(crackS) },
    ],
    update(dt, t) {
      placeBacteria(t);
      semDetector(t);
      return true;
    },
    dispose() { disposeGroup(scene); },
  };
}
