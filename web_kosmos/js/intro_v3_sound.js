// Ton des Urknall-Intros v3 (One-Shot, 30 s), alles synthetisch (Web Audio, keine fremde Datei, keine Lizenzfrage).
// Folgt der Kamerafahrt aus intro_v3.js: Kontraktion = tiefer Doppelton, der sich zusammenzieht und steigt, Saugen aus
// Rauschen, gläserne Klicks an den Flimmer-Spitzen (TICKS) → Luftholen (alles zieht sich zu) → Ausbruch (Sub-Schlag,
// Körper, Knack) → die Druckwelle erreicht die Kamera (TX: Rauschen fegt hoch) → Durchflug durch die Mitte (Schimmer) →
// Strudel: Fahrtwind folgt dem Tempo (velAt) und kreist im Stereobild mit dem Rollen (rollAt), je naher Galaxie ein
// Vorbeiflug-Rauschen von ihrer Seite (PASSES) → Ausgleiten: Wind legt sich, eine weite Fläche schwillt an und klingt aus.
// Raum: synthetischer Hall (Faltung mit abklingendem Rauschen). play(from) plant alles ab der Filmzeit `from`
// (Spulen = stop + play), Hüllkurven vor `from` stehen auf ihrem letzten Wert – wie intro_v2_sound.js.

const MASTER = 0.8;

