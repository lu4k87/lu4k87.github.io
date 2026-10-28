// Ton des Urknall-Intros v2, alles synthetisch (Web Audio, keine fremde Datei, keine Lizenzfrage). Nach dem Vorbild des
// Videos „The Big Bang Simulation Video“ (Simulation World): Riser (0–4,3 s dort) → Breitband-Knall mit 5 s Ausklang →
// Drone bis zum Ende. Abgewandelt (User 28.10.2026, „etwas klarer, nicht so dumpf“): das Original endet bei 5 kHz –
// hier kommen Knack und Klick im Knall (3–7 kHz), eine Luft-Schicht (3,6 kHz) und ein Schimmer (ab 7 kHz) im Drone dazu,
// der Riser bekommt einen hohen Flirr-Anteil, und jeder Funke am Anfang bekommt einen leisen, langsam anschwellenden Ton.
// Zeiten kommen aus intro_v2.js (T, BLINKS). play(from) plant alles ab der Filmzeit `from` (Spulen = stop + play):
// Hüllkurven vor `from` werden auf ihren letzten Wert gesetzt, Quellen enden mit der Filmzeit.

const MASTER = 0.8;

export function createSound(T, BLINKS) {
  let ctx = null, master = null, muteGain = null, noiseBuf = null, live = [];

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.3;
    muteGain = ctx.createGain(); muteGain.gain.value = 1;
    master = ctx.createGain(); master.gain.value = MASTER;
    master.connect(comp).connect(muteGain).connect(ctx.destination);
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
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function chain(...nodes) { for (let i = 0; i + 1 < nodes.length; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
  // Quelle im Fenster [t0, t1] der Filmzeit starten und stoppen; außerhalb des Fensters gar nicht anlegen
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
    const tb = T.bang;

    // Funken: je Blinken ein leiser Ton, der mit dem Licht anschwillt (Grundton steigt von Funke zu Funke)
    BLINKS.forEach(([s, rise, hold, fall, peak], i) => {
      const end = s + rise + hold + fall;
      if (end <= from) return;
      const f = 165 * Math.pow(1.06, i), g = gain(0), lp = filt('lowpass', 2400);
      const parts = [[1, 1], [2, 0.3], [4, 0.08]].map(([m, a]) => { const o = osc('sine', f * m), ga = gain(a); chain(o, ga, g); return o; });
      chain(g, lp, master);
      env(g.gain, [[s, 0], [s + rise, 0.11 * peak], [s + rise + hold, 0.11 * peak], [end, 0]], from, now);
      parts.forEach((o) => run(o, s, end, from, now));
    });

    // Sammeln: tiefer Brummton steigt, Riser aus Rauschen fährt hoch, Flirren obenauf; Luftholen = Filter zu, dann Knall
    if (tb > from) {
      const hum = osc('sine', 44), hg = gain(0);
      chain(hum, hg, master);
      env(hum.frequency, [[T.gather, 44], [tb, 60]], from, now);
      env(hg.gain, [[T.gather, 0], [T.gather + 2, 0.18], [T.breath, 0.22], [tb - 0.1, 0.05], [tb, 0]], from, now);
      run(hum, T.gather, tb, from, now);

      const rn = noise(), bp = filt('bandpass', 160, 1.1), lp = filt('lowpass', 9000), rg = gain(0);
      chain(rn, bp, lp, rg, master);
      env(bp.frequency, [[T.gather, 160], [tb, 2400, 'exp']], from, now);
      env(lp.frequency, [[T.breath, 9000], [tb - 0.15, 700, 'exp'], [tb, 9000, 'set']], from, now);
      env(rg.gain, [[T.gather, 0], [T.gather + 1, 0.04], [T.breath, 0.30], [tb - 0.05, 0.36], [tb, 0]], from, now);
      run(rn, T.gather, tb, from, now);

      const sn = noise(), sb = filt('bandpass', 5200, 5), sg = gain(0);
      chain(sn, sb, sg, master);
      env(sg.gain, [[T.gather + 2, 0], [tb - 0.1, 0.05], [tb, 0]], from, now);
      run(sn, T.gather + 2, tb, from, now);
    }

    // Knall: Sub-Schlag mit fallender Tonhöhe, Körper aus Rauschen mit zufahrendem Filter, dazu Knack, Klick und Luft
    const sub = osc('sine', 160), subg = gain(0);
    chain(sub, subg, master);
    env(sub.frequency, [[tb, 160, 'set'], [tb + 0.45, 34, 'exp']], from, now);
    env(subg.gain, [[tb, 0, 'set'], [tb + 0.01, 1.0], [tb + 2.4, 0.0001, 'exp']], from, now);
    run(sub, tb, tb + 2.6, from, now);

    const body = noise(), blp = filt('lowpass', 5000, 0.5), bg = gain(0);
    chain(body, blp, bg, master);
    env(blp.frequency, [[tb, 5000, 'set'], [tb + 3.5, 380, 'exp']], from, now);
    env(bg.gain, [[tb, 0, 'set'], [tb + 0.015, 0.9], [tb + 0.4, 0.55], [tb + 5, 0.0001, 'exp']], from, now);
    run(body, tb, tb + 5.2, from, now);

    for (const [type, f, q, peak, dur] of [['bandpass', 3300, 0.7, 0.55, 0.3], ['highpass', 6500, 0, 0.35, 0.09], ['highpass', 2600, 0, 0.16, 3.5]]) {
      const n = noise(), fl = filt(type, f, q), g = gain(0);
      chain(n, fl, g, master);
      env(g.gain, [[tb, 0, 'set'], [tb + 0.005, peak], [tb + dur, 0.0001, 'exp']], from, now);
      run(n, tb, tb + dur + 0.1, from, now);
    }

    // Drone ab kurz nach dem Knall bis zum Ende: Bett aus tiefem Rauschen (Filter atmet), zwei schwebende Sägezähne,
    // Luft bei 3,6 kHz, Schimmer über 7 kHz, leiser Quint-Teppich; alles schwillt langsam (0,045 Hz) an und ab
    const d0 = tb + 0.3, dg = gain(0), swell = gain(1);
    chain(dg, swell, master);
    env(dg.gain, [[d0, 0], [d0 + 2.7, 1], [T.fade, 1], [T.end, 0]], from, now);
    const lfo = osc('sine', 0.045), lg = gain(0.22);
    chain(lfo, lg, swell.gain);
    run(lfo, d0, T.end, from, now);

    const bed = noise(), blp2 = filt('lowpass', 900, 0.6), bedg = gain(0.20);
    chain(bed, blp2, bedg, dg);
    const flfo = osc('sine', 0.07), flg = gain(300);
    chain(flfo, flg, blp2.frequency);
    run(bed, d0, T.end, from, now); run(flfo, d0, T.end, from, now);

    for (const [type, f, a] of [['sawtooth', 55, 0.055], ['sawtooth', 55.35, 0.055], ['sine', 110, 0.03], ['sine', 164.8, 0.012], ['sine', 247, 0.010]]) {
      const o = osc(type, f), lp = filt('lowpass', 320), g = gain(a);
      chain(o, lp, g, dg);
      run(o, d0, T.end, from, now);
    }

    const air = noise(), abp = filt('bandpass', 3600, 0.8), ag = gain(0.03);
    chain(air, abp, ag, dg);
    const alfo = osc('sine', 0.11), alg = gain(0.012);
    chain(alfo, alg, ag.gain);
    run(air, d0, T.end, from, now); run(alfo, d0, T.end, from, now);

    const sh = noise(), shp = filt('highpass', 7200), shg = gain(0.010);
    chain(sh, shp, shg, dg);
    run(sh, d0, T.end, from, now);
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
