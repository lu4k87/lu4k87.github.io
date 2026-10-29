// Echte Töne je Station (Knopf „Ton“ in der Kopfzeile): Mikrofon-Aufnahmen vom Mars und vom Mond-Funk, sonst Messdaten
// von Raumsonden – Plasma- und Radiowellen, die Antennen auffangen, und Schwingungen der Sonne –, hörbar gemacht.
// Dateien aus tools/fetch_sounds.py (web/audio/<file>.mp3: Schleife ab PAD mit der Länge len), Quellen in SOURCES (snd-*).
// Einmal eingeschaltet bleibt der Ton beim Weiterfliegen an: Stationswechsel blendet über, Stationen ohne Ton werden still.
// Pulsar hat seinen eigenen Ton (echter Takt, levels/pulsar.js) und steht deshalb nicht in der Tabelle.

import { SOURCES } from './content.js';

const PAD = 0.25, FADE = 1.5, GAIN = 0.55;
// je Station: id, Name im Schalter, Datei, Länge der Schleife [s] (Ausgabe von fetch_sounds.py), Quelle, Text; once = einmal
export const SOUNDS = {
  sun: [
    { id: 'osc', name: 'Schwingungen', file: 'sun-osc', len: 58.5, s: 'snd-sun',
      x: '<b>SOHO · MDI</b> – Schallwellen im Inneren der Sonne, gemessen als Auf und Ab der Oberfläche: 40 Tage Daten, 42.000-fach beschleunigt. Der Grundton ist das Fünf-Minuten-Pulsieren der Sonne.' },
    { id: 'type3', name: 'Radioblitze', file: 'sun-type3', len: 13.666, s: 'snd-type3',
      x: '<b>Cassini · 28.10.2003</b> – Radioblitz einer der stärksten Eruptionen seit Beginn der Messungen, aufgefangen in 8,67 AE Abstand: Schnelle Elektronen rasen nach außen, der Ton fällt mit der Dichte des Plasmas.' },
  ],
  solar: [
    { id: 'helio', name: 'Rand der Heliosphäre', file: 'solar-helio', len: 70.6, s: 'snd-helio',
      x: '<b>Voyager 1</b> – Radiowellen um 2–3 kHz vom Rand des Sonnensystems: Sie entstehen, wenn Stoßwellen der Sonne auf die Heliopause treffen. 22 Jahre Messung, gerafft.' },
  ],
  earth: [
    { id: 'chorus', name: 'Chorus', file: 'earth-chorus', len: 28.384, s: 'snd-chorus',
      x: '<b>Van Allen Probes</b> – Plasmawellen im Strahlungsgürtel: Elektronen regen das Magnetfeld zu steigenden Tönen an. Sie liegen schon im Hörbereich und klingen wie Vogelgezwitscher in der Morgendämmerung.' },
    { id: 'whistler', name: 'Whistler', file: 'earth-whistler', len: 16.302, s: 'snd-whistler',
      x: '<b>Injun 3</b> – Pfeiftöne von Blitzen: Ihre Radiowellen laufen entlang der Feldlinien zur anderen Halbkugel, hohe Töne schneller als tiefe – so wird aus dem Knacken ein fallendes Pfeifen.' },
  ],
  moon: [
    { id: 'apollo11', name: 'Apollo 11', file: 'moon-apollo11', len: 5.331, once: true, s: 'snd-apollo11',
      x: '<b>20. Juli 1969</b> – Funkspruch nach der Landung: „Houston, Tranquility Base here. The Eagle has landed.“ Spielt einmal; der Mond selbst ist still, ohne Luft trägt nichts den Schall.' },
  ],
  jupiter: [
    { id: 'bowshock', name: 'Bugstoßwelle', file: 'jupiter-bowshock', len: 14.984, s: 'snd-juno-bs',
      x: '<b>Juno · 24.06.2016</b> – Eintritt in Jupiters Magnetfeld: An der Bugstoßwelle bremst der Sonnenwind von Überschall ab, ähnlich einem Überschallknall. Rund zwei Stunden Messung, gerafft.' },
    { id: 'lightning', name: 'Blitze', file: 'jupiter-lightning', len: 6.517, s: 'snd-vgr-jupiter',
      x: '<b>Voyager · 1979</b> – Pfeiftöne von Blitzen in Jupiters Wolken, wie die Whistler der Erde: der erste Beleg für Gewitter auf einem anderen Planeten.' },
  ],
  europa: [
    { id: 'juno', name: 'Vorbeiflug', file: 'europa-juno', len: 10.33, s: 'snd-juno-europa',
      x: '<b>Juno · 29.09.2022</b> – Plasmawellen beim Vorbeiflug in 350 km Höhe, ins Hörbare verschoben: Die Tonhöhe folgt der Dichte des Plasmas um Europa.' },
  ],
  ganymede: [
    { id: 'juno', name: 'Vorbeiflug', file: 'ganymede-juno', len: 47.538, s: 'snd-juno-ganymede',
      x: '<b>Juno · 07.06.2021</b> – Radio- und Plasmawellen in Ganymeds eigenem Magnetfeld, ins Hörbare verschoben. Der Sprung zu höheren Tönen etwa in der Mitte: Juno wechselt in eine andere Region der Magnetosphäre.' },
  ],
  saturn: [
    { id: 'skr', name: 'Radiowellen', file: 'saturn-skr', len: 58.5, s: 'snd-skr',
      x: '<b>Cassini · 2003</b> – Saturns Kilometerstrahlung, noch im Anflug aufgezeichnet: Radiowellen aus den Polarlichtzonen, ins Hörbare verschoben, mit steigenden und fallenden Tönen wie bei der Erde.' },
    { id: 'lightning', name: 'Blitze', file: 'saturn-lightning', len: 26.289, s: 'snd-sed',
      x: '<b>Cassini · 23.01.2006</b> – Knacken von Blitzen tief in Saturns Atmosphäre, wie Störgeräusche im Mittelwellen-Radio bei Gewitter. Zwei Stunden Messung, gerafft.' },
  ],
  mars: [
    { id: 'wind', name: 'Wind', file: 'mars-wind', len: 38.459, s: 'snd-mars-wind',
      x: '<b>Perseverance · Sol 4</b> – echter Schall: das Mikrofon von SuperCam im Krater Jezero, Februar 2021. Die dünne Luft dämpft, Windböen sind vor allem nach etwa 20 Sekunden zu hören.' },
    { id: 'devil', name: 'Staubteufel', file: 'mars-dustdevil', len: 13.7, s: 'snd-mars-devil',
      x: '<b>Perseverance · Sol 215</b> – echter Schall: Ein Staubteufel zieht direkt über den Rover, Böen und prasselnde Körner. Die erste Aufnahme dieser Art auf dem Mars (Ausschnitt).' },
  ],
  uranus: [
    { id: 'dust', name: 'Staub', file: 'uranus-dust', len: 42.987, s: 'snd-vgr-uranus',
      x: '<b>Voyager 2 · 24.01.1986, 17:15 UT</b> – 44 Minuten vor der größten Annäherung: Die Antenne zeichnet ein Prasseln auf, gedeutet als Staubkörner, die auf die Sonde prallen und verdampfen. Messrate unverändert.' },
    { id: 'waves', name: 'Plasmawellen', file: 'uranus-waves', len: 42.987, s: 'snd-vgr-uranus',
      x: '<b>Voyager 2 · 24.01.1986, 18:01 UT</b> – zwei Minuten nach der größten Annäherung: Plasmawellen in Uranus’ Magnetfeld, so abgespielt, wie die Antenne sie gemessen hat.' },
  ],
  neptune: [
    { id: 'dust', name: 'Staub', file: 'neptune-dust', len: 42.987, s: 'snd-vgr-neptune',
      x: '<b>Voyager 2 · 25.08.1989, 02:55 UT</b> – eine Stunde vor der größten Annäherung: dichtes Prasseln, gedeutet als Staubkörner, die auf die Sonde prallen. Messrate unverändert.' },
    { id: 'waves', name: 'Plasmawellen', file: 'neptune-waves', len: 40.479, s: 'snd-vgr-neptune',
      x: '<b>Voyager 2 · 25.08.1989, 04:15 UT</b> – kurz nach der größten Annäherung: Plasmawellen in Neptuns Magnetfeld, so abgespielt, wie die Antenne sie gemessen hat.' },
  ],
};

