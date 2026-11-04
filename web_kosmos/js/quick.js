// Schnell-Leiste oben rechts (Vorschau 26.10.2026 Knopf:A; Umbau Vorschau 04.11.2026 „Schnell-Leiste“: Zusatz:A+B+C, nur Symbole,
// Leiste:A+B): drei Gruppen mit Überschrift – Szene (Ton, Kamerafahrt, Animation, Farblook) · Fenster (Infotafel, Zeitleiste,
// Maßstab) · Anzeige (Kinobalken, Vollbild, UI, Hell, Qualität, Bildrate) – und ganz rechts „Mehr“ (⋯) mit einem Menü aller
// Zusatz-Einstellungen als ablesbare Zeilen (gleiche Bauteile wie das Zahnrad: pickHtml, Schalter, Farblook-Kacheln).
// Keine Wörter unter den Symbolen: Tooltip + aria-label nennen Name und Stufe („Animation: Ruhig“).
// Ton: schaltet den Schalter „sound“ der Station (sound.js oder eigener Takt des Pulsars) zwischen „Aus“ und der ersten
// Aufnahme; Station ohne Ton → Knopf ausgegraut mit Grund im Tooltip. Zeitleiste ebenso, wenn die Station keinen Ablauf
// zum Abspielen hat. Alle übrigen folgen kosmos.settings.v1 (settings.js, auch aus dem Zahnrad).
// Kinobalken = nur die Balken, kein Vollbild (User 28.10.2026); Vollbild hat einen eigenen Knopf. Infotafel: hud.js.

import { settings, setSetting, onSettings, DEFAULTS, looksHtml, gradeName } from './settings.js';
import { pickHtml, pickOf, showPick, layersOf } from './layers.js';

