// Schnell-Knöpfe in der Kopfzeile links neben dem Zahnrad (Vorschau 26.10.2026 Knopf:A): Ton der Station, Kamerafahrt im
// Leerlauf, Kinobalken, Vollbild (Drehachsen nur im Reiter Station – in der Station selbst sind keine zu sehen, User 28.10.2026) – je ein Klick statt Infotafel bzw. Zahnrad.
// Ton: schaltet den Schalter „sound“ der Station (sound.js oder eigener Takt des Pulsars) zwischen „Aus“ und der ersten
// Aufnahme; Station ohne Ton → Knopf ausgegraut mit Grund im Tooltip. Die übrigen folgen kosmos.settings.v1 (auch aus dem Zahnrad).
// Kinobalken = nur die Balken, kein Vollbild (User 28.10.2026); Vollbild hat einen eigenen Knopf. Ganz rechts: helles Theme.

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
  full.hidden = !document.fullscreenEnabled || !document.documentElement.requestFullscreen;
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
  // Esc tut nur eine Sache: hat es schon ein Panel geschlossen (settings.js, document – läuft vor window) oder läuft der
  // Auftakt-Film (main.js überspringt ihn), bleiben die Balken
  const escFree = (e) => !e.defaultPrevented && !document.body.classList.contains('is-opener');
  addEventListener('keydown', (e) => { if (settings.S.bars && e.key === 'Escape' && escFree(e)) setSetting('bars', false); });

  // UI-Elemente ein-/ausblenden (User 29.10.2026): verbergen aller HUD-Elemente, Schalter bleibt sichtbar
  const uiBtn = $('qk-ui');
  let uiOff = false;
  const syncUi = () => {
    document.body.classList.toggle('ui-off', uiOff);
    if (uiBtn) {
      uiBtn.setAttribute('aria-pressed', String(uiOff));
      uiBtn.classList.toggle('is-off', uiOff);
      label(uiBtn, uiOff ? 'UI-Elemente einblenden' : 'UI-Elemente ausblenden');
    }
  };
  if (uiBtn) {
    uiBtn.addEventListener('click', () => {
      uiOff = !uiOff;
      syncUi();
      onInput();
      window.dispatchEvent(new CustomEvent('kosmos:side'));
    });
  }
  syncUi();
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea, [role="tab"], [role="radio"]')) return;
    if (uiOff && e.key === 'Escape' && escFree(e)) {
      uiOff = false;
      syncUi();
      onInput();
      window.dispatchEvent(new CustomEvent('kosmos:side'));
    }
  });

  // Helles Theme (Vorschau 29.10.2026 Schalter:A): nur Bedienflächen, gespeichert in kosmos.theme, gesetzt schon im <head>
  const theme = $('qk-theme'), html = document.documentElement;
  const syncTheme = () => {
    const on = html.dataset.theme === 'light';
    theme.setAttribute('aria-pressed', String(on));
    label(theme, on ? 'Dunkles Theme' : 'Helles Theme');
  };
  theme.addEventListener('click', () => {
    const on = html.dataset.theme !== 'light';
    if (on) html.dataset.theme = 'light'; else delete html.dataset.theme;
    try { localStorage.setItem('kosmos.theme', on ? 'light' : 'dark'); } catch {}
    syncTheme();
  });
  syncTheme();

  addEventListener('kosmos:sound', syncSound);   // einmaliger Ton (Apollo 11) zu Ende
  return { station(level) { lv = level; syncSound(); } };
}
