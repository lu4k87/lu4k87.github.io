// Hell/Dunkel der Bedienoberfläche (die 3D-Szene bleibt dunkel wie im Mikroskop); Wahl bleibt im Browser.

const root = document.documentElement;
const KEY = 'biochar-theme';

function apply(theme) {
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
}

try { apply(localStorage.getItem(KEY)); } catch { /* ohne Speicher: Systemeinstellung */ }

document.getElementById('btn-theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  apply(next);
  try { localStorage.setItem(KEY, next); } catch { /* egal */ }
});

window.addEventListener('pointerdown', () => document.body.classList.add('touched'), { once: true });
