// Sonnenstreifer-Komet der Station Sonne (Vorschau „Sonne optimieren“ 28.10.2026, Ereig:B): Kopf mit Ionen- und Staubschweif
// auf einer Parabel um die Sonne (Brennpunkt = Sonnenmitte), Schweife zeigen von der Sonne weg, der Staubschweif krümmt sich
// gegen die Flugrichtung. Am sonnennächsten Punkt verdampft der Kern und zerfällt in eine Funkenspur – wie die meisten
// Kreutz-Kometen, die SOHO/LASCO findet (über 5.000 seit 1995, Sungrazer Project). Bahn so gelegt, dass sie durch einen
// sichtbaren Punkt knapp über dem Rand läuft; Tempo nach dem Flächensatz (dθ/dt ∝ 1/r²), im Zeitraffer (≈ 10 s statt Stunden).
// Schweife als Bänder, die sich je Bild zur Kamera drehen; additiv, Tiefentest gegen die Sonnenkugel (hinter ihr verdeckt).

import * as THREE from 'three';

const N = 40;           // Stücke je Schweif
const SPARKS = 28;      // Funken beim Zerfall
const TH0 = -1.1, TH_BREAK = 0.08, T_SPARK = 2.6;

const TAIL_VERT = /* glsl */ `
attribute vec2 aUv;
varying vec2 vUv;
void main() { vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const TAIL_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uI;
varying vec2 vUv;
void main() {
  float a = exp(-vUv.y * vUv.y * 2.5) * pow(1.0 - vUv.x, 1.6) * smoothstep(0.0, 0.04, vUv.x);
  gl_FragColor = vec4(uCol * a * uI, 1.0);
}
`;
const SPARK_VERT = /* glsl */ `
attribute float aA;
uniform float uPx;
varying float vA;
void main() {
  vA = aA;
  vec4 pv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(0.006 / (uPx * max(-pv.z, 1e-3)), 2.0, 9.0);
  gl_Position = projectionMatrix * pv;
}
`;
const SPARK_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  gl_FragColor = vec4(vec3(2.6, 2.2, 1.6) * exp(-dot(c, c) * 14.0) * vA, 1.0);
}
`;

function headTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(220,235,255,0.55)');
  grd.addColorStop(1, 'rgba(180,210,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createComet(rand) {
  const group = new THREE.Group();
  group.visible = false;
  const tail = (col) => {
    const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
    for (let i = 0; i <= N; i++) { uv.set([i / N, -1, i / N, 1], i * 4); if (i < N) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: TAIL_VERT, fragmentShader: TAIL_FRAG, uniforms: { uCol: { value: new THREE.Vector3(...col) }, uI: { value: 0 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const ion = tail([0.9, 1.25, 2.1]), dust = tail([2.0, 1.6, 1.0]);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xeaf2ff }));
  group.add(head);
  const sp = new THREE.BufferGeometry(), spPos = new Float32Array(SPARKS * 3), spA = new Float32Array(SPARKS);
  sp.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  sp.setAttribute('aA', new THREE.BufferAttribute(spA, 1));
  const sparkU = { uPx: { value: 0.001 } };
  const sparks = new THREE.Points(sp, new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, uniforms: sparkU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sparks.frustumCulled = false;
  group.add(sparks);

  const st = { th: 0, q: 1.2, K: 0, t: 0, br: -1, er: new THREE.Vector3(), et: new THREE.Vector3(), p0: new THREE.Vector3(), v0: new THREE.Vector3() };
  const spV = Array.from({ length: SPARKS }, () => new THREE.Vector3());
  const spD = new Float32Array(SPARKS);
  const at = (th, out) => out.copy(st.er).multiplyScalar(Math.cos(th)).addScaledVector(st.et, Math.sin(th)).multiplyScalar(2 * st.q / (1 + Math.cos(th)));

  // Bahn durch einen sichtbaren Himmelspunkt knapp über dem Rand: Sehstrahlen durch einige Bildpunkte, der nächste Punkt des
  // Strahls zur Sonnenmitte wird der sonnennächste Punkt der Bahn (q = 1,08 … 1,6 R☉); Flugrichtung dort waagerecht im Bild
  const ndc = new THREE.Vector3(), rd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const SCREEN = [[0.15, 0.55], [-0.15, 0.55], [0.3, 0.4], [-0.3, 0.4], [0.0, 0.7], [0.25, 0.75], [-0.25, 0.75], [0.45, 0.2], [-0.45, 0.2]];
  function start(cam) {
    cam.updateMatrixWorld();
    right.set(1, 0, 0).transformDirection(cam.matrixWorld);
    up.set(0, 1, 0).transformDirection(cam.matrixWorld);
    const ok = [];
    for (const [x, y] of SCREEN) {
      rd.copy(ndc.set(x, y, 0.5).unproject(cam)).sub(cam.position).normalize();
      const tb = -cam.position.dot(rd), P = cam.position.clone().addScaledVector(rd, tb), b = P.length();
      if (tb > 0 && b > 1.08 && b < 1.6) ok.push(Object.assign(P, { sx: x }));
    }
    let P = ok.length ? ok[Math.floor(rand() * ok.length)] : null;
    if (!P) {   // Kamera weit weg: Punkt in der Himmelsebene schräg über der Sonne
      const w = cam.position.clone().normalize();
      P = up.clone().multiplyScalar(0.6).addScaledVector(right, rand() < 0.5 ? 0.8 : -0.8);
      P.addScaledVector(w, -P.dot(w)).setLength(1.3);
    }
    st.q = P.length();
    st.er.copy(P).normalize();
    // Anflug von der Seite gegenüber dem Bahnpunkt, damit der Komet möglichst lange durchs Bild zieht
    st.et.copy(right).addScaledVector(st.er, -right.dot(st.er)).normalize().multiplyScalar((P.sx ?? rand() - 0.5) < 0 ? -1 : 1);
    st.K = 0.15 * st.q * st.q;
    st.th = TH0; st.t = 0; st.br = -1;
    spA.fill(0);
    group.visible = true;
  }

  const p = new THREE.Vector3(), v = new THREE.Vector3(), rad = new THREE.Vector3(), tmp = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
  // Schweif als Band: Mittellinie p + rad · s · L − v · s² · L · curve (Staub bleibt hinter der Flugrichtung zurück), Breite
  // quer zu Tangente und Sehstrahl, nach hinten breiter
  function ribbon(mesh, L, curve, width, cam) {
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      tmp.copy(p).addScaledVector(rad, s * L).addScaledVector(v, -s * s * L * curve);
      side.copy(rad).addScaledVector(v, -2 * s * curve).cross(toCam.copy(cam.position).sub(tmp)).normalize().multiplyScalar(width * (0.25 + 1.6 * s));
      a.setXYZ(2 * i, tmp.x - side.x, tmp.y - side.y, tmp.z - side.z);
      a.setXYZ(2 * i + 1, tmp.x + side.x, tmp.y + side.y, tmp.z + side.z);
    }
    a.needsUpdate = true;
  }

  // je Bild; px = Pixelgröße bei Abstand 1 (wie uPx der Fäden)
  function update(dt, cam, px) {
    if (!group.visible) return;
    st.t += dt;
    sparkU.uPx.value = px;
    if (st.br < 0) {
      const r0 = 2 * st.q / (1 + Math.cos(st.th));
      st.th += dt * st.K / (r0 * r0);
      at(st.th, p);
      at(st.th + 0.002, v).sub(p).normalize();
      if (st.th >= TH_BREAK) {   // Kern verdampft: Funken fliegen mit der Bahngeschwindigkeit weiter, auseinander und vom Licht weg
        st.br = 0;
        st.p0.copy(p);
        const r = p.length();
        st.v0.copy(at(st.th + 1e-3, tmp).sub(p)).multiplyScalar(1e3 * st.K / (r * r));
        spV.forEach((s, i) => { s.copy(st.v0).multiplyScalar(0.75 + 0.5 * rand()).add(tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.05)); spD[i] = rand() * 0.6; });
      }
    } else st.br += dt;
    const r = p.length();
    rad.copy(p).normalize();
    const near = THREE.MathUtils.smoothstep(-r, -2.6 * st.q, -1.05 * st.q);   // three: (x, min, max) – wächst zur Sonne hin
    const fadeIn = THREE.MathUtils.smoothstep(st.t, 0, 1.5);
    const gone = st.br < 0 ? 1 : Math.max(0, 1 - st.br / 1.2);
    const camD = cam.position.distanceTo(p), w = 0.004 + 0.004 * camD;
    head.position.copy(p);
    head.scale.setScalar((0.012 + 0.006 * camD) * (1 + 0.6 * near) * gone);
    head.material.opacity = fadeIn * gone;
    ion.material.uniforms.uI.value = fadeIn * (0.35 + 0.9 * near) * (st.br < 0 ? 1 : Math.max(0, 1 - st.br / 2));
    dust.material.uniforms.uI.value = fadeIn * (0.3 + 0.7 * near) * (st.br < 0 ? 1 : Math.max(0, 1 - st.br / 2.4));
    ribbon(ion, 0.2 + 0.45 * near, 0, w, cam);
    ribbon(dust, 0.16 + 0.3 * near, 0.45, w * 1.6, cam);
    if (st.br >= 0) {
      spV.forEach((s, i) => {
        const k = Math.max(st.br - spD[i] * 0.5, 0);
        tmp.copy(st.p0).addScaledVector(s, k).addScaledVector(rad, 0.03 * k * k);
        spPos.set([tmp.x, tmp.y, tmp.z], i * 3);
        spA[i] = THREE.MathUtils.smoothstep(k, 0, 0.15) * Math.max(0, 1 - k / (T_SPARK - spD[i]));
      });
      sp.attributes.position.needsUpdate = true;
      sp.attributes.aA.needsUpdate = true;
      if (st.br > T_SPARK + 0.5) group.visible = false;
    }
  }

  function stop() { group.visible = false; }
  function dispose() { head.material.map.dispose(); }
  return { group, start, update, stop, dispose, get active() { return group.visible; } };
}
