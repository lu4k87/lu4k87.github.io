// Zugänge: Passwort anzeigen/kopieren ohne Seitenwechsel. Ohne JS senden die Formulare normal (Seite zeigt den Wert).
(() => {
  const HIDE_SECONDS = 30;
  const say = (box, text) => { const st = box.querySelector('.st'); if (st) st.textContent = text; };
  const showBtn = (box) => box.querySelector('button[value=anzeigen] span');

  function hide(box) {
    clearTimeout(box.hideTimer);
    box.querySelector('.val')?.remove();
    box.classList.remove('shown');
    if (showBtn(box)) showBtn(box).textContent = 'Anzeigen';
    say(box, '');
  }

  function show(box, text) {
    let val = box.querySelector('.val');
    if (!val) {
      val = document.createElement('span');
      val.className = 'val';
      box.querySelector('.dots').after(val);
    }
    val.textContent = text;  // nie innerHTML
    box.classList.add('shown');
    if (showBtn(box)) showBtn(box).textContent = 'Verdecken';
    say(box, `Sichtbar für ${HIDE_SECONDS} Sekunden · steht im Protokoll.`);
    clearTimeout(box.hideTimer);
    box.hideTimer = setTimeout(() => hide(box), HIDE_SECONDS * 1000);
    return val;
  }

  async function copy(box, text) {
    try {
      await navigator.clipboard.writeText(text);
      say(box, 'Kopiert.');
    } catch {
      // ohne HTTPS gibt es keine Zwischenablage-API → Wert zeigen und markieren
      const val = box.querySelector('.val') || show(box, text);
      const range = document.createRange();
      range.selectNodeContents(val);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      say(box, 'Markiert – mit Strg+C kopieren.');
    }
  }

  document.querySelectorAll('form[data-secret]').forEach((form) => form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const action = ev.submitter ? ev.submitter.value : 'anzeigen';
    if (action === 'anzeigen' && form.classList.contains('shown')) { hide(form); return; }
    const body = new FormData(form);
    body.set('action', action);
    let res;
    let data;
    try {
      // getAttribute: form.action wäre wegen der Knöpfe name="action" die Knopf-Liste, nicht die Adresse
      res = await fetch(form.getAttribute('action'), { method: 'POST', body, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' });
      data = await res.json();
    } catch {
      say(form, 'Das hat nicht geklappt – bitte die Seite neu laden.');
      return;
    }
    if (res.status === 403 && data.reauth) { window.location.assign(data.reauth); return; }
    if (!res.ok || typeof data.value !== 'string') { say(form, 'Das hat nicht geklappt – bitte die Seite neu laden.'); return; }
    if (action === 'kopieren') copy(form, data.value); else show(form, data.value);
  }));

  document.querySelectorAll('[data-vcopy]').forEach((btn) => btn.addEventListener('click', () => {
    const box = btn.closest('.secret');
    copy(box, box.querySelector('.val').textContent);
  }));
})();