let ac = null, out = null, cur = null, on = false, curCtl = null;
const pick = {};               // gewählter Ton je Station (diese Sitzung)
const buffers = new Map();     // Datei → Promise<AudioBuffer>

function ctx() {
  if (!ac) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;   // vor dem ersten Klick sperrt der Browser
    ac = new (window.AudioContext || window.webkitAudioContext)();
    out = ac.createGain();
    out.gain.value = GAIN;
    out.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function load(file) {
  if (!buffers.has(file)) {
    const job = fetch(`audio/${file}.mp3`).then((r) => { if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => ac.decodeAudioData(b, res, rej)));
    job.catch(() => buffers.delete(file));
    buffers.set(file, job);
  }
  return buffers.get(file);
}

function stop(fade = FADE) {
  if (!cur) return;
  if (!cur.src) { cur = null; return; }   // lädt noch: play() bricht danach selbst ab
  const { src, g } = cur, t = ac.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + fade);
  src.stop(t + fade + 0.05);
  cur = null;
}

// Schalter ohne Klick gesetzt (?ctl): Ton startet mit der ersten Bedienung (pointerup gilt auch auf Touch als Aktivierung)
let waiting = null;
function later(snd) {
  if (!waiting) {
    const go = () => {
      removeEventListener('pointerup', go, true);
      removeEventListener('keydown', go, true);
      const s = waiting;
      waiting = null;
      if (on) play(s);
    };
    addEventListener('pointerup', go, true);
    addEventListener('keydown', go, true);
  }
  waiting = snd;
}

