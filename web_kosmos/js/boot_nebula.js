// Nebel im Ladebild (Vorschau 27.10.2026, alle drei Looks wählbar; User 27.10.2026: „schneller, mehr Details, animiert,
// bessere 3D-Nebel, dezent mehr Effekte“): echter Volumennebel per Raymarching, jedes Bild neu gerechnet. Die Kamera fliegt
// langsam durch das Gas, das Gas fließt, eingebettete junge Sterne leuchten (dezent funkelnd) und beleuchten ihre Umgebung.
// A Dunkelwolke vor Rotleuchten · B Emissionsnebel (H-alpha rosa, O-III türkis) · C eisblaue Filamente.
// Rechnet in einem Worker (OffscreenCanvas) – läuft also flüssig weiter, während der Hauptfaden Shader und Texturen der
// Reise vorbereitet; ohne OffscreenCanvas auf dem Hauptfaden. Auflösung passt sich an: wird ein Bild zu langsam, rechnet
// die Schleife gröber (CSS skaliert hoch, der Nebel ist weich). User 28.10.2026: „ruhiger, weniger pixelig“ → Kamera und
// Gas langsamer, feinste Rauschstufe weg (flimmerte), Versatz der Schritte halbiert (Korn), Grundauflösung höher.

export const LOOKS = { A: 'Dunkelwolke', B: 'Emissionsnebel', C: 'Eisblaue Filamente' };

const VS = '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0, 1); }';
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT; uniform int uV;
out vec4 o;
float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
const mat3 R = mat3(.00, .80, .60, -.80, .36, -.48, -.60, -.48, .64);
float fbm(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = R * p * 2.03; a *= .5; } return s; }
float fbm6(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * noise(p); p = R * p * 2.03; a *= .5; } return s; }
float fbm3(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = R * p * 2.03; a *= .5; } return s / .875; }
float ridged(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { float r = 1. - abs(noise(p) * 2. - 1.); s += a * r * r; p = R * p * 2.03; a *= .5; } return s; }

// eingebettete Sterne: alle 6 Einheiten entlang der Flugbahn einer, seitlich versetzt
vec3 S[3];
vec3 starAt(float k) { return vec3((hash(vec3(k, 1.7, 2.3)) - .5) * 5., (hash(vec3(k, 3.1, 4.9)) - .5) * 2.6, k * 6. + 3.); }

// langsam fließendes Gas: Verschiebung aus grobem Rauschen, das mit der Zeit wandert
vec3 warp(vec3 p) {
  float t = uT * .04;
  return p + .9 * vec3(noise(p * .6 + vec3(0, 0, t)), noise(p * .6 + vec3(5.2, 1.3, -t)), noise(p * .6 + vec3(9.1, 4.7, t))) - .45;
}

