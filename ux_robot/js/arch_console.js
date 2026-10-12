/* Architektur-Leitstand (docs/project_docs.html #architektur, css/arch_console.css)
   8 Bedienarten → Prüfungen ihres Wegs → xArm Lite 6 (FAKE), Digital Twin, UX | Monitoring.
   Wege + Prüfungen aus docs/operate_manual.html (PATHS, Schritte je Bedienart); Demo-Zähler nur im Browser, keine Live-Daten.
   Bewegung: Lichtpakete auf SVG-Kanten, Lichtstreifen im Canvas – nur sichtbar, prefers-reduced-motion = Standbild. */
(function () {
  const fig = document.getElementById('ar-console');
  if (!fig) return;
  const $ = s => fig.querySelector(s), $$ = s => [...fig.querySelectorAll(s)];
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (de, en) => (document.documentElement.lang === 'en' ? en : de);
  const wait = ms => new Promise(r => setTimeout(r, REDUCE ? 0 : ms));
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

  // Prüfungen je Weg (wd Watchdog · pre Kollisionsvorprüfung · ok Bestätigung · mh Motion Handler), Ausführung Servo oder MoveGroup
  const WAYS = {
    pad: { s: ['pre'], x: 'Servo', topic: '/joy' },
    remote: { s: ['wd', 'pre'], x: 'Servo', topic: '/remote/joy' },
    jog: { s: ['wd'], x: 'Servo', topic: '/remote/twist' },
    plan: { s: ['ok', 'mh'], x: 'MoveGroup', topic: '/ui/plan_move_to_pose_confirm' },
    vr: { s: ['wd'], x: 'Servo', topic: '/vr_teleop/controller_data' },
    voice: { s: ['mh'], x: 'MoveGroup', topic: '/ui/voice_listen_trigger' },
    gaze: { s: ['mh'], x: 'MoveGroup', topic: '/ui/execute_move_to_pose' },
    vla: { s: ['ok', 'mh'], x: 'MoveGroup', topic: '/vla/instruction' },
  };
  const ways = $$('.ac-way'), checks = $$('.ac-checks li'), outs = $$('.ac-out');
  const wires = $('.ac-wires'), live = $('.ac-live'), send = $('.ac-send'), estop = $('.ac-estop');
  const spark = $('.ac-spark'), hist = Array(14).fill(0);
  let inW = [], outW = [], cur = 0, busy = false, stopped = false, count = 0, auto = !REDUCE;

  const drawSpark = () => { spark.innerHTML = hist.map(v => `<i style="height:${8 + v * 88}%"></i>`).join(''); };

  // Leitungen: jede Bedienart → eigener Port links am Panel, Panel → jeder Ausgang
  function layout() {
    wires.replaceChildren(); inW = []; outW = [];
    if (getComputedStyle(wires).display === 'none') return;
    const fr = fig.getBoundingClientRect(), core = $('.ac-core').getBoundingClientRect(), ins = $('.ac-ins').getBoundingClientRect();
    const X = r => r - fr.left, Y = r => r - fr.top;
    const pair = d => { svgEl('path', { d, class: 'g' }, wires); return svgEl('path', { d, class: 'w' }, wires); };
    ways.forEach((b, i) => {
      const r = b.getBoundingClientRect(), sy = Y(r.top + r.height / 2), sx = X(ins.right), ex = X(core.left);
      const ey = Y(core.top) + core.height * (.26 + i * .07), mx = (sx + ex) / 2;
      inW.push(pair(`M${X(r.right)} ${sy} H${sx} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}`));
    });
    outs.forEach((o, i) => {
      const r = o.getBoundingClientRect();
      if (r.left < core.right) return;   // Ausgänge unter dem Panel (schmal): keine Leitung
      const sx = X(core.right), sy = Y(core.top) + core.height * (.4 + i * .14), ey = Y(r.top + r.height / 2), mx = (sx + X(r.left)) / 2;
      outW.push(pair(`M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${X(r.left)} ${ey}`));
    });
    mark();
  }
  const both = (p, cls, on) => { p.classList.toggle(cls, on); p.previousSibling.classList.toggle(cls, on); };
  const mark = () => inW.forEach((p, i) => both(p, 'sel', i === cur));

  // Lichtpaket: Kopf, zwei Nachleuchter, Halo (keine Filter)
  function pulse(path, dur = 750) {
    if (REDUCE || !path) return Promise.resolve();
    const len = path.getTotalLength(), g = svgEl('g', {}, wires);
    const halo = svgEl('circle', { r: 12, fill: 'var(--hue)', opacity: .16 }, g);
    const tail = [.35, .18].map((o, i) => svgEl('circle', { r: 3.2 - i * .8, fill: 'var(--hue)', opacity: o }, g));
    const head = svgEl('circle', { r: 4, fill: 'var(--hue)' }, g);
    const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const at = t => path.getPointAtLength(ease(Math.max(0, t)) * len);
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / dur), p = at(t);
        [halo, head].forEach(c => { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
        tail.forEach((c, i) => { const q = at(t - .05 * (i + 1)); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); });
        if (t < 1) requestAnimationFrame(step); else { g.remove(); res(); }
      };
      requestAnimationFrame(step);
    });
  }

  function select(i) {
    cur = i;
    ways.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const w = WAYS[ways[i].dataset.w];
    $('.ac-wname').textContent = ways[i].textContent.trim();
    $('.ac-topic').textContent = w.topic;
    checks.forEach(li => { li.className = w.s.includes(li.dataset.s) ? '' : 'skip'; li.querySelector('em').textContent = w.s.includes(li.dataset.s) ? T('bereit', 'ready') : T('nicht im Weg', 'not on path'); });
    mark();
  }

  async function run() {
    if (busy) return;
    busy = true;
    const b = ways[cur], w = WAYS[b.dataset.w], name = b.textContent.trim();
    outs.forEach(o => o.classList.remove('on', 'halt'));
    outW.forEach(p => both(p, 'bad', false));
    select(cur);
    live.innerHTML = `<b>${name}</b> → ${T('Prüfung läuft', 'checking')}`;
    send.classList.remove('fire'); void send.offsetWidth; send.classList.add('fire');
    if (inW[cur]) both(inW[cur], 'run', true);
    await pulse(inW[cur], 800);
    for (const li of checks) {
      if (li.classList.contains('skip')) continue;
      await wait(280);
      if (stopped) { li.className = 'no'; li.querySelector('em').textContent = T('✕ Not-Aus', '✕ E-stop'); break; }
      li.className = 'ok'; li.querySelector('em').textContent = T('✓ frei', '✓ clear');
    }
    if (inW[cur]) both(inW[cur], 'run', false);
    const arm = outs[0];
    if (stopped) {
      arm.classList.add('halt'); $('.ac-arm').textContent = T('gestoppt, verriegelt bis Reset', 'stopped, latched until reset');
      outW.forEach(p => both(p, 'bad', true));
      live.innerHTML = `<b>${T('Gestoppt', 'Stopped')}</b> – ${T('kein Befehl erreicht den Arm', 'no command reaches the arm')}`;
      busy = false; return;
    }
    await Promise.all(outW.map((p, i) => wait(i * 90).then(() => pulse(p, 700))));
    outs.forEach(o => o.classList.add('on'));
    count++; $('.ac-cnt').textContent = count; hist.shift(); hist.push(.35 + Math.random() * .65); drawSpark();
    $('.ac-arm').textContent = `MoveIt ${w.x} → ${T('bewegt', 'moving')}`;
    $('.ac-meter i').style.width = `${40 + Math.random() * 55}%`;
    live.innerHTML = `<b>${name}</b> → ${T('freigegeben', 'cleared')}`;
    busy = false;
  }

  const user = fn => e => { auto = false; fn(e); };
  ways.forEach((b, i) => b.addEventListener('click', user(() => { select(i); run(); })));
  send.addEventListener('click', user(run));
  estop.addEventListener('click', user(() => {
    stopped = !stopped; estop.setAttribute('aria-pressed', String(stopped));
    if (!stopped) { outs[0].classList.remove('halt'); $('.ac-arm').textContent = T('wartet', 'waiting'); outW.forEach(p => both(p, 'bad', false)); }
    run();
  }));

  // Lichtstreifen aus der Mitte (Canvas), Demo-Schleife; beides nur, solange sichtbar
  const cv = $('.ac-rays'), cx = cv.getContext('2d');
  const streaks = Array.from({ length: 70 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random(), v: .0012 + Math.random() * .0025, l: .04 + Math.random() * .12 }));
  function rays() {
    const r = fig.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const W = cv.width, H = cv.height, R = Math.hypot(W, H) / 2;
    cx.clearRect(0, 0, W, H); cx.lineWidth = 1.2 * dpr; cx.strokeStyle = getComputedStyle(fig).getPropertyValue('--hue').trim() || '#818cf8';
    for (const s of streaks) {
      if (!REDUCE) { s.d += s.v; if (s.d > 1) { s.d = .12; s.a = Math.random() * Math.PI * 2; } }
      const r0 = R * (.15 + s.d * .85), r1 = r0 + R * s.l;
      cx.globalAlpha = .08 + .24 * s.d;
      cx.beginPath(); cx.moveTo(W / 2 + Math.cos(s.a) * r0, H / 2 + Math.sin(s.a) * r0); cx.lineTo(W / 2 + Math.cos(s.a) * r1, H / 2 + Math.sin(s.a) * r1); cx.stroke();
    }
    cx.globalAlpha = 1;
  }
  let visible = false, raf = 0, demoOn = false;
  const loop = () => { raf = 0; rays(); if (visible && !document.hidden && !REDUCE) raf = requestAnimationFrame(loop); };
  async function demo() {
    if (demoOn) return; demoOn = true;
    while (auto && visible && !document.hidden) { await wait(2600); if (!auto || !visible) break; select((cur + 1) % ways.length); await run(); }
    demoOn = false;
  }
  const wake = () => { fig.style.setProperty('--ac-play', visible ? 'running' : 'paused'); if (visible && !raf) raf = requestAnimationFrame(loop); if (visible && auto) demo(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(fig);
  document.addEventListener('visibilitychange', wake);
  new ResizeObserver(() => { layout(); rays(); }).observe(fig);
  // Sprachwechsel: Texte der aktuellen Auswahl neu setzen (data-en-Texte tauscht die Seite selbst)
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setTimeout(() => { if (!busy) select(cur); }, 0)));

  drawSpark(); select(0); layout(); rays();
  $('.ac-arm').textContent = T('wartet', 'waiting');
})();
