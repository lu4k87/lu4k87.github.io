// Station 01E: James-Webb-Weltraumteleskop am Lagrange-Punkt L2 (Einheit 1 m), Abstecher von Erde & Mond. Szene am
// Sonne-Erde-System (l2view.js): Sonne bei +x, die warme Seite des Sonnenschilds zeigt zu ihr; Erde und Mond stehen
// einige Grad daneben am Himmel (Ort auf der Halo-Bahn aus den JPL-Bahndaten).
// Modell nach NASA-Maßen (Fact Sheet) und Fotos: Hauptspiegel 6,5 m aus 18 sechseckigen Beryllium-Segmenten mit Gold
// (Krümmung als Paraboloid, Brennweite des Hauptspiegels geschätzt), Rückwand aus Kohlefaser, Hexapod-Stellglieder je
// Segment, Sekundärspiegel auf drei Streben, Instrumentenmodul (ISIM) mit Radiatoren hinter dem Spiegel, ausfahrbarer Turm;
// Sonnenschild 21,2 × 14,2 m aus fünf Lagen Kapton E, Lagen zum Rand hin aufgefächert (Wärme entweicht seitlich), Sonnenseite
// rosa-silbern (dotiertes Silizium), Mittelausleger, Paletten vorn und hinten, Trimmklappe; Raumfahrzeug auf der warmen
// Seite mit Solarflügel, Antenne (folgt der Erde) und Sternsensoren. Details nach Fotos: Ränder der Lagen hängen zwischen
// den Aufhängepunkten als Kettenlinie durch, Membran mit Ripstop-Gitter (stationkit.js `membrane`), drei Goldtöne und
// Mikro-Verkippung je Segment (Reflexe wie auf Fotos), Flügel-Scharniere hinter der Rückwand, Knie-Gelenke der oberen
// Streben, Kegel der hinteren Optik, zweiteiliger Turm, Elektronik (IEC) mit Lamellen, Paletten-Fachwerk auf der warmen
// Seite, Kabelbäume, Mittelgewinn- und Stabantennen. Ausrichtung: Sonnenschild zur Sonne, Blick quer dazu;
// Schalter „Wechselnde Ziele“ dreht das Teleskop langsam um die Sonnenlinie (Modell, kein Beobachtungsplan).

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createL2View, earthLook } from '../l2view.js';
import { stationMat } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const SEG = { flat: 1.32, gap: 0.007 };          // Segment Kante zu Kante [m] (Modell nach NASA-Grafiken), Fuge
const PM = { x: -5.4, z: -1.6, f: 7.94 };         // Mitte des Hauptspiegels (über dem Schild), Brennweite (geschätzt)
const SM_DIST = 7.2;                              // Hauptspiegel → Sekundärspiegel [m] (nach Fotos)
// Sonnenschild: Umriss in (z, y) – lange Achse 21,2 m in Blickrichtung, 14,2 m quer (NASA Fact Sheet)
const SHIELD = [[10.6, 1.4], [2.2, 7.08], [-2.2, 7.08], [-10.6, 1.4], [-10.6, -1.4], [-2.2, -7.08], [2.2, -7.08], [10.6, -1.4]];
const LAYER_GAP = [0.08, 0.26];                   // Abstand der Lagen in der Mitte und am Rand [m] (Modell)
const EYE = new THREE.Vector3(9, -3, 6);          // Blick „Zur Erde“: neben dem Raumfahrzeug auf der warmen Seite
const SAG = 0.045;                                // Durchhang der Ränder zwischen den Aufhängepunkten (Anteil der Kantenlänge, nach Fotos)

// Umriss gleichmäßig abtasten (n Punkte); jede Kante hängt zwischen ihren Aufhängepunkten als Kettenlinie nach innen durch
function resample(poly, n, sag = SAG) {
  const P = poly.map(([z, y]) => new THREE.Vector2(z, y)), L = [], out = [], nrm = new THREE.Vector2();
  let tot = 0;
  for (let i = 0; i < P.length; i++) { const d = P[i].distanceTo(P[(i + 1) % P.length]); L.push(d); tot += d; }
  for (let k = 0; k < n; k++) {
    let s = (k / n) * tot, i = 0;
    while (s > L[i]) { s -= L[i]; i++; }
    const a = P[i], b = P[(i + 1) % P.length], f = s / L[i], q = a.clone().lerp(b, f);
    nrm.set(a.y - b.y, b.x - a.x).normalize();
    if (nrm.dot(q) > 0) nrm.negate();                 // Normale der Kante nach innen (Umriss um den Ursprung)
    out.push(q.addScaledVector(nrm, sag * L[i] * Math.sin(Math.PI * f)));
  }
  return out;
}