async function play(snd) {
  if (cur && cur.snd === snd) return;
  if (!ctx()) { later(snd); return; }
  stop();
  const token = {};
  cur = { snd, token, src: null, g: null };
  let buf;
  try { buf = await load(snd.file); } catch (err) { console.warn('[kosmos] Ton:', err); return; }
  if (!cur || cur.token !== token) return;   // inzwischen umgeschaltet
  const src = ac.createBufferSource(), g = ac.createGain(), t = ac.currentTime;
  src.buffer = buf;
  if (!snd.once) {
    src.loop = true;
    src.loopStart = PAD;
    src.loopEnd = Math.min(PAD + snd.len, buf.duration);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + FADE);
  src.connect(g).connect(out);
  src.start(t, snd.once ? 0 : PAD);
  Object.assign(cur, { src, g });
  if (snd.once) src.onended = () => {
    if (!cur || cur.src !== src) return;
    cur = null; on = false;   // einmaliger Ton zu Ende: Schalter wieder „Aus“ (quick.js)
    if (curCtl) curCtl.value = 'off';
    window.dispatchEvent(new CustomEvent('kosmos:sound'));
  };
}

const detail = (list) => (v) => {
  const snd = list.find((x) => x.id === v);
  if (!snd) return `<p class="sw-cap">Echte ${list.length > 1 ? 'Aufnahmen' : 'Aufnahme'} aus dem All – einmal eingeschaltet, bleibt der Ton beim Weiterfliegen an.</p>`;
  const src = SOURCES[snd.s];
  return `<p class="sw-cap">${snd.x}</p><p class="sw-cap">Quelle: <a href="${src.url}" target="_blank" rel="noopener">${src.by}</a></p>`;
};

// Schalter „Ton“ an die Schalter der Station hängen (makeLevel) – ohne Eingriff in levels/<id>.js
export function attachSound(lv) {
  const list = SOUNDS[lv.id];
  if (!list || (lv.controls || []).some((c) => c.id === 'sound')) return;
  const c = {
    id: 'sound', label: 'Ton', value: 'off', options: [['off', 'Aus'], ...list.map((x) => [x.id, x.name])], detail: detail(list),
    set: (v) => {
      on = v !== 'off';
      if (!on) { stop(0.4); return; }
      pick[lv.id] = v;
      curCtl = c;
      play(list.find((x) => x.id === v));
    },
  };
  lv.controls = [...(lv.controls || []), c];
}

// Station wird aktiv (activate): Ton an → Ton dieser Station überblenden, Station ohne Ton → still
export function soundTo(lv) {
  const list = SOUNDS[lv.id], c = (lv.controls || []).find((x) => x.id === 'sound' && x.detail);
  if (c) c.value = on ? (pick[lv.id] || list[0].id) : 'off';
  if (!on) return;
  if (!c) { stop(); return; }
  pick[lv.id] = c.value;
  curCtl = c;
  play(list.find((x) => x.id === c.value));
}
