// Hell/Dunkel der Bedienoberfläche (die 3D-Szene bleibt dunkel wie im Mikroskop); Wahl bleibt im Browser.
// Umschalter Auto · Hell · Dunkel im Einstellungs-Panel (settings.js, Vorschau 2026-10-25); Auto = Systemeinstellung.

const root = document.documentElement;
const KEY = 'biochar-theme';

function apply(theme) {
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

try { apply(localStorage.getItem(KEY)); } catch { /* ohne Speicher: Systemeinstellung */ }

export const theme = () => root.dataset.theme || 'auto';
export function setTheme(t) {
  apply(t);
  try { if (root.dataset.theme) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* egal */ }
}

window.addEventListener('pointerdown', () => document.body.classList.add('touched'), { once: true });
