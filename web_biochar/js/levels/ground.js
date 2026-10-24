// Waldboden unter dem Kohlestück (Ebene 1, Einheit cm): Humus mit Buchenlaub und Ästchen (Boden:A) gemischt mit
// Terra-preta-Krümeln, Kohlesplittern und Feinwurzeln (Boden:B), Vorschau 2026-10-24.
// Weite Fläche (Ø ≈ 1 m) mit leichtem Relief, das zum Stück hin flach ausläuft, unregelmäßigem Rand und Lichtpool in den
// Eckfarben; die Ferne übernimmt die Tiefenunschärfe. Anordnung, Relief und Texturen kommen aus einem Seed: ?seed=…
// legt ihn fest, sonst je Ladung neu (steht in der Konsole). Texturen rechnet ein Worker (ground_tex.js), bis dahin
// trägt der Boden seine Grundfarbe; dann blenden Bodentextur und Blätter in 1,2 s ein (reduced-motion: sofort).
import * as THREE from 'three';
import { mulberry32, lerp, smoothstep } from '../util.js';
import { pnoise, paintAll, TILE } from './ground_tex.js';

const RMAX = 60, NR = 110, NS = 256;      // Fläche: Radius, Ringe (nach innen dichter), Teilungen je Ring
const SHADOW_HALF = 16;                    // halbe Breite der Schattenkarte (cm)
const FADE = 1.2;                          // s, Einblenden der fertigen Texturen
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Seed lesen und Texturen sofort anstoßen – vor dem Aufbau des Stücks, damit der Worker parallel rechnet
export function groundTextures() {
  const p = new URLSearchParams(location.search);
  const seed = p.has('seed') ? parseInt(p.get('seed'), 10) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
  let worker = null, cancelled = false;
  const ready = new Promise((resolve, reject) => {
    const local = () => setTimeout(() => paintAll(seed).then(resolve, reject), 0);   // Ersatz ohne Modul-Worker
    try {
      worker = new Worker(new URL('./ground_tex.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { worker.terminate(); worker = null; e.data.error ? local() : resolve(e.data); };
      worker.onerror = (e) => { e.preventDefault(); worker.terminate(); worker = null; local(); };
      worker.postMessage({ seed });
    } catch {
      local();
    }
  }).then((maps) => {
    if (!cancelled) console.info(`[boden] seed=${seed} · Texturen ${maps.ms} ms`);
    return cancelled ? null : maps;
  });
  return { seed, ready, cancel() { cancelled = true; if (worker) worker.terminate(); } };
}

export function makeGround({ scene, floorY, W, D, crumbGeometry, shadowTex }, tex) {
  const { seed } = tex;
  const rand = mulberry32(seed);
  const S = seed % 997;
  const fbm = (x, z, oct, s) => {
    let t = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { t += a * pnoise(x, z, 1 << 20, s + o * 7); n += a; x *= 2.03; z *= 2.03; a *= 0.5; }
    return t / n;
  };

  // Relief (cm über floorY): unter dem Stück flach, wächst mit dem Abstand – sanfte Wellen (≈ 22 cm) und kleine
  // Buckel (≈ 6 cm); bis ± 1,4 cm am Rand, nahe am Stück wenige Zehntel
  const heightAt = (x, z) => {
    const d = Math.hypot(Math.max(0, Math.abs(x) - W / 2), Math.max(0, Math.abs(z) - D / 2));
    const amp = smoothstep(0.4, 4, d) * Math.min(1.4, 0.1 + 0.045 * Math.hypot(x, z));
    return amp * (2 * (fbm(x / 22 + 50, z / 22 + 50, 3, 11 + S) - 0.5) + 0.7 * (fbm(x / 6 + 50, z / 6 + 50, 2, 31 + S) - 0.5));
  };
  const up = new THREE.Vector3(0, 1, 0);
  const normalAt = (x, z, out = new THREE.Vector3()) => {
    const e = 0.15;
    return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
  };

  const group = new THREE.Group();
  scene.add(group);

  // Bodenfläche: Ringnetz um das Stück (innen fein, außen grob), UV in Weltmaß, Eckfarben = Lichtpool × großflächige
  // Helligkeitswellen (bricht die Kachel), Alpha = unregelmäßiger Rand
  const geo = new THREE.BufferGeometry();
  {
    const n = 1 + NR * NS, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 4), idx = [];
    const vert = (k, x, z) => {
      const r = Math.hypot(x, z);
      pos.set([x, heightAt(x, z), z], k * 3);
      uv.set([x / TILE, -z / TILE], k * 2);
      const pool = lerp(0.4, 1, 1 - smoothstep(3, 32, r)) * (0.85 + 0.3 * fbm(x / 9 + 50, z / 9 + 50, 2, 41 + S));
      const edge = r * (1 + 0.6 * (fbm(x / 14 + 50, z / 14 + 50, 3, 61 + S) - 0.5));
      const a = (1 - smoothstep(26, 50, edge)) * (1 - smoothstep(50, RMAX - 1, r));
      col.set([pool, pool, pool, a], k * 4);
    };
    vert(0, 0, 0);
    for (let i = 1; i <= NR; i++) {
      const r = RMAX * Math.pow(i / NR, 1.7);
      for (let j = 0; j < NS; j++) {
        const a = ((j + 0.5 * (i & 1)) / NS) * Math.PI * 2;
        vert(1 + (i - 1) * NS + j, Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    for (let j = 0; j < NS; j++) idx.push(0, 1 + (j + 1) % NS, 1 + j);
    for (let i = 1; i < NR; i++) {
      const a0 = 1 + (i - 1) * NS, b0 = 1 + i * NS;
      for (let j = 0; j < NS; j++) {
        const j1 = (j + 1) % NS;
        idx.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x382c24, roughness: 0.97, metalness: 0, vertexColors: true, transparent: true, envMapIntensity: 0.6 });
  // Einblenden: Textur mischt sich über uTex aus der Grundfarbe (uFlat) ein, das Relief der Normal-Map wächst mit
  const fadeU = { uTex: { value: 0 }, uFlat: { value: groundMat.color.clone() } };
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, fadeU);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTex; uniform vec3 uFlat;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        diffuseColor *= mix(vec4(uFlat, 1.0), texture2D(map, vMapUv), uTex);
      #endif`);
  };
  const top = new THREE.Mesh(geo, groundMat);
  top.position.y = floorY - 0.012;
  top.renderOrder = -1;
  top.receiveShadow = true;
  group.add(top);

  // Platz-Verwaltung: nichts unter dem Stück, nichts ineinander
  const occ = [];
  const freeAt = (x, z, r) => {
    if (Math.abs(x) < W / 2 + r + 0.08 && Math.abs(z) < D / 2 + r + 0.08) return false;
    for (const [ox, oz, orr] of occ) if (Math.hypot(x - ox, z - oz) < r + orr) return false;
    return true;
  };
  // Ort im Ring rmin … rmax, nahe am Stück dichter
  const ringPos = (rmin, rmax) => { const a = rand() * 6.28, r = lerp(rmin, rmax, Math.pow(rand(), 1.5)); return [Math.cos(a) * r * 1.15, Math.sin(a) * r]; };
  const blobs = [], leafBlobs = [];   // Kontaktschatten; die der Blätter blenden mit ihnen ein
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), s3 = new THREE.Vector3(), e3 = new THREE.Euler(), nv = new THREE.Vector3();

  // Ästchen (Buche, mit Flechten): verjüngte Röhren, teils mit Seitenzweig; liegen auf der mittleren Höhe ihres Wegs
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.92, envMapIntensity: 0.5 });
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 0.95, envMapIntensity: 0.5 });
  for (let placed = 0, tries = 0; placed < 14 && tries < 600; tries++) {
    const len = 2.5 + rand() * 6.5, r0 = 0.05 + Math.pow(rand(), 1.5) * 0.16;
    const [x, z] = ringPos(2.6, 24);
    const tw = twigGeometry(rand, len, r0, { bend: 0.6, knot: rand() < 0.5 ? 0.3 + rand() * 0.4 : 0 });
    const mesh = new THREE.Mesh(tw.geo, [barkMat, cutMat]);
    mesh.rotation.y = rand() * 6.28;
    mesh.position.set(x, floorY + r0 * 0.92, z);
    mesh.updateMatrix();
    const samp = [];
    let ok = true, hy = 0;
    for (let i = 0; i <= 12 && ok; i++) {
      const w = tw.curve.getPointAt(i / 12).applyMatrix4(mesh.matrix);
      if (!freeAt(w.x, w.z, tw.rad(i / 12) + 0.06)) ok = false;
      samp.push([w.x, w.z, tw.rad(i / 12) + 0.06]);
      hy += heightAt(w.x, w.z) / 13;
    }
    if (!ok) { tw.geo.dispose(); continue; }
    mesh.position.y += hy;
    occ.push(...samp);
    for (const [sx, sz, sr] of samp) blobs.push([sx, sz, sr * 4.5]);
    mesh.castShadow = mesh.receiveShadow = true;
    if (rand() < 0.55) {                                   // Seitenzweig, kurz
      const t = 0.3 + rand() * 0.4, p0 = tw.curve.getPointAt(t), tan = tw.curve.getTangentAt(t), bl = len * (0.15 + rand() * 0.25);
      const b = twigGeometry(rand, bl, tw.rad(t) * 0.55, { bend: 0.5 });
      const br = new THREE.Mesh(b.geo, [barkMat, cutMat]);
      const yaw = Math.atan2(-tan.z, tan.x) + (rand() < 0.5 ? 1 : -1) * (0.45 + rand() * 0.4);
      br.rotation.y = yaw;
      br.position.copy(p0).add(new THREE.Vector3(Math.cos(yaw) * bl / 2, -tw.rad(t) * 0.3, -Math.sin(yaw) * bl / 2));
      br.castShadow = br.receiveShadow = true;
      mesh.add(br);
    }
    group.add(mesh);
    placed++;
  }

  // Buchenblätter (ganz, mit Fraßlöchern) und Laubschnipsel; liegen schräg wie der Boden darunter
  const leafGeos = [leafGeometry(0.18, 0.12, 0.03, 1), leafGeometry(0.32, 0.05, 0.05, 2), leafGeometry(0.08, 0.22, 0.02, 3)];
  const leafSets = [];
  for (const [kind, total] of [['plain', 12], ['holes', 10], ['frag', 80]]) {
    const mat = new THREE.MeshStandardMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.93, envMapIntensity: 0.4 });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
    leafSets.push({ kind, mat, depth });
    leafGeos.forEach((lg, gi) => {
      const per = Math.ceil(total / leafGeos.length);
      const mesh = new THREE.InstancedMesh(lg, mat, per);
      let n = 0;
      for (let tries = 0; n < per && tries < 400; tries++) {
        const frag = kind === 'frag', len = frag ? 0.8 + rand() * 1.6 : 5 + rand() * 3;
        const [x, z] = frag ? ringPos(2.4, 26) : ringPos(3.2, 30);
        const rot = rand() * 6.28, c = Math.cos(rot), s = Math.sin(rot);
        let ok = true;
        const samp = [];
        for (let a = -0.4; a <= 0.4 && ok; a += 0.2) for (let b = -0.2; b <= 0.2 && ok; b += 0.2) {
          const px = x + (a * c + b * s) * len, pz = z + (-a * s + b * c) * len;
          if (!freeAt(px, pz, 0.12)) ok = false;
          if (!frag) samp.push([px, pz, 0.12 * len]);
        }
        if (!ok) continue;
        occ.push(...samp);
        q.setFromUnitVectors(up, normalAt(x, z, nv)).multiply(qy.setFromEuler(e3.set(0, rot, (rand() - 0.5) * 0.06)));
        mesh.setMatrixAt(n, m4.compose(s3.set(x, floorY + heightAt(x, z) - 0.006 + n * 0.004 + gi * 0.002, z), q, new THREE.Vector3(len, len, len)));
        mesh.setColorAt(n, new THREE.Color().setScalar(0.75 + rand() * 0.45));
        leafBlobs.push([x, z, len * 0.7]);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.customDepthMaterial = depth;
      mesh.visible = false;                                // erst mit Textur (Umriss steckt im Alpha)
      group.add(mesh);
    });
  }

  // Humus-Krümel, Terra-preta-Krümel, Kohlesplitter (dunkel und matt wie die Krümel des Stücks)
  const lumps = (count, lg, mat, colorOf, sizeOf, where, yk = 0.42) => {
    const mesh = new THREE.InstancedMesh(lg, mat, count);
    let n = 0;
    for (let tries = 0; n < count && tries < count * 20; tries++) {
      const s = sizeOf(), [x, z] = where();
      if (!freeAt(x, z, s * 0.9)) continue;
      e3.set(rand() * 3, rand() * 3, rand() * 3);
      mesh.setMatrixAt(n, m4.compose(s3.set(x, floorY + heightAt(x, z) + s * yk - 0.01, z), q.setFromEuler(e3), new THREE.Vector3(s, s, s)));
      mesh.setColorAt(n, colorOf());
      blobs.push([x, z, s * 2.6]);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  const tint = (h, k) => () => {
    const f = 1 + (rand() - 0.5) * k;
    return new THREE.Color(h).multiplyScalar(f);
  };
  const soilMat = new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.6 });
  const charMat = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 1, metalness: 0.03 });
  lumps(200, crumbGeometry(5, 2, 0.7), soilMat, tint(0x22180f, 0.45), () => 0.025 + Math.pow(rand(), 2.6) * 0.18, () => ringPos(2.4, 22));
  lumps(480, crumbGeometry(6, 2, 0.8), soilMat, tint(0x2a1f17, 0.5), () => 0.025 + Math.pow(rand(), 2.6) * 0.24, () => ringPos(2.3, 24));
  lumps(120, crumbGeometry(7, 0, 0.5), charMat, () => new THREE.Color(1, 1, 1), () => 0.03 + Math.pow(rand(), 2) * 0.16, () => ringPos(2.3, 18));
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x6f604d, roughness: 0.75 });
  for (let i = 0; i < 12; i++) {                           // Feinwurzeln, halb im Boden
    const [x, z] = ringPos(2.4, 16), len = 2 + rand() * 3;
    const { geo: rg } = twigGeometry(rand, len, 0.012 + rand() * 0.01, { bend: 1.4 });
    const mesh = new THREE.Mesh(rg, rootMat);
    mesh.position.set(x, floorY + heightAt(x, z) - 0.008, z);
    mesh.rotation.y = rand() * 6.28;
    mesh.castShadow = true;
    group.add(mesh);
  }

  // Kontaktschatten (weich) unter allem, was am Boden liegt – auch ohne echte Schatten (Stufe „Leicht“)
  const blobMesh = (list) => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }), list.length);
    list.forEach(([x, z, sc], k) => mesh.setMatrixAt(k, m4.compose(s3.set(x, floorY + heightAt(x, z) - 0.008, z), q.setFromUnitVectors(up, normalAt(x, z, nv)), new THREE.Vector3(sc, 1, sc))));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  };
  blobMesh(blobs);
  const leafShadow = blobMesh(leafBlobs).material;
  leafShadow.opacity = 0;

  // Texturen aus dem Worker einsetzen
  const t2 = (bmp, srgb, rep) => {
    const t = new THREE.Texture(bmp);
    t.flipY = false;                                       // ImageBitmap ist schon gespiegelt
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  let fade = -1;                                           // −1 wartet auf Texturen · 0 … 1 blendet ein · 1 fertig
  const setFade = (k) => {
    fadeU.uTex.value = k;
    groundMat.normalScale.setScalar(k);
    leafShadow.opacity = 0.55 * k;
    for (const { mat } of leafSets) {
      mat.opacity = k;
      mat.alphaTest = Math.max(0.01, 0.5 * k);             // Umriss bleibt beim Einblenden scharf
      if (mat.transparent !== k < 1) { mat.transparent = k < 1; mat.needsUpdate = true; }   // OPAQUE-Variante neu
    }
  };
  tex.ready.then((maps) => {
    if (!maps) return;
    Object.assign(groundMat, { map: t2(maps.soil.col, true, true), normalMap: t2(maps.soil.nor, false, true), needsUpdate: true });
    groundMat.color.set(0xffffff);
    Object.assign(barkMat, { map: t2(maps.bark.col, true, true), normalMap: t2(maps.bark.nor, false, true), needsUpdate: true });
    barkMat.color.set(0xffffff);
    for (const { kind, mat, depth } of leafSets) {
      const col = t2(maps.leaf[kind].col, true);
      Object.assign(mat, { map: col, normalMap: t2(maps.leaf[kind].nor, false), needsUpdate: true });
      Object.assign(depth, { map: col, needsUpdate: true });
    }
    group.traverse((o) => { if (o.isInstancedMesh && o.customDepthMaterial) o.visible = true; });
    fade = reduced ? 1 : 0;
    setFade(fade);
  }, (err) => console.warn('[boden] Texturen fehlen:', err));

  return {
    seed,
    heightAt,
    normalAt,
    // echte Schatten vom Hauptlicht nur bei quality.shadows, sonst tragen die Kontaktschatten allein
    shadows(key, piece, on) {
      key.castShadow = on;
      piece.castShadow = on;
      if (!on) return;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 34 });
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
    },
    update(dt) {
      if (fade < 0 || fade >= 1) return;
      fade = Math.min(1, fade + dt / FADE);
      setFade(fade * fade * (3 - 2 * fade));
    },
    dispose() { tex.cancel(); },
  };
}