// Lage des Sonnenschilds: Fächer aus Ringen um die Mitte, Höhe x nach Abstand zur Mitte (Lagen fächern zum Rand auf)
function shieldLayer(i, spread) {
  const B = resample(SHIELD, 96), M = 10, pos = [], uv = [], idx = [];
  for (let r = 0; r <= M; r++) {
    const t = r / M, gap = THREE.MathUtils.lerp(LAYER_GAP[0], LAYER_GAP[1], t * t) * spread;
    // leichte Wölbung je Lage (Spannung der Folie), Rand der äußeren Lagen etwas zurückgesetzt
    const inset = 1 - 0.012 * i * t;
    for (const b of B) {
      const z = b.x * t * inset, y = b.y * t * inset;
      pos.push(-i * gap + 0.04 * Math.sin(t * Math.PI) * (i % 2 ? 1 : -1), y, z);
      uv.push(z / 2.4, y / 2.4);
    }
  }
  const n = B.length;
  for (let r = 0; r < M; r++) for (let k = 0; k < n; k++) {
    const a = r * n + k, b = r * n + (k + 1) % n, c = (r + 1) * n + k, d = (r + 1) * n + (k + 1) % n;
    if (r > 0) idx.push(a, c, b);
    idx.push(b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Sechseck mit Spitzen links und rechts (flache Seiten oben und unten), Kante zu Kante `flat`, Dicke `depth`
function hexGeo(flat, depth, bevel = 0.012) {
  const a = flat / Math.sqrt(3), s = new THREE.Shape();
  for (let k = 0; k < 6; k++) { const x = a * Math.cos(k * Math.PI / 3), y = a * Math.sin(k * Math.PI / 3); if (k) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -depth);
  return g;
}

export function create(ctx) {
  const ov = createL2View(ctx, { craft: 'jwst', halo: { ay: 832, az: 520, days: 180, phase: 0.18 }, radius: 14 });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const obs = new THREE.Group();           // ganzes Observatorium, warme Seite zur Sonne
  scene.add(obs);
  const body = new THREE.Group();          // dreht um die Sonnenlinie (Ziele)
  obs.add(body);
  const I = K.inst(body), late = [];

  // Gold in drei Tönen je Segment-Art (A innen, B Ecken, C Kanten), Segmente minimal verkippt → Reflexe wie auf Fotos
  const golds = [[0xf6c35c, 0.12], [0xffd072, 0.1], [0xeab54e, 0.14]].map(([c, r]) => stationMat({ color: c, metalness: 1, roughness: r, envMapIntensity: 1.7 }));
  const M = {
    gold: golds[0],
    back: stationMat({ color: 0x1d1f24, metalness: 0.35, roughness: 0.6 }),
    composite: stationMat({ color: 0x26282d, metalness: 0.2, roughness: 0.7 }),
    strut: stationMat({ color: 0x3c3f45, metalness: 0.5, roughness: 0.45 }),
  };
  const pink = mat('shieldSun'), silver = mat('shieldBack');
  const add = (parent, geo, m, pos, rot) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  // ---------- Sonnenschild: fünf Lagen, aufgefächert; Lage 1 (Sonnenseite) rosa-silbern ----------
  const shield = new THREE.Group();
  body.add(shield);
  const layers = [];
  const buildShield = (spread) => {
    layers.forEach((m) => { shield.remove(m); m.geometry.dispose(); });
    layers.length = 0;
    for (let i = 0; i < 5; i++) {
      const g = shieldLayer(i, spread);
      // Folienseiten: Lage 1 zur Sonne rosa (dotiertes Silizium), sonst Aluminium; Materialien je Seite über zwei Netze
      const m = new THREE.Mesh(g, i === 0 ? pink : silver);
      m.castShadow = m.receiveShadow = true;
      shield.add(m);
      layers.push(m);
    }
  };
  buildShield(1);
  // Mittelausleger quer, Spreizstangen an den Ecken (durch alle Lagen), Saum an den Spitzen, Paletten vorn und hinten
  for (const s of [1, -1]) {                                                       // Mittelausleger: zwei Teleskopstufen mit Hülsen
    I.rod(V(0.18, 0, 0), V(0.18, s * 3.6, 0), 0.075, mat('strut')).rod(V(0.18, s * 3.5, 0), V(0.18, s * 7.0, 0), 0.06, mat('strut'));
    for (const y of [1.2, 3.55, 5.3]) I.rod(V(0.18, s * (y - 0.09), 0), V(0.18, s * (y + 0.09), 0), 0.1, mat('dark'), K.U.disk);
  }
  for (const [z, y] of SHIELD) {                                                   // Spreizstangen an den Ecken mit Fuß und Kopf
    I.rod(V(0.12, y, z), V(-1.2, y * 0.985, z * 0.985), 0.035, mat('strut'));
    I.rod(V(0.16, y, z), V(0.26, y, z), 0.09, mat('dark'), K.U.disk).rod(V(-1.2, y * 0.985, z * 0.985), V(-1.28, y * 0.985, z * 0.985), 0.07, mat('dark'), K.U.disk);
  }
  for (const s of [1, -1]) {
    // Paletten (UPS): Fachwerk-Rückgrat vom Bus bis zu den Enden, dort der Halter der gefalteten Lagen
    K.lattice(I, V(0.55, 0, s * 2.0), V(0.55, 0, s * 9.3), { w: 2.2, h: 0.5, bay: 1.3, r: 0.04, m: mat('strut'), side: V(0, 1, 0) });
    I.box(V(0.45, 0, s * 9.9), [0.6, 2.6, 1.0], mat('gold'));
    I.box(V(0.2, 0, s * 9.1), [0.25, 1.8, 0.5], mat('box'), null, new THREE.Color(0x3a3d42));
  }
  // Trimmklappe am hinteren Ende (gleicht den Lichtdruck aus) mit Scharnier und zwei Hülsen
  const flap = new THREE.Group();
  flap.position.set(0.3, 0, -10.7);
  flap.rotation.y = 0.5;
  body.add(flap);
  add(flap, K.boxUV(new THREE.BoxGeometry(0.03, 2.2, 1.3), 1.2), mat('back'), [0, 0, -0.65]);
  I.rod(V(0.3, -1.0, -10.7), V(0.3, 1.0, -10.7), 0.05, mat('metal'));
  for (const y of [-0.6, 0.6]) I.rod(V(0.3, y - 0.1, -10.7), V(0.3, y + 0.1, -10.7), 0.08, mat('dark'), K.U.disk);

  // ---------- Raumfahrzeug (warme Seite): Bus, Solarflügel, Antenne, Sternsensoren, Triebwerke ----------
  add(body, K.boxUV(new THREE.BoxGeometry(1.4, 2.0, 3.0), 2.2), mat('gold'), [1.15, 0, -0.4]);
  K.dress(I, 'z', V(1.15, 0, -0.4), 1.0, 3.0, { rails: 0, gear: 5, seed: 41, ends: false });
  I.box(V(1.9, 0, -0.4), [0.08, 1.7, 2.6], mat('rad'));
  for (const [dy, dz] of [[0.6, 0.6], [-0.6, 0.9]]) {                            // Sternsensoren mit Streulichtblende
    I.rod(V(1.7, dy, dz), V(2.25, dy * 1.2, dz + 0.2), 0.14, mat('dark'), K.U.disk);
    I.rod(V(2.25, dy * 1.2, dz + 0.2), V(2.3, dy * 1.2, dz + 0.22), 0.16, mat('metal'), K.U.ring);
  }
  for (const [dy, dz] of [[0.9, 1.0], [-0.9, 1.0], [0.9, -1.8], [-0.9, -1.8]]) I.rod(V(1.85, dy, dz), V(2.05, dy, dz), 0.05, mat('nozzle'), K.U.disk);
  // Solarflügel: fünf Felder nach achtern, Zellen zur Sonne
  for (let k = 0; k < 5; k++) {
    const z = -2.2 - k * 1.26;
    I.box(V(2.05, 0, z), [0.04, 1.5, 1.2], K.panel('cells'));
    for (const dy of [-0.76, 0.76]) I.rod(V(2.05, dy, z - 0.6), V(2.05, dy, z + 0.6), 0.02, mat('metal'));
  }
  I.rod(V(1.6, 0, -1.9), V(2.05, 0, -2.2), 0.05, mat('metal'));
  // Antenne mit großer Schüssel auf Ausleger; zeigt zur Erde (Gelenk)
  const hga = new THREE.Group();
  hga.position.set(1.95, -0.7, 0.9);
  body.add(hga);
  const dish = add(hga, new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i * 0.075, (i * 0.075) ** 2 * 0.9)), 32), mat('paint'), [0, 0, 0]);
  dish.rotation.z = -Math.PI / 2;
  dish.material.side = THREE.DoubleSide;
  const mga = add(hga, new THREE.LatheGeometry(Array.from({ length: 7 }, (_, i) => new THREE.Vector2(i * 0.04, (i * 0.04) ** 2 * 1.6)), 24), mat('paint'), [0.05, 0.55, 0.3]);   // Mittelgewinn-Antenne
  mga.rotation.z = -Math.PI / 2;
  I.rod(V(1.85, -0.7, 0.9), V(1.7, -0.7, 0.9), 0.06, mat('metal')).rod(V(1.78, -0.7, 0.9), V(1.9, -0.7, 0.9), 0.11, mat('dark'), K.U.disk);
  K.whip(I, V(1.85, 0.98, -1.5), V(1, 0.4, 0), 0.9);                             // Stabantennen (Rundstrahler)
  K.whip(I, V(1.85, -0.98, -1.5), V(1, -0.4, 0), 0.9);

  // ---------- Turm und Teleskop (kalte Seite) ----------
  const dta0 = V(0.45, 0, -0.4), dta1 = V(-2.6, 0, -2.4), dtaM = dta0.clone().lerp(dta1, 0.5);   // ausfahrbarer Turm (DTA): zwei Stufen
  I.rod(dta0, dtaM, 0.34, mat('silver'), K.U.disk).rod(dtaM, dta1, 0.27, mat('silver'), K.U.disk);
  I.rod(dta0.clone().lerp(dta1, 0.47), dta0.clone().lerp(dta1, 0.53), 0.38, mat('dark'), K.U.ring).rod(dta0, dta0.clone().lerp(dta1, 0.06), 0.4, mat('dark'), K.U.ring);
  // Hauptspiegel: Gruppe mit u = +y (quer), v = −x (weg vom Schild), Normale +z (Blickrichtung)
  const pm = new THREE.Group();
  pm.position.set(PM.x, 0, PM.z);
  pm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(-1, 0, 0), V(0, 0, 1)));
  body.add(pm);
  const J = K.inst(pm);
  late.push(J);
  const s = SEG.flat + SEG.gap, cells = [];
  const dir = (k) => [Math.cos((30 + 60 * k) * RAD), Math.sin((30 + 60 * k) * RAD)];
  for (let k = 0; k < 6; k++) cells.push(dir(k).map((v) => v * s));
  for (let k = 0; k < 6; k++) { const a = dir(k), b = dir((k + 1) % 6); cells.push([2 * s * a[0], 2 * s * a[1]], [s * (a[0] + b[0]), s * (a[1] + b[1])]); }
  const segGeo = hexGeo(SEG.flat, 0.05), backGeo = hexGeo(SEG.flat * 1.02, 0.34, 0);
  const qn = new THREE.Quaternion(), qt = new THREE.Quaternion(), zAx = V(0, 0, 1), rs = mulberry32(7);
  const segments = [];
  cells.forEach(([u, v], i) => {
    const w = (u * u + v * v) / (4 * PM.f), n = V(-u, -v, 2 * PM.f).normalize();
    qn.setFromUnitVectors(zAx, n);
    const seg = new THREE.Mesh(segGeo, golds[i < 6 ? 0 : 1 + (i - 6) % 2]);
    seg.position.set(u, v, w);
    // Mikro-Verkippung ≤ 0,15° (im Betrieb sind die Segmente auf Nanometer ausgerichtet – hier nur für wechselnde Reflexe)
    qt.setFromEuler(new THREE.Euler((rs() - 0.5) * 0.005, (rs() - 0.5) * 0.005, 0));
    seg.quaternion.copy(qn).multiply(qt);
    seg.castShadow = seg.receiveShadow = true;
    pm.add(seg);
    segments.push(seg);
    const bk = new THREE.Mesh(backGeo, M.composite);
    bk.position.set(u, v, w - 0.07).addScaledVector(n, -0.02);
    bk.quaternion.copy(qn);
    bk.castShadow = true;
    pm.add(bk);
    // Hexapod: sechs Stellglieder zwischen Segment und Rückwand, Krümmungsantrieb in der Mitte
    for (let k = 0; k < 6; k++) {
      const a = (k + 0.5) * Math.PI / 3, p = V(u + Math.cos(a) * 0.32, v + Math.sin(a) * 0.32, w - 0.42), q = V(u + Math.cos(a + 0.5) * 0.4, v + Math.sin(a + 0.5) * 0.4, w - 0.72);
      J.rod(p, q, 0.022, mat('metal'));
    }
    J.rod(V(u, v, w - 0.4), V(u, v, w - 0.75), 0.05, mat('dark'), K.U.disk);
  });
  // Rückwand (Kohlefaser-Fachwerk) hinter der Mitte und den Flügeln
  K.lattice(J, V(0, -3.4, -0.85), V(0, 3.4, -0.85), { w: 2.2, h: 0.6, bay: 0.85, r: 0.05, m: M.composite, side: V(1, 0, 0) });
  for (const sx of [-1, 1]) K.lattice(J, V(sx * 1.3, -2.3, -0.85), V(sx * 3.4, -2.3 + 0.0, -0.85), { w: 0.5, h: 0.5, bay: 0.7, r: 0.04, m: M.composite, side: V(0, 1, 0) });
  // Flügel-Scharniere: die äußeren drei Segmente je Seite klappen um eine senkrechte Achse hinter der Rückwand (zwei Gelenke)
  for (const sx of [-1, 1]) {
    J.rod(V(sx * 1.3 * s, -1.9 * s, -1.25), V(sx * 1.3 * s, 1.9 * s, -1.25), 0.03, mat('metal'));
    for (const v of [-1.3 * s, 1.3 * s]) J.rod(V(sx * 1.3 * s, v - 0.14, -1.25), V(sx * 1.3 * s, v + 0.14, -1.25), 0.1, mat('dark'), K.U.disk).rod(V(sx * 1.3 * s, v, -1.25), V(sx * 1.3 * s, v, -0.95), 0.05, mat('metal'));
  }
  // Mitte: Hinterer Optik-Aufbau (Tertiär- und Feinsteuerspiegel) ragt als Kegel durch die Lücke, mit Blende und Sockel
  J.rod(V(0, 0, -0.2), V(0, 0, 1.05), 0.46, M.back, K.U.cone);
  J.rod(V(0, 0, 0.85), V(0, 0, 0.95), 0.36, M.back, K.U.ring).rod(V(0, 0, -0.35), V(0, 0, -0.2), 0.5, mat('dark'), K.U.disk);
  // Sekundärspiegel (0,74 m, konvex, Gold) auf drei Streben: unten senkrecht, oben links und rechts
  // Kugelkappe (Ø 0,74 m) mit dem Scheitel zum Hauptspiegel, dahinter Halter und Stellglieder
  add(pm, new THREE.SphereGeometry(0.9, 40, 12, 0, Math.PI * 2, 0, 0.42), M.gold, [0, 0, SM_DIST + 0.9], [-Math.PI / 2, 0, 0]);
  J.rod(V(0, 0, SM_DIST + 0.1), V(0, 0, SM_DIST + 0.36), 0.44, M.back, K.U.disk);
  const smAt = V(0, 0, SM_DIST + 0.3);
  for (const [u, v] of [[0, -3.75], [3.35, 1.95], [-3.35, 1.95]]) {
    const foot = V(u, v, (u * u + v * v) / (4 * PM.f) - 0.1), top = smAt.clone().add(V(u * 0.06, v * 0.06, 0)), d = top.clone().sub(foot).normalize();
    J.rod(foot, top, 0.075, M.strut);
    J.rod(foot, foot.clone().add(V(0, 0, -0.3)), 0.13, mat('dark'), K.U.disk).rod(foot.clone().addScaledVector(d, 0.1), foot.clone().addScaledVector(d, 0.45), 0.11, mat('dark'), K.U.disk);
    // obere Streben mit Knie-Gelenk in der Mitte (klappen beim Entfalten), untere gerade
    if (v > 0) { const mid = foot.clone().lerp(top, 0.5); J.rod(mid.clone().addScaledVector(d, -0.18), mid.clone().addScaledVector(d, 0.18), 0.12, mat('dark'), K.U.disk); }
    J.rod(top.clone().addScaledVector(d, -0.3), top.clone().addScaledVector(d, 0.02), 0.1, mat('dark'), K.U.disk);
  }
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 2; J.rod(V(Math.cos(a) * 0.2, Math.sin(a) * 0.2, SM_DIST + 0.05), V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, SM_DIST + 0.36), 0.02, mat('metal')); }   // Stellglieder des Sekundärspiegels
  // ISIM hinter dem Spiegel (Instrumente in Goldfolie), Radiatoren nach achtern, Kabelbündel
  I.box(V(PM.x + 0.4, 0, PM.z - 2.0), [2.2, 2.4, 1.6], mat('gold'));
  I.box(V(PM.x + 0.4, 0, PM.z - 2.85), [2.6, 2.8, 0.08], mat('rad'));
  for (const dy of [-1.45, 1.45]) I.box(V(PM.x + 0.2, dy, PM.z - 2.0), [2.0, 0.06, 1.4], mat('rad'));
  I.box(V(PM.x - 1.4, 0, PM.z - 1.6), [0.8, 1.6, 0.9], mat('silver'));
  // Elektronik der Instrumente (IEC) unter dem ISIM mit Kühllamellen zur kalten Seite
  I.box(V(PM.x + 1.6, -1.1, PM.z - 1.3), [1.1, 0.8, 1.2], mat('gold'));
  for (let k = 0; k < 4; k++) I.box(V(PM.x + 1.6, -1.6, PM.z - 1.0 - k * 0.22), [1.0, 0.45, 0.03], mat('rad'));
  // Kabelbäume: Bus → Turm → ISIM und ISIM → Rückwand
  K.harness(I, [V(1.2, 0.55, 0.9), V(0.5, 0.5, -0.1), V(-0.9, 0.46, -1.1), V(-2.3, 0.42, -2.1), V(PM.x + 1.6, 0.3, PM.z - 1.8)], 0.05);
  K.harness(I, [V(PM.x + 1.5, -0.6, PM.z - 2.5), V(PM.x + 0.2, -1.3, PM.z - 2.4), V(PM.x - 0.9, -1.4, PM.z - 1.2)], 0.035);
  I.done();
  late.forEach((x) => x.done());

  // ---------- Ausrichtung: warme Seite zur Sonne, Blick quer; wechselnde Ziele = langsames Drehen um die Sonnenlinie ----------
  let program = true, roll = 0;
  const rp = mulberry32(5);
  let goal = 0, nextAt = ov.jd + 0.4;
  const qa = new THREE.Quaternion(), X = V(1, 0, 0);
  function steer(dt, flying) {
    obs.quaternion.setFromUnitVectors(X, ov.sun);
    // neues Ziel alle ≈ 9 h Bahnzeit, Schwenk mit höchstens 1,5°/s im Bild (Modell)
    if (program && ov.jd > nextAt) { goal = (rp() - 0.5) * 1.2; nextAt = ov.jd + 0.25 + rp() * 0.5; }
    const g = program ? goal : 0, step = (flying ? 10 : dt) * 1.5 * RAD * Math.min(20, ov.speed ? ov.SPEEDS[ov.speed][0] : 1);
    roll += THREE.MathUtils.clamp(g - roll, -step, step);
    body.quaternion.copy(qa.setFromAxisAngle(X, roll));
    // Antenne zur Erde
    obs.updateMatrixWorld(true);
    const e = ov.earthDir.clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()).invert());
    hga.quaternion.setFromUnitVectors(X, e);
  }

  // ---------- Posen, Blick „Zur Erde“ ----------
  const home = { pos: new THREE.Vector3(-17, 6, 29), target: new THREE.Vector3(-3.5, 0, 1) };
  const intro = { pos: new THREE.Vector3(-7, 3, 13), target: new THREE.Vector3(-5, 0, 2) };
  const orbit = { minDistance: 9, maxDistance: 700, cineSpeed: 0.45 };
  const look = earthLook(ctx, ov, { home, orbit, eye: EYE, fov: 3 });

  // ---------- Abzeichen ----------
  const wp = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const S = {
    mirror: wp(pm, 1.8, 2.6, 0.6), secondary: wp(pm, 0, 0.6, SM_DIST), isim: wp(body, PM.x + 0.4, 1.3, PM.z - 2.0),
    shield: wp(body, 0.1, 5.2, 4.5), layers: wp(body, -0.5, -6.4, -1.6), bus: wp(body, 1.9, 1.0, -0.4), flap: wp(flap, 0, 1.1, -0.9),
  };
  const out = () => look.mode === 'out';
  const hs = {};
  for (const [id, f] of [['mirror', 22], ['secondary', 14], ['isim', 16], ['shield', 45], ['layers', 30], ['bus', 16], ['flap', 18]]) hs[id] = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => f, visible: out };
  hs.earth = { id: 'earth', kind: 'info', pos: ov.spots.earth };
  hs.moon = { id: 'moon', kind: 'info', pos: ov.spots.moon, visible: () => look.mode === 'earth' };
  hs.sun = { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: out };
  hs.halo = { id: 'halo', kind: 'info', pos: ov.spots.l2, visible: out };
  const hotspots = Object.values(hs);
  function placeHotspots() {
    obs.updateMatrixWorld(true);
    for (const k of Object.keys(S)) hs[k].pos.copy(S[k]());
  }

  // ---------- Ebenen (Zahnrad „Station · JWST“) und Infotafel ----------
  registerLayers('jwst', [
    ov.layers.clock('JWST'),
    { id: 'spread', type: 'range', group: 'Sonnenschild', label: 'Lagen auffächern', value: 1, min: 1, max: 6, step: 0.5, fmt: (v) => (v === 1 ? 'echt' : `${String(v).replace('.', ',')}×`),
      hint: 'Zeigt die fünf Lagen weiter auseinander; „echt“ = Abstand wie im Modell, wenige Zentimeter in der Mitte, mehr zum Rand.', set: (v) => buildShield(v) },
    { id: 'program', type: 'toggle', group: 'Teleskop', label: 'Wechselnde Ziele', hint: 'Das Teleskop dreht sich um die Linie zur Sonne zu neuen Zielen – Modell, nicht der Beobachtungsplan.', value: true, set: (v) => { program = v; } },
    ov.layers.boost('der Spiegel'),
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'view', label: 'Blick', value: 'out', options: [['out', 'Außen'], ['earth', 'Zur Erde']], set: (v) => look.set(v) },
  ];

  return {
    scene, camera, home, intro, unit: 1, hotspots, controls, orbit,
    look: { exposure: 1.0, bloom: 0.08, sat: 1.05 },
    ready: Promise.all([ov.ready, K.ready()]),
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(dt, flying);
      placeHotspots();
    },
    orbitUpdate: (c, dt) => look.orbitUpdate(c, dt),
    widget: () => '<table><thead><tr><th>JWST im Moment</th><th>Wert</th></tr></thead><tbody id="w-l2"><tr><td colspan="2">Bahn wird berechnet …</td></tr></tbody></table><p class="w-foot">Ort auf der Halo-Bahn aus den JPL-Horizons-Bahndaten (Dez. 2021 – Okt. 2031, danach Modell mit den Eckwerten des STScI); Erde und Mond an ihren echten Orten zum angezeigten Zeitpunkt.</p>',
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>Halo-Umlauf${ov.info.real ? '' : ' (Modell)'}</td><td class="num">${Math.round(ov.info.phase * 100)} %</td></tr>`);
    },
    live: () => `${(ov.info.dist / 1e6).toFixed(2).replace('.', ',')} Mio. km von der Erde · ${ov.speed ? `Zeitraffer ${ov.SPEEDS[ov.speed][1]}` : 'Echtzeit'}`,
    setPixelRatio: (p) => ov.setPixelRatio(p),
    dispose() {
      ov.dispose();
      K.dispose();
      [...golds, M.back, M.composite, M.strut].forEach((m) => m.dispose());
    },
  };
}