// Schalter an/aus: Knopf-Id → [Schlüssel, Name]
const KEYS = { 'qk-cine': ['cine', 'Kamerafahrt im Leerlauf'], 'qk-bars': ['bars', 'Kinobalken 2,39:1'], 'qk-scale': ['scaleCompare', 'Maßstabs-Vergleich'] };
// Stufen: ein Klick = nächste Stufe (am Ende wieder die erste); Knopf leuchtet, sobald der Wert vom Standard abweicht
const STEPS = {
  'qk-motion': ['motion', 'Animation', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']]],
  'qk-quality': ['quality', 'Qualität', [['auto', 'Auto'], ['1', 'Niedrig'], ['2', 'Mittel'], ['3', 'Hoch']]],
  'qk-fps': ['fpsCap', 'Bildrate', [[0, 'Frei'], [30, '30 Bilder/s'], [60, '60 Bilder/s']]],
};
const NO_SOUND = 'Kein Ton: diese Station hat keine echte Aufnahme';
const NO_TL = 'Keine Zeitleiste: diese Station hat keinen Ablauf zum Abspielen';
const num = (k, v) => (typeof DEFAULTS[k] === 'number' ? +v : v);
const TOG = (key, label) => `<label class="b-row cfg-toggle" data-row="${key}"><span class="cfg-label">${label}</span><input type="checkbox" data-key="${key}"><span class="switch" aria-hidden="true"></span></label>`;

export function mountQuick(root, onInput) {
  const $ = (id) => root.querySelector(`#${id}`);
  const snd = $('qk-sound'), full = $('qk-full'), tl = $('qk-timeline');
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

  // Stufen-Knöpfe: Symbol zeigt die Stufe (data-lvl, kosmos.css), Tooltip nennt sie
  const stepIdx = (key, opts) => Math.max(0, opts.findIndex(([v]) => String(v) === String(settings.S[key])));
  const syncSteps = () => Object.entries(STEPS).forEach(([id, [key, name, opts]]) => {
    const b = $(id), i = stepIdx(key, opts);
    b.dataset.lvl = String(i);
    b.setAttribute('aria-pressed', String(String(settings.S[key]) !== String(DEFAULTS[key])));
    label(b, `${name}: ${opts[i][1]}`);
  });
  Object.entries(STEPS).forEach(([id, [key, , opts]]) => $(id).addEventListener('click', () => {
    setSetting(key, num(key, opts[(stepIdx(key, opts) + 1) % opts.length][0]));
    onInput();
  }));

  // Zeitleiste: nur an Stationen mit einem Ablauf zum Abspielen (Ebene type 'play', layers.js), sonst ausgegraut mit Grund
  const hasTl = () => !!lv && (layersOf(lv.id) || []).some((l) => l.type === 'play');
  const syncTl = () => {
    const ok = hasTl(), on = ok && !!settings.S.timeline;
    tl.setAttribute('aria-disabled', String(!ok));
    tl.setAttribute('aria-pressed', String(on));
    label(tl, !ok ? NO_TL : `Zeitleiste der Station ${on ? 'aus' : 'an'}`);
    const row = menu.querySelector('[data-row="timeline"]'), na = menu.querySelector('.qm-na');
    row.classList.toggle('is-na', !ok);
    row.querySelector('input').disabled = !ok;
    na.hidden = ok;
  };
  tl.addEventListener('click', () => { if (hasTl()) { setSetting('timeline', !settings.S.timeline); onInput(); } });

  // ---------- Aufklapp-Fenster: Farblook-Liste unter dem Knopf und Mehr-Menü; nie beide offen, Esc oder Klick daneben schließt ----------
  const grade = $('qk-grade'), gradeBox = $('qk-grade-list'), more = $('qk-more'), menu = $('qk-menu');
  const pops = [];
  function popover(btn, box) {
    const open = (on) => {
      if (on) pops.forEach((o) => o !== open && o(false));
      box.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      if (on) { syncBoxes(); box.querySelector('input:not(:disabled), button')?.focus(); }
      else if (box.contains(document.activeElement)) btn.focus();
    };
    btn.addEventListener('click', () => open(box.hidden));
    document.addEventListener('pointerdown', (e) => { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) open(false); });
    document.addEventListener('keydown', (e) => { if (!box.hidden && e.key === 'Escape') { e.preventDefault(); open(false); btn.focus(); } });
    pops.push(open);
    return open;
  }
  gradeBox.innerHTML = looksHtml('qk-grade-lab');
  menu.innerHTML = pickHtml('motion', 'Animation', STEPS['qk-motion'][2], { ordered: true, lid: 'qm-motion' })
    + looksHtml('qm-grade')
    + TOG('timeline', 'Zeitleiste der Station') + `<p class="qm-na cfg-note" hidden>${NO_TL}</p>`
    + TOG('scaleCompare', 'Maßstabs-Vergleich')
    + pickHtml('quality', 'Qualität', STEPS['qk-quality'][2], { ordered: true, lid: 'qm-quality' })
    + pickHtml('fpsCap', 'Bildrate', STEPS['qk-fps'][2], { ordered: true, lid: 'qm-fps' });
  const openGrade = popover(grade, gradeBox);
  popover(more, menu);
  // Werte setzen – gleiche Attribute wie im Zahnrad (data-key/data-val Kacheln, data-pick Regler, Schalter data-key)
  for (const box of [gradeBox, menu]) {
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key][data-val]');
      if (!b) return;
      setSetting(b.dataset.key, num(b.dataset.key, b.dataset.val));
      onInput();
      if (box === gradeBox) openGrade(false);
    });
    box.addEventListener('input', (e) => {
      const i = e.target;
      if (i.dataset.pick) setSetting(i.dataset.pick, num(i.dataset.pick, pickOf(i)));
      else if (i.dataset.key) setSetting(i.dataset.key, i.checked);
      onInput();
    });
  }
  const syncBoxes = () => {
    const S = settings.S;
    for (const box of [gradeBox, menu]) {
      box.querySelectorAll('[data-key][data-val]').forEach((b) => b.setAttribute('aria-checked', String(String(S[b.dataset.key]) === b.dataset.val)));
      box.querySelectorAll('[data-pick]').forEach((el) => showPick(el, S[el.dataset.pick], DEFAULTS[el.dataset.pick]));
      box.querySelectorAll('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    }
  };
  const syncGrade = () => {
    grade.setAttribute('aria-pressed', String(settings.S.grade !== 'station'));
    label(grade, `Farblook: ${gradeName(settings.S.grade)}`);
  };

  const syncAll = () => { syncKeys(); syncSteps(); syncTl(); syncGrade(); syncBoxes(); };
  onSettings(syncAll);
  syncAll();

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
  // Esc tut nur eine Sache: hat es schon ein Panel oder Menü geschlossen (settings.js und oben, document – läuft vor window)
  // oder läuft der Auftakt-Film (main.js überspringt ihn), bleiben die Balken
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
      if (uiOff) pops.forEach((o) => o(false));
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
  return { station(level) { lv = level; syncSound(); syncTl(); } };
}
