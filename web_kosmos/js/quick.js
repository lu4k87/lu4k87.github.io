// Schnell-Knöpfe in der Kopfzeile links neben dem Zahnrad (Vorschau 26.10.2026 Knopf:A, 5 Knöpfe): Ton der Station,
// Kamerafahrt im Leerlauf, Drehachsen, Kinobalken, Vollbild – je ein Klick statt Infotafel bzw. Zahnrad.
// Ton: schaltet den Schalter „sound“ der Station (sound.js oder eigener Takt des Pulsars) zwischen „Aus“ und der ersten
// Aufnahme; Station ohne Ton → Knopf ausgegraut mit Grund im Tooltip. Die übrigen folgen kosmos.settings.v1 (auch aus dem Zahnrad).
// Kinobalken = Kino-Modus: Bedienung ausgeblendet, Vollbild (syncKino).

import { settings, setSetting, onSettings } from './settings.js';

const KEYS = { 'qk-cine': ['cine', 'Kamerafahrt im Leerlauf'], 'qk-axes': ['axes', 'Drehachsen'], 'qk-bars': ['bars', 'Kinobalken 2,39:1'] };
const NO_SOUND = 'Kein Ton: diese Station hat keine echte Aufnahme';

export function mountQuick(root, onInput) {
  const $ = (id) => root.querySelector(`#${id}`);
  const snd = $('qk-sound'), full = $('qk-full');
  let lv = null;

  const ctl = () => (lv?.controls || []).find((c) => c.id === 'sound');
  const label = (b, text) => { b.title = text; b.setAttribute('aria-label', text); };
  function syncSound() {
    const c = ctl(), on = !!c && c.value !== 'off';
    snd.setAttribute('aria-disabled', String(!c));
    snd.setAttribute('aria-pressed', String(on));
    snd.classList.toggle('is-off', !on);
    if (!c) { label(snd, NO_SOUND); return; }
    const name = c.options.find(([v]) => v === c.value)?.[1] ?? c.options[1][1];
    label(snd, on ? `Ton aus (läuft: ${name})` : `Ton an: ${c.options[1][1]}`);
  }
  snd.addEventListener('click', () => {
    const c = ctl();
    if (!c) return;
    c.value = c.value === 'off' ? c.options[1][0] : 'off';
    c.set(c.value);
    syncSound();
    onInput();
  });

  const syncKeys = () => Object.entries(KEYS).forEach(([id, [key, name]]) => {
    const b = $(id), on = !!settings.S[key];
    b.setAttribute('aria-pressed', String(on));
    label(b, `${name} ${on ? 'aus' : 'an'}`);
  });
  Object.entries(KEYS).forEach(([id, [key]]) => $(id).addEventListener('click', () => { setSetting(key, !settings.S[key]); onInput(); }));
  onSettings(syncKeys);
  syncKeys();

  // Vollbild: nur, wo der Browser es erlaubt (z. B. nicht in jedem eingebetteten Rahmen)
  full.hidden = !document.fullscreenEnabled;
  const syncFull = () => {
    const on = !!document.fullscreenElement;
    full.setAttribute('aria-pressed', String(on));
    label(full, on ? 'Vollbild beenden' : 'Vollbild');
  };
  full.addEventListener('click', () => {
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  });
  document.addEventListener('fullscreenchange', syncFull);
  syncFull();

  // Kino-Modus (User 27.10.2026): Kinobalken an → Bedienung aus (Abzeichen im All bleiben), Vollbild; nur „Kino beenden“
  // unten rechts im Balken, sichtbar kurz nach Mausbewegung. Esc oder Ende des Vollbilds schaltet die Balken wieder aus.
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'film-skip kino-exit';
  exit.innerHTML = 'Kino beenden <kbd>Esc</kbd>';
  exit.addEventListener('click', () => setSetting('bars', false));
  document.body.append(exit);
  let kino = false, ownFull = false, idle = 0;
  const wake = () => {
    if (!kino) return;
    exit.classList.add('is-on');
    clearTimeout(idle);
    idle = setTimeout(() => exit.classList.remove('is-on'), 2500);
  };
  const syncKino = () => {
    const on = !!settings.S.bars;
    if (on === kino) return;
    kino = on;
    document.body.classList.toggle('is-kino', on);
    if (on && !document.fullscreenElement && document.fullscreenEnabled) {
      document.documentElement.requestFullscreen().then(() => { ownFull = true; }, () => {});
    } else if (!on && ownFull && document.fullscreenElement) {
      ownFull = false;
      document.exitFullscreen().catch(() => {});
    }
    if (on) wake(); else exit.classList.remove('is-on');
  };
  onSettings(syncKino);
  syncKino();
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && kino) { ownFull = false; setSetting('bars', false); }
  });
  addEventListener('keydown', (e) => { if (kino && e.key === 'Escape') setSetting('bars', false); });
  addEventListener('pointermove', wake, { passive: true });

  return { station(level) { lv = level; syncSound(); } };
}