// rgb = Eigenleuchten, a = Dichte (Absorption)
vec4 medium(vec3 p) {
  vec3 q = warp(p);
  float c = smoothstep(.28, .66, noise(p * .2 + 3.7));          // große Wolkenballen und Lücken
  float lit = 0.;
  for (int j = 0; j < 3; j++) { vec3 d = p - S[j]; lit += 1.6 / (1. + dot(d, d) * 2.2); }
  if (uV == 0) {
    float f = fbm(q * 1.5);
    float dust = smoothstep(.50, .66, f) * c;
    float edge = smoothstep(.44, .50, f) * (1. - smoothstep(.50, .56, f)) * c;   // von hinten beleuchteter Rand
    vec3 e = vec3(1., .62, .42) * edge * (.5 + lit * .6);
    return vec4(e, dust * 4.5);
  } else if (uV == 1) {
    float f = fbm(q * 1.8);
    float gas = smoothstep(.44, .72, f) * c;
    float o3 = smoothstep(.35, .70, noise(q * .9 + 11.));
    float dust = smoothstep(.54, .70, fbm3(q * 2.4 + 7.)) * c;
    vec3 e = mix(vec3(1., .30, .42), vec3(.25, .85, .85), o3) * gas * (.8 + lit * 1.1) + vec3(1., .9, .8) * gas * lit * .3;
    return vec4(e, gas * .7 + dust * 3.2);
  }
  float r = ridged(q * 1.3);
  float fil = pow(smoothstep(.5, .95, r), 4.) * c;
  vec3 e = mix(vec3(.5, .38, .95), vec3(.25, .82, 1.), smoothstep(.6, .9, r)) * fil * (.8 + lit * .8);
  return vec4(e, fil * .5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT;
  // Kamera: fliegt vorwärts durch das Gas, pendelt seitlich und neigt sich leicht
  vec3 ro = vec3(sin(t * .06) * .6, sin(t * .04) * .3, t * .26);
  vec3 fw = normalize(vec3(sin(t * .03) * .14, sin(t * .025) * .07, 1.));
  vec3 rt = normalize(cross(vec3(sin(t * .018) * .05, 1., 0.), fw)), up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.5 * fw);
  float k0 = floor(ro.z / 6.);
  for (int j = 0; j < 3; j++) S[j] = starAt(k0 + float(j));

  vec3 col = vec3(0); float T = 1., dt = .16;
  float s = .8 + dt * .5 * hash(vec3(gl_FragCoord.xy, 1.));        // ab 0,8 vor der Kamera (sonst riesige weiche Ballen), fester Versatz gegen Streifen
  float Ts[3] = float[3](1., 1., 1.), ts[3];
  for (int j = 0; j < 3; j++) ts[j] = dot(S[j] - ro, rd);
  for (int i = 0; i < 40; i++) {
    if (T < .03) break;
    vec4 m = medium(ro + rd * s);
    float fade = exp(-s * .14);                                     // Tiefe: Fernes wird schwächer
    float a = 1. - exp(-m.a * dt);
    col += T * m.rgb * dt * fade;
    T *= 1. - a;
    for (int j = 0; j < 3; j++) if (s < ts[j]) Ts[j] = T;
    s += dt * (1. + s * .05);
  }
  // Sterne im Nebel: heller Kern + weicher Hof, dezent funkelnd, vom Gas davor gedämpft
  for (int j = 0; j < 3; j++) {
    if (ts[j] <= 0.) continue;
    float d = length(S[j] - (ro + rd * ts[j])) / max(ts[j], .5);
    float tw = .93 + .07 * sin(t * 1.4 + float(j) * 4.1 + k0 * 1.3);
    vec3 sc = uV == 2 ? vec3(.75, .9, 1.) : vec3(1., .92, .85);
    col += Ts[j] * sc * (exp(-d * d * 9000.) * 1.6 + .0009 / (d * d + .0012) * .25) * tw * smoothstep(9., 4., ts[j]);
  }
  if (uV == 0) col += T * mix(vec3(.55, .16, .12), vec3(1., .55, .3), smoothstep(.6, .85, fbm(rd * 3. + 1.))) * smoothstep(.38, .72, fbm6(rd * 3.5 + 1.)) * 1.1;   // Glut hinter dem Staub
  float title = mix(.3, 1., smoothstep(.10, .45, length(uv * vec2(.5, 1.7))));                    // Textblock bleibt lesbar
  col *= title;
  float alpha = clamp(max(1. - T, max(col.r, max(col.g, col.b))), 0., 1.) * mix(.6, 1., title);
  o = vec4(min(col, vec3(alpha)), alpha);
}`;

function createRenderer(gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pg = gl.createProgram();
  gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { console.warn('[kosmos] Ladebild-Nebel:', gl.getProgramInfoLog(pg)); return null; }
  gl.useProgram(pg);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pg, 'uRes'), uT = gl.getUniformLocation(pg, 'uT'), uV = gl.getUniformLocation(pg, 'uV');
  return (t, look) => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(uRes, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform1i(uV, 'ABC'.indexOf(look));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// Bildschleife (Worker oder Hauptfaden): höchstens ~30 Bilder/s; dauern Bilder dauerhaft > 50 ms, wird die Auflösung in
// Stufen gröber. still = nur ein Standbild (Bewegung reduzieren)
export function animate(canvas, gl, look, cssW, cssH, raf, still) {
  const draw = createRenderer(gl);
  if (!draw) return null;
  let scale = Math.min(1, 1280 / Math.max(cssW, cssH, 1)), slow = 0, last = 0, stop = false;
  const t0 = performance.now(), T_STILL = 8;
  const size = () => { canvas.width = Math.max(2, Math.round(cssW * scale)); canvas.height = Math.max(2, Math.round(cssH * scale)); };
  size();
  function frame(now) {
    if (stop) return;
    if (last && now - last < 31) { raf(frame); return; }
    const dt = last ? now - last : 33;
    last = now;
    if (dt > 50) { if (++slow > 6 && scale > 0.4) { scale *= 0.85; size(); slow = 0; } } else slow = Math.max(0, slow - 1);
    draw((now - t0) / 1000 + 2, look);
    raf(frame);
  }
  if (still) draw(T_STILL, look); else raf(frame);
  return {
    setLook(l) { look = l; if (still) draw(T_STILL, look); },
    stop() { stop = true; },
  };
}

// Nebel im Ladebild starten: bevorzugt im Worker, sonst auf dem Hauptfaden. Ohne WebGL 2 null (dann nur Sterne)
export function createNebula(cv, look, still) {
  const r = cv.getBoundingClientRect();
  const w = r.width || window.innerWidth, h = r.height || window.innerHeight;
  if (cv.transferControlToOffscreen && typeof Worker !== 'undefined') {
    try {
      const off = cv.transferControlToOffscreen();
      const wk = new Worker(new URL('./boot_nebula_worker.js', import.meta.url), { type: 'module' });
      const fail = () => { wk.terminate(); cv.hidden = true; };
      wk.onmessage = (e) => { if (e.data && e.data.failed) fail(); };
      wk.onerror = fail;
      wk.postMessage({ canvas: off, look, w, h, still }, [off]);
      return { setLook: (l) => wk.postMessage({ look: l }), dispose: () => wk.terminate() };
    } catch (e) { /* weiter auf dem Hauptfaden */ }
  }
  const gl = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
  const loop = gl && animate(cv, gl, look, w, h, (f) => requestAnimationFrame(f), still);
  if (!loop) return null;
  return {
    setLook: loop.setLook,
    dispose() { loop.stop(); const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); },
  };
}

// Filmkorn für Look A: einmal Rauschen, das CSS danach in Sprüngen verschiebt
export function drawGrain(cv) {
  cv.width = cv.height = 256;
  const g = cv.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.random() * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
}
