// Schnell-Knöpfe in der Kopfzeile links neben dem Zahnrad (Vorschau 26.10.2026 Knopf:A): Ton der Station, Kamerafahrt im
// Leerlauf, Kinobalken, Vollbild (Drehachsen nur im Reiter Station – in der Station selbst sind keine zu sehen, User 28.10.2026) – je ein Klick statt Infotafel bzw. Zahnrad.
// Ton: schaltet den Schalter „sound“ der Station (sound.js oder eigener Takt des Pulsars) zwischen „Aus“ und der ersten
// Aufnahme; Station ohne Ton → Knopf ausgegraut mit Grund im Tooltip. Die übrigen folgen kosmos.settings.v1 (auch aus dem Zahnrad).
// Kinobalken = nur die Balken, kein Vollbild (User 28.10.2026); Vollbild hat einen eigenen Knopf.

import { settings, setSetting, onSettings } from './settings.js';

const KEYS = { 'qk-cine': ['cine', 'Kamerafahrt im Leerlauf'], 'qk-bars': ['bars', 'Kinobalken 2,39:1'] };
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

  // Kinobalken (User 28.10.2026): nur die Balken, kein Wechsel ins Vollbild; Esc schaltet sie aus
  const syncKino = () => document.body.classList.toggle('is-kino', !!settings.S.bars);
  onSettings(syncKino);
  syncKino();
  addEventListener('keydown', (e) => { if (settings.S.bars && e.key === 'Escape') setSetting('bars', false); });

  return { station(level) { lv = level; syncSound(); } };
}