export function createSound({ T, V, TX, TICKS, PASSES, velAt, rollAt }) {
  let ctx = null, master = null, verb = null, muteGain = null, noiseBuf = null, live = [];

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.3;
    muteGain = ctx.createGain(); muteGain.gain.value = 1;
    comp.connect(muteGain).connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = MASTER; master.connect(comp);
    // Hall: 4 s abklingendes Stereo-Rauschen, Höhen klingen schneller ab (einfacher Tiefpass beim Erzeugen)
    const len = ctx.sampleRate * 4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const k = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.75 * k); d[i] = lp * Math.pow(1 - k, 2.6); }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    verb = ctx.createGain(); verb.gain.value = 0.5;
    verb.connect(conv).connect(master);
    const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;   // Rauschen darf echt zufällig sein (Klang, nicht Bild)
    noiseBuf = b;
  }

  // Hüllkurve: Punkte [filmzeit, wert, art] mit art 'lin' (Standard), 'exp', 'set'; `from` = Filmzeit beim Start
  function env(p, pts, from, now) {
    let v0 = null;
    for (const [tt, v] of pts) if (tt <= from) v0 = v;
    p.cancelScheduledValues(0);
    p.setValueAtTime(v0 === null ? pts[0][1] : v0, now);
    for (const [tt, v, k] of pts) {
      if (tt <= from) continue;
      const ta = now + (tt - from);
      if (k === 'exp') p.exponentialRampToValueAtTime(Math.max(v, 1e-4), ta);
      else if (k === 'set') p.setValueAtTime(v, ta);
      else p.linearRampToValueAtTime(v, ta);
    }
  }
  // Funktion der Filmzeit (Tempo, Rollen) als Rampen-Folge abtasten
  function follow(p, fn, t0, t1, from, now, step = 0.1) {
    const pts = [];
    for (let t = t0; t < t1 + 1e-6; t += step) pts.push([t, fn(t)]);
    env(p, pts, from, now);
  }
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random() * 3; return s; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function pan(v) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; }
  function chain(...nodes) { for (let i = 0; i + 1 < nodes.length; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
  // Knoten trocken auf den Ausgang und mit Anteil `wet` in den Hall
  function out(node, wet) { node.connect(master); if (wet) chain(node, gain(wet), verb); }
  function run(src, t0, t1, from, now) {
    if (t1 !== null && t1 <= from) return false;
    src.start(now + Math.max(0, t0 - from));
    if (t1 !== null) src.stop(now + (t1 - from) + 0.05);
    live.push(src);
    return true;
  }

  function play(from = 0) {
    ensure();
    stop();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime + 0.05;
    const { surge, burst, through, glide, end } = T;
    const vn = (t) => velAt(t) / V.max;

    // 1. Kontraktion: tiefer, schwebender Doppelton zieht sich zusammen (steigt), Saugen aus Rauschen, hoher Flirr, Klicks
    if (burst > from) {
      const g = gain(0);
      out(g, 0.2);
      for (const [f0, f1, a] of [[38, 64, 0.5], [38.5, 65, 0.5], [76, 128, 0.12], [114, 192, 0.04]]) {
        const o = osc('sine', f0), ga = gain(a);
        chain(o, ga, g);
        env(o.frequency, [[0, f0], [surge, f0 + (f1 - f0) * 0.45], [burst - 0.05, f1, 'exp']], from, now);
        run(o, 0, burst, from, now);
      }
      env(g.gain, [[0, 0], [2.5, 0.16], [surge, 0.3], [burst - 0.3, 0.42], [burst - 0.06, 0.04], [burst, 0]], from, now);

      const sn = noise(), bp = filt('bandpass', 220, 2.5), sg = gain(0);
      chain(sn, bp, sg); out(sg, 0.4);
      env(bp.frequency, [[0.5, 220], [surge, 900, 'exp'], [burst - 0.1, 3800, 'exp']], from, now);
      env(sg.gain, [[0.5, 0], [3, 0.05], [surge, 0.14], [burst - 0.15, 0.32], [burst - 0.03, 0]], from, now);
      run(sn, 0.5, burst, from, now);

      const wh = osc('sine', 2400), vib = osc('sine', 5.5), vg = gain(18), wg = gain(0);
      chain(vib, vg, wh.frequency); chain(wh, wg); out(wg, 0.6);
      env(wh.frequency, [[2, 2400], [burst - 0.05, 5600, 'exp']], from, now);
      env(wg.gain, [[2, 0], [surge, 0.008], [burst - 0.2, 0.02], [burst - 0.03, 0]], from, now);
      run(wh, 2, burst, from, now); run(vib, 2, burst, from, now);

      for (const [t, k] of TICKS) {
        if (t < from) continue;
        const o = osc('sine', 2600 + 1600 * k), o2 = osc('sine', (2600 + 1600 * k) * 2.76), tg = gain(0);
        chain(o, tg); chain(o2, gain(0.3), tg); out(tg, 0.8);
        env(tg.gain, [[t, 0, 'set'], [t + 0.004, 0.035 + 0.06 * k], [t + 0.4, 0.0001, 'exp']], from, now);
        run(o, t, t + 0.45, from, now); run(o2, t, t + 0.45, from, now);
      }
    }

    // 2. Ausbruch: Sub-Schlag mit fallender Tonhöhe, Körper aus Rauschen mit zufahrendem Filter, Knack und Klick
    const sub = osc('sine', 150), subg = gain(0);
    chain(sub, subg); out(subg, 0.15);
    env(sub.frequency, [[burst, 150, 'set'], [burst + 0.5, 30, 'exp']], from, now);
    env(subg.gain, [[burst, 0, 'set'], [burst + 0.01, 1.0], [burst + 2.6, 0.0001, 'exp']], from, now);
    run(sub, burst, burst + 2.8, from, now);

    const body = noise(), blp = filt('lowpass', 6000, 0.5), bg = gain(0);
    chain(body, blp, bg); out(bg, 0.35);
    env(blp.frequency, [[burst, 6000, 'set'], [burst + 3, 320, 'exp']], from, now);
    env(bg.gain, [[burst, 0, 'set'], [burst + 0.015, 0.85], [burst + 0.4, 0.5], [burst + 4.5, 0.0001, 'exp']], from, now);
    run(body, burst, burst + 4.7, from, now);

    for (const [type, f, q, peak, dur] of [['bandpass', 3200, 0.7, 0.5, 0.3], ['highpass', 6800, 0, 0.3, 0.08]]) {
      const n = noise(), fl = filt(type, f, q), g = gain(0);
      chain(n, fl, g); out(g, 0.5);
      env(g.gain, [[burst, 0, 'set'], [burst + 0.005, peak], [burst + dur, 0.0001, 'exp']], from, now);
      run(n, burst, burst + dur + 0.1, from, now);
    }

    // 3. Die Druckwelle erreicht die Kamera: Rauschen fegt von tief nach hoch heran, dumpfer Stoß, dann Ausklang
    {
      const n = noise(), bp = filt('bandpass', 300, 1.2), g = gain(0), th = osc('sine', 90), thg = gain(0);
      chain(n, bp, g); out(g, 0.5);
      env(bp.frequency, [[TX - 0.7, 300], [TX, 5200, 'exp'], [TX + 1.6, 900, 'exp']], from, now);
      env(g.gain, [[TX - 0.7, 0], [TX - 0.05, 0.42], [TX + 1.8, 0.0001, 'exp']], from, now);
      run(n, TX - 0.7, TX + 2, from, now);
      chain(th, thg); out(thg, 0.2);
      env(th.frequency, [[TX, 90, 'set'], [TX + 0.6, 36, 'exp']], from, now);
      env(thg.gain, [[TX, 0, 'set'], [TX + 0.02, 0.55], [TX + 1.4, 0.0001, 'exp']], from, now);
      run(th, TX, TX + 1.5, from, now);
    }

    // 4. Durchflug durch die Mitte: heller Schimmer (Obertöne von A), viel Hall
    {
      const g = gain(0);
      out(g, 1.2);
      for (const [f, a] of [[1760, 1], [2637, 0.6], [3520, 0.4], [5274, 0.25]]) {
        const o = osc('sine', f * 1.0015), o2 = osc('sine', f / 1.0015), ga = gain(a * 0.5);
        chain(o, ga, g); o2.connect(ga);
        run(o, through - 0.6, through + 3.5, from, now); run(o2, through - 0.6, through + 3.5, from, now);
      }
      env(g.gain, [[through - 0.6, 0], [through, 0.05], [through + 3.2, 0.0001, 'exp']], from, now);
    }

    // 5. Fahrtwind: zwei Rauschschichten, Filter und Lautstärke folgen dem Tempo, Stereo kreist mit dem Rollen
    const w0 = through - 1.2, w1 = end + 0.5;
    for (const [type, q, side, lvl] of [['lowpass', 0.8, 1, 1], ['bandpass', 0.9, -1, 0.6]]) {
      const n = noise(), fl = filt(type, 400, q), g = gain(0), p = pan(0);
      chain(n, fl, g, p); out(p, 0.3);
      follow(fl.frequency, (t) => (type === 'lowpass' ? 260 : 700) + (type === 'lowpass' ? 3400 : 2200) * vn(t) ** 1.2, w0, w1, from, now);
      follow(g.gain, (t) => lvl * (0.02 + 0.2 * vn(t) ** 1.4) * Math.min(1, (t - w0) / 1.2) * Math.max(0, Math.min(1, (end - t) / 3)), w0, w1, from, now);
      follow(p.pan, (t) => side * 0.7 * Math.sin(rollAt(t)), w0, w1, from, now);
      run(n, w0, w1, from, now);
    }

    // 6. Grundton im Strudel: zwei schwebende Sägezähne + Oktave, gedämpft, schwillt mit dem Tempo
    {
      const g = gain(0), lp = filt('lowpass', 300, 0.7);
      chain(lp, g); out(g, 0.4);
      for (const [type, f, a] of [['sawtooth', 55, 0.06], ['sawtooth', 55.4, 0.06], ['sine', 110, 0.05], ['sine', 82.4, 0.03]]) {
        const o = osc(type, f), ga = gain(a);
        chain(o, ga, lp);
        run(o, through, end + 2.5, from, now);
      }
      follow(lp.frequency, (t) => 180 + 520 * vn(t), through, end, from, now, 0.25);
      env(g.gain, [[through, 0], [through + 2, 1], [glide, 1], [glide + 4, 0.45], [end, 0.3], [end + 2.5, 0]], from, now);
    }

    // 7. Vorbeiflüge naher Galaxien: kurzes Rauschen aus ihrer Richtung, schwillt an und reißt ab
    for (const [t, side, near] of PASSES) {
      if (t + 0.6 <= from) continue;
      const n = noise(), bp = filt('bandpass', 700, 1.4), g = gain(0), p = pan(Math.max(-1, Math.min(1, side * 0.9)));
      chain(n, bp, g, p); out(p, 0.35);
      env(bp.frequency, [[t - 0.45, 700], [t, 2600, 'exp'], [t + 0.5, 900, 'exp']], from, now);
      env(g.gain, [[t - 0.45, 0], [t - 0.02, 0.09 * near], [t + 0.55, 0.0001, 'exp']], from, now);
      run(n, t - 0.45, t + 0.6, from, now);
    }

    // 8. Ausgleiten: weite Fläche (A-Dur ohne Terz unten, Terz oben), langsam schwebend, Hall; klingt nach dem Ende aus
    {
      const g = gain(0), lp = filt('lowpass', 2200, 0.5);
      chain(lp, g); out(g, 1.0);
      for (const [f, a] of [[110, 0.5], [164.8, 0.4], [220, 0.35], [277.2, 0.18], [329.6, 0.22], [440, 0.12], [659.3, 0.06]]) {
        for (const det of [0.998, 1.002]) {
          const o = osc('triangle', f * det), ga = gain(a * 0.05);
          chain(o, ga, lp);
          run(o, glide - 1.5, end + 4, from, now);
        }
      }
      env(g.gain, [[glide - 1.5, 0], [glide + 3, 0.8], [end - 1, 1], [end + 3.8, 0.0001, 'exp']], from, now);
    }
  }

  function stop() {
    for (const s of live) { try { s.stop(); } catch (e) { /* schon zu Ende */ } }
    live = [];
  }

  function setMuted(m) {
    if (!muteGain) return;
    muteGain.gain.cancelScheduledValues(0);
    muteGain.gain.linearRampToValueAtTime(m ? 0 : 1, ctx.currentTime + 0.15);
  }

  return { play, stop, setMuted, get ready() { return !!ctx; } };
}
