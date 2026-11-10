// Station 03G: NGC 3603 (Einheit 1 Lj, Haufen HD 97950 im Ursprung, Blick von der Erde = −z, Norden = +y). Medium, Sterne,
// Himmel und Kamerafahrt kommen aus ../ngc3603.js (gemeinsam mit der Test-/Vorlagenseite web/ngc3603.html, nicht kopiert).
// Ablauf: Landung aus der Milchstraße am Anfang der Fahrt (arrive), dann spielt main.js die 58-s-Fahrt ohne Schnitt ab
// (film.at je Bild, Eingabe bricht ab); sie endet in der Heimpose (home = Endpose der Fahrt) → freies Umsehen ohne Sprung.
// Direkter Aufruf (#station=ngc3603) und „Bewegung reduzieren“: gleich in der Heimpose, ohne Fahrt.
// Belichtung folgt auf der Fahrt der Blende der Vorlage (beim Durchflug durch den Haufen weiter zu), sonst dem Grundwert;
// weich nachgeführt, damit ein Abbruch mitten im hellen Kern nicht springt.

import * as THREE from 'three';
import { buildNebula, filmPose, exposureAt, beatAt, END, FILM_START, FILM_END, PILLARS, GLOBULES, SHER } from '../ngc3603.js';
import { LY } from '../astro.js';

const BASE = 1.15;   // Belichtung in der Heimpose (= Ende der Fahrt)

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  // Qualität der Wolke nach Stufe der App: niedrig grob, hoch fein (Schrittweite und Auflösung wie in der Vorlage)
  const neb = buildNebula(ctx.renderer, { quality: ctx.detail > 0.9 ? 2 : ctx.detail > 0.6 ? 1 : 0 });
  scene.add(...neb.objects);
  const vol = neb.vol;

  const look = { exposure: BASE, bloom: 0.1, sat: 1.22, con: 0.22, sh: [0.95, 0.98, 1.07], hi: [1.05, 1.0, 0.94], vig: 0.42, grain: 0.012 };
  let filmT = -1, beat = null;   // Zeit der Fahrt in diesem Bild (−1 = keine Fahrt)

  const pil = PILLARS[1];
  const hotspots = [
    { id: 'cluster', kind: 'info', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'sher25', kind: 'info', pos: SHER.clone() },
    { id: 'pillars', kind: 'info', pos: pil.a.clone().multiplyScalar(pil.tip) },
    { id: 'globules', kind: 'info', pos: GLOBULES[0].c.clone() },
    { id: 'cavity', kind: 'info', pos: new THREE.Vector3(-6, 1.5, 5) },
  ];

  return {
    scene, camera, unit: LY, hotspots, msaa: false, look,
    ready: neb.ready.then(() => ctx.renderer.compileAsync(vol.scene, camera)),
    home: { pos: FILM_END.pos.clone(), target: FILM_END.target.clone() },
    arrive: { pos: FILM_START.pos.clone(), target: FILM_START.target.clone() },
    orbit: { minDistance: 1.5, maxDistance: 90, cineSpeed: 0.6 },
    film: {
      dur: END,
      // Kamera zur Zeit t der Fahrt; gibt das Blickziel zurück (main.js übernimmt es beim Abbruch als Drehpunkt)
      at(t, cam) {
        filmT = t;
        beat = beatAt(t);
        return filmPose(t, cam);
      },
    },
    update(dt, t, cam) {
      const want = filmT >= 0 ? exposureAt(filmT) : BASE;
      look.exposure += (want - look.exposure) * (1 - Math.exp(-dt * 4));
      if (filmT < 0) beat = null;
      filmT = -1;
      vol.render(cam);
    },
    live: () => (beat ? `${beat[1]}: ${beat[2]}` : 'Sichtbares Licht nach Hubble-Vorbild: Hα rot, [O III] nah am Haufen bläulich'),
    setPixelRatio(pr, H) {
      neb.setPx(pr, H, camera.fov);
      vol.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => neb.dispose(),
  };
}