// ---------- Geometrien ----------
// verjüngte Röhre entlang einer Kurve, Enden geschlossen (Gruppe 1 = Schnittfläche)
function twigGeometry(rand, len, r0, opt = {}) {
  const pts = [], n = 6;
  let ang = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    ang += (rand() - 0.5) * (opt.bend ?? 0.5);
    z += Math.sin(ang) * len / n;
    pts.push(new THREE.Vector3((i / n) * len - len / 2, Math.max(0, (rand() - 0.35)) * r0 * 1.2, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = Math.max(16, Math.round(len * 10)), radial = 9, L = curve.getLength();
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], uv = [], idx = [];
  const sd = rand() * 100;
  const rad = (t) => r0 * (1 - 0.3 * t) * (0.94 + 0.12 * pnoise(t * 6 + sd, 0.5, 64, 3)) * (opt.knot ? 1 + 0.22 * Math.exp(-Math.pow((t - opt.knot) / 0.025, 2)) : 1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), Nn = frames.normals[i], B = frames.binormals[i], r = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, k = r * (0.96 + 0.08 * pnoise(a * 0.95 + sd, t * L * 3, 6, 4));
      pos.push(p.x + k * (Math.cos(a) * Nn.x + Math.sin(a) * B.x), p.y + k * (Math.cos(a) * Nn.y + Math.sin(a) * B.y), p.z + k * (Math.cos(a) * Nn.z + Math.sin(a) * B.z));
      uv.push((t * L) / 2.4, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const sideCount = idx.length;
  for (const end of [0, segs]) {                          // Kappen
    const p = curve.getPointAt(end / segs), c = pos.length / 3;
    pos.push(p.x, p.y, p.z); uv.push(0.5, 0.5);
    for (let j = 0; j <= radial; j++) {
      const o = (end * (radial + 1) + j) * 3;
      pos.push(pos[o], pos[o + 1], pos[o + 2]); uv.push(0.5 + 0.5 * Math.cos(j / radial * 6.28), 0.5 + 0.5 * Math.sin(j / radial * 6.28));
    }
    for (let j = 0; j < radial; j++) end ? idx.push(c, c + 1 + j, c + 2 + j) : idx.push(c, c + 2 + j, c + 1 + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(0, sideCount, 0); g.addGroup(sideCount, idx.length - sideCount, 1);
  g.computeVertexNormals();
  return { geo: g, curve, rad };
}
// Blatt: Länge 1 entlang x, Breite 0,62 entlang z, gewölbt (Ränder hoch), Spitze leicht gehoben
function leafGeometry(curlW, curlL, crinkle, seed) {
  const g = new THREE.PlaneGeometry(1.09, 1.09, 40, 26).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, curlW * (z * z) * 1.6 + curlL * Math.pow(Math.max(0, x + 0.1), 2) + crinkle * Math.sin(x * 26 + seed) * Math.abs(z) * 0.5
      + 0.035 * (pnoise(x * 7 + seed * 3, z * 7, 64, seed) - 0.5) + 0.06 * Math.abs(z) * (pnoise(x * 4, seed, 64, seed + 1) - 0.5));
  }
  g.computeVertexNormals();
  return g;
}
