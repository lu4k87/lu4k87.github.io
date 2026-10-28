// Ladebild-Hintergrund (Vorschau 28.10.2026 „Neuer Hintergrund für das Ladebild“, User wählt alle drei als Looks):
// A Nebel = Emissionsnebel mit jungem Stern und Lichtstrahlen · B Linse = tiefes Feld voller Galaxien, eine unsichtbare
// Masse biegt ihr Licht · C Lichtpunkt = Gas verdichtet sich mit dem Ladefortschritt zum blauen Lichtpunkt, mit dem der
// Auftakt-Film beginnt (Standard). Gegen „pixelig“: die Szene rechnet in reduzierter Auflösung, aber jedes Bild mit
// anderem Subpixel-Versatz (R2-Folge) und anderem Startpunkt der Schritte (Interleaved Gradient Noise) und mittelt über
// die Bilder (Akku in RGBA16F). Ausgabe in Gerätepixeln: weich hochgezogen, Sterne, Lichtpunkt, Strahlen und Korn werden
// erst dort scharf gezeichnet. Steht die Zeit (Bewegung reduzieren = Standbild), wird exakt gemittelt.
// Rechnet in einem Worker (OffscreenCanvas) – läuft also flüssig weiter, während der Hauptfaden Shader und Texturen der
// Reise vorbereitet; ohne OffscreenCanvas auf dem Hauptfaden.

export const LOOKS = { A: 'Nebel', B: 'Linse', C: 'Lichtpunkt' };

const VS = '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0, 1); }';

const COMMON = `
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
vec3 mod289(vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec4 mod289(vec4 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec4 permute(vec4 x) { return mod289(((x * 34.) + 10.) * x); }
float snoise(vec3 v) {
  const vec2 C = vec2(1. / 6., 1. / 3.); const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1. - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  vec3 ns = .142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2. + 1.; vec4 s1 = floor(b1) * 2. + 1.; vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 nr = 1.79284291400159 - .85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
  p0 *= nr.x; p1 *= nr.y; p2 *= nr.z; p3 *= nr.w;
  vec4 m = max(.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.); m = m * m;
  return 105. * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
const mat3 RM = mat3(.00, .80, .60, -.80, .36, -.48, -.60, -.48, .64);
float fbm4(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * snoise(p); p = RM * p * 2.02; a *= .5; } return s; }
float fbm3(vec3 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * snoise(p); p = RM * p * 2.02; a *= .5; } return s; }
float titleMask(vec2 uv) { return mix(.3, 1., smoothstep(.1, .5, length(uv * vec2(.5, 1.7)))); }
`;

// A Nebel in Kinoqualität: Volumen-Emissionsnebel (H-alpha rosa, O-III türkis, Staubbahnen), ein junger Stern rechts oben
// fliegt mit und beleuchtet das Gas; a = Durchlässigkeit zum Stern hin (Lichtstrahlen in der Ausgabe)
const SCENE_A = `
vec4 mediumA(vec3 p, vec3 S) {
  float t = uT * .025;
  vec3 q = p * .42;
  q += .55 * vec3(snoise(q * .7 + vec3(0, 0, t)), snoise(q * .7 + vec3(7.3, 2.1, -t)), snoise(q * .7 + vec3(3.7, 9.2, t)));
  float mask = smoothstep(-.45, .35, snoise(p * .09 + vec3(1.3, 4., 2.)));
  if (mask < .01) return vec4(0);
  float gas = smoothstep(-.08, .5, fbm4(q * 2.1)) * mask;
  float dust = smoothstep(.05, .45, fbm3(q * 3.2 + 5.)) * mask;
  vec3 d = S - p;
  float lit = 3.2 / (1. + dot(d, d) * .3);
  float o3 = smoothstep(-.4, .5, snoise(q * .5 + 20.));
  vec3 em = mix(vec3(1., .26, .36), vec3(.18, .78, .85), o3 * .85);
  return vec4((em * gas * (.3 + lit) + vec3(1., .85, .7) * gas * lit * lit * .07) * .5, gas * .8 + dust * 2.8);
}
vec4 scene(vec2 uv) {
  float t = uT;
  vec3 ro = vec3(sin(t * .05) * .5, sin(t * .037) * .3, t * .16);
  vec3 fw = normalize(vec3(sin(t * .031) * .08, sin(t * .023) * .05, 1.));
  vec3 rt = normalize(cross(vec3(0, 1, 0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.6 * fw);
  vec3 S = ro + rt * 2.2 + up * 1.25 + fw * 6.;
  float ts = dot(S - ro, rd), Ts = 1.;
  vec3 col = vec3(0); float T = 1., dt = .2;
  float s = .6 + dt * fract(ign(gl_FragCoord.xy) + uFrame * .618034);
  for (int i = 0; i < 44; i++) {
    if (T < .02) break;
    vec4 m = mediumA(ro + rd * s, S);
    float a = 1. - exp(-m.a * dt);
    col += T * m.rgb * dt * exp(-s * .07);
    T *= 1. - a;
    if (s < ts) Ts = T;
    s += dt * (1. + s * .04);
  }
  col += T * vec3(.004, .006, .014);
  return vec4(col * titleMask(uv), Ts);
}`;

// B Gravitationslinse: tiefes Feld voller ferner Galaxien (Spiralen blau, Ellipsen gold), eine unsichtbare Masse
// (Galaxienhaufen) wandert oben durch das Bild und biegt das Licht zu Bögen und Einsteinringen
const SCENE_B = `
vec3 galaxies(vec2 b, float cell, float seed, float w, float thr) {
  vec2 g = b / cell, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + seed);
  if (h < thr) return vec3(0);
  vec2 off = (vec2(hash21(id + seed + 1.), hash21(id + seed + 2.)) - .5) * .5;
  float ang = hash21(id + seed + 3.) * 6.2832, e = .25 + .7 * hash21(id + seed + 4.);
  float sz = .07 + .13 * pow(hash21(id + seed + 5.), 2.);
  vec2 d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (f - off);
  d.y /= e;
  float r = length(d) / sz;
  float br = (.12 + .88 * pow(hash21(id + seed + 6.), 3.)) * w;
  if (hash21(id + seed + 7.) < .25) return vec3(1., .78, .52) * br * (exp(-r * r * 2.5) + .25 * exp(-r * 1.4));
  float arm = .55 + .45 * cos(2. * atan(d.y, d.x) - 5. * log(r + .05));
  return (vec3(.5, .68, 1.) * exp(-r * 1.8) * arm * smoothstep(1.6, .3, r) + vec3(1., .85, .6) * exp(-r * r * 30.) * .9) * br;
}
vec4 scene(vec2 uv) {
  float t = uT;
  vec2 L = vec2(.5 * sin(t * .035), .27 + .05 * sin(t * .05 + 1.));
  float tE = mix(.13, .2, uP);
  vec2 d = uv - L; float r2 = dot(d, d) + .0004;
  vec2 b = uv - tE * tE * d / r2 + vec2(t * .004, t * .0015);
  vec3 c = vec3(.025, .018, .045) * smoothstep(-.2, .8, snoise(vec3(b * 1.8, 3.)))
         + vec3(0., .03, .04) * smoothstep(0., .9, snoise(vec3(b * 3.1, 7.)));
  c += galaxies(b, .11, 0., 1.3, .62) + galaxies(b, .055, 17., .7, .58) + galaxies(b, .03, 41., .4, .5);
  float dl = sqrt(r2);
  c += vec3(1., .78, .5) * (exp(-dl * 22.) * .5 + exp(-dl * 5.) * .05);
  return vec4(c * titleMask(uv), 1.);
}`;

// C Verdichtung zum Lichtpunkt: Gas und Lichtteilchen strömen spiralig zur Bildmitte; je weiter das Laden, desto enger
// die Spirale, desto heißer das Gas – bei 100 % bleibt der blaue Lichtpunkt, mit dem der Auftakt-Film beginnt
const SCENE_C = `
vec4 scene(vec2 uv) {
  float t = uT, P = uP;
  float r = length(uv) + 1e-4, a = atan(uv.y, uv.x), lr = log(r);
  float flow = t * (.12 + .3 * P);
  float a2 = a + mix(.6, 2.6, P) * lr + t * .05;
  vec3 np = vec3(cos(a2) * 1.4, sin(a2) * 1.4, lr * 1.7 + flow);
  float gas = smoothstep(-.15, .7, fbm4(np) + .25 * snoise(vec3(cos(a2) * 3., sin(a2) * 3., lr * 3.5 + flow * 1.3)));
  float env = mix(.35, 1., P) * exp(-r * mix(1.1, 2.6, P));
  float heat = clamp(env * 1.6, 0., 1.);
  vec3 gc = mix(vec3(.26, .18, .55), vec3(.15, .55, .85), smoothstep(.1, .5, heat));
  gc = mix(gc, vec3(.75, .92, 1.), smoothstep(.55, 1., heat));
  vec3 col = gc * gas * env * 1.2;
  float fl = .5 + .5 * snoise(vec3(uv * 3.5, t * .03));
  col += (vec3(.08, .03, .06) * fl + vec3(.02, .04, .08) * (1. - fl)) * (1. - P) * .6;
  col += vec3(.15, .55, .85) * pow(.5 + .5 * sin(lr * 6. + t * .8), 12.) * .14 * P * exp(-r * 1.5);
  for (int k = 0; k < 2; k++) {
    float N = k == 0 ? 70. : 110.;
    vec2 g = vec2(a / 6.2832 * N, lr * 3. + t * (.25 + .9 * P) * (1. + float(k) * .4));
    vec2 id = floor(g), f = fract(g) - .5;
    id.x = mod(id.x, N);
    float h = hash21(id + float(k) * 31.);
    if (h < .78) continue;
    vec2 off = (vec2(hash21(id + 5.), hash21(id + 9.)) - .5) * .6;
    vec2 q = f - off;
    col += vec3(.7, .85, 1.) * exp(-(q.x * q.x * 260. + q.y * q.y * mix(60., 14., P))) * (h - .78) * 3.5 * smoothstep(.02, .15, r) * (.4 + .6 * P);
  }
  float tm = titleMask(uv);
  return vec4(col * tm * tm, 1.);
}`;

const SCENE_MAIN = `
void main() {
  vec2 uv = (gl_FragCoord.xy + uJit - .5 * uRes) / uRes.y;
  o = mix(texture(uPrev, gl_FragCoord.xy / uRes), scene(uv), uBlend);
}`;
const SCENE_HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes, uJit; uniform float uT, uP, uFrame, uBlend; uniform sampler2D uPrev;
out vec4 o;`;

const PRESENT = `#version 300 es
precision highp float;
uniform vec2 uRes, uSun; uniform float uT, uP, uFrame, uDpr; uniform int uMode; uniform sampler2D uTex;
out vec4 o;
${COMMON}
vec3 starLayer(vec2 uv, float cell, float seed, float bright) {
  vec2 g = uv / cell, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + seed);
  if (h < .8) return vec3(0);
  vec2 off = (vec2(hash21(id + seed + 1.), hash21(id + seed + 2.)) - .5) * .7;
  float d = length(f - off) * cell * uRes.y / uDpr;
  float m = pow(hash21(id + seed + 3.), 5.) * bright * (.85 + .15 * sin(uT * (1. + h * 2.) + h * 40.));
  return mix(vec3(1., .86, .72), vec3(.72, .86, 1.), hash21(id + seed + 4.)) * m * (exp(-d * d * .9) + .06 * exp(-d * .5));
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 tc = gl_FragCoord.xy / uRes;
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec4 sc = texture(uTex, tc);
  vec3 c = sc.rgb;
  float px = uRes.y / uDpr;
  if (uMode == 0) {
    vec2 drift = vec2(-uT * .0015, uT * .0006);
    c += sc.a * (starLayer(uv + drift, .014, 1., 1.6) + starLayer(uv + drift * 1.6, .03, 7., 2.4)) * titleMask(uv);
    vec2 dir = uv - uSun; float acc = 0.;
    for (int i = 0; i < 32; i++) {
      float k = (float(i) + ign(gl_FragCoord.xy)) / 32.;
      vec2 pp = uv - dir * k;
      float tr = texture(uTex, pp * vec2(uRes.y / uRes.x, 1.) + .5).a;
      acc += tr * exp(-length(pp - uSun) * 7.) * (1. - k);
    }
    c += vec3(1., .82, .66) * acc / 32. * .9 * exp(-length(dir) * 1.1);
    float d = length(uv - uSun) * px;
    vec2 ds = abs(uv - uSun) * px;
    c += vec3(1., .93, .85) * (exp(-d * d * .05) * 3. + exp(-d * .045) * .35 + (exp(-ds.y * .9) * exp(-ds.x * .012) + exp(-ds.x * .9) * exp(-ds.y * .02)) * .35);
  } else if (uMode == 1) {
    c += starLayer(uv + vec2(uT * .0008, 0.), .016, 3., 1.) * .8 * titleMask(uv);
  } else {
    float k = smoothstep(.55, 1., uP) * (uP > .99 ? .85 + .15 * sin(uT * 5.) : 1.);
    float d = length(uv) * px;
    c += vec3(.6, .85, 1.) * k * (exp(-d * d * .08) * 2.5 + exp(-d * .05) * .3 + exp(-abs(uv.y) * px * .5) * exp(-abs(uv.x) * 3.5) * .7);
    c += starLayer(uv, .02, 5., .9) * (1. - uP * .6) * titleMask(uv);
  }
  c = aces(c * 1.5);
  c *= 1. - .3 * pow(length((tc - .5) * vec2(1.1, 1.3)), 2.);
  c += (hash21(gl_FragCoord.xy + fract(uFrame * .1317) * 911.) - .5) * .014;
  o = vec4(c, 1.);
}`;

const MAX = { A: 0.6, B: 0.85, C: 0.75 };   // Anteil der Gerätepixel, in dem die Szene höchstens rechnet
const T_STILL = 12, STILL_FRAMES = 32;

function program(gl, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[kosmos] Ladebild:', gl.getProgramInfoLog(p)); return null; }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

// Bildschleife (Worker oder Hauptfaden). p = Ladefortschritt 0…1 (B und C hängen davon ab), läuft weich nach.
// still = Standbild: feste Zeit, nach STILL_FRAMES gemittelten Bildern Ruhe bis zur nächsten Änderung
export function animate(canvas, gl, { look, w, h, dpr, still }, raf) {
  const float = !!gl.getExtension('EXT_color_buffer_float');
  const scenes = {};
  const sceneOf = (l) => scenes[l] || (scenes[l] = program(gl, SCENE_HEAD + COMMON + { A: SCENE_A, B: SCENE_B, C: SCENE_C }[l] + SCENE_MAIN));
  const present = program(gl, PRESENT);
  if (!present || !sceneOf(look)) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let W = 0, H = 0, sw = 0, sh = 0, scale = MAX[look];
  let tex = [], fbo = [], cur = 0, n = 0, frame = 0, lastT = -1, lastP = -1, lastNow = 0, ema = 16, check = 0;
  let p = 0, pv = 0, stop = false, idle = true;
  const t0 = performance.now();
  function alloc() {
    W = canvas.width = Math.max(2, Math.round(w * dpr)); H = canvas.height = Math.max(2, Math.round(h * dpr));
    sw = Math.max(2, Math.round(W * scale)); sh = Math.max(2, Math.round(H * scale));
    for (let i = 0; i < 2; i++) {
      if (tex[i]) { gl.deleteTexture(tex[i]); gl.deleteFramebuffer(fbo[i]); }
      tex[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, sw, sh, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbo[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[i], 0);
    }
    n = 0;
  }

  function draw(now) {
    const scene = sceneOf(look);
    const t = still ? T_STILL : (now - t0) / 1000 + 4;
    if (lastNow) {
      const dt = now - lastNow;
      ema += (dt - ema) * 0.05;
      pv = still ? p : pv + (p - pv) * (1 - Math.exp(-Math.min(dt, 250) / 600));
    }
    lastNow = now;
    // Auflösung nachführen: dauerhaft langsam → gröber (Mittelung glättet), viel Luft → feiner
    if (!still && ++check > 90) {
      check = 0;
      if (ema > 40 && scale > 0.3) { scale *= 0.85; alloc(); } else if (ema < 20 && scale < MAX[look]) { scale = Math.min(MAX[look], scale * 1.1); alloc(); }
    }
    const same = t === lastT && pv === lastP;
    n = same ? n + 1 : Math.min(n + 1, 3);
    lastT = t; lastP = pv;
    frame++;
    const j = [((0.5 + frame * 0.7548776662) % 1) - 0.5, ((0.5 + frame * 0.569840291) % 1) - 0.5];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(scene.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(scene.u.uPrev, 0);
    gl.uniform2f(scene.u.uRes, sw, sh); gl.uniform2f(scene.u.uJit, j[0], j[1]);
    gl.uniform1f(scene.u.uT, t); gl.uniform1f(scene.u.uP, pv); gl.uniform1f(scene.u.uFrame, frame % 1000);
    gl.uniform1f(scene.u.uBlend, same ? Math.max(1 / n, 0.004) : Math.max(1 / n, 0.3));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(present.p);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(present.u.uTex, 0);
    gl.uniform2f(present.u.uRes, W, H); gl.uniform2f(present.u.uSun, 0.587, 0.333);
    gl.uniform1f(present.u.uT, t); gl.uniform1f(present.u.uP, pv); gl.uniform1f(present.u.uFrame, frame % 1000);
    gl.uniform1f(present.u.uDpr, dpr); gl.uniform1i(present.u.uMode, 'ABC'.indexOf(look));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    if (stop) return;
    draw(now);
    if (still && n >= STILL_FRAMES) { idle = true; return; }
    raf(loop);
  }
  const kick = () => { if (idle) { idle = false; raf(loop); } };
  alloc();
  kick();
  return {
    setLook(l) { if (l === look || !sceneOf(l)) return; look = l; scale = Math.min(scale, MAX[l]); alloc(); kick(); },
    setP(v) { p = v; kick(); },
    resize(nw, nh) { w = nw; h = nh; alloc(); kick(); },
    stop() { stop = true; },
  };
}

// Ladebild-Hintergrund starten: bevorzugt im Worker, sonst auf dem Hauptfaden. Ohne WebGL 2 null (dann bleibt es schwarz)
export function createNebula(cv, look, still) {
  const opts = { look, still, w: window.innerWidth, h: window.innerHeight, dpr: Math.min(2, window.devicePixelRatio || 1) };
  let ctl = null;
  if (cv.transferControlToOffscreen && typeof Worker !== 'undefined') {
    try {
      const off = cv.transferControlToOffscreen();
      const wk = new Worker(new URL('./boot_nebula_worker.js', import.meta.url), { type: 'module' });
      const fail = () => { wk.terminate(); cv.hidden = true; };
      wk.onmessage = (e) => { if (e.data && e.data.failed) fail(); };
      wk.onerror = fail;
      wk.postMessage({ canvas: off, ...opts }, [off]);
      ctl = {
        setLook: (l) => wk.postMessage({ look: l }),
        setP: (p) => wk.postMessage({ p }),
        resize: (w, h) => wk.postMessage({ w, h }),
        stop: () => wk.terminate(),
      };
    } catch (e) { /* weiter auf dem Hauptfaden */ }
  }
  if (!ctl) {
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false });
    const loop = gl && animate(cv, gl, opts, (f) => requestAnimationFrame(f));
    if (!loop) return null;
    ctl = { ...loop, stop() { loop.stop(); const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } };
  }
  const onResize = () => ctl.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', onResize);
  return {
    setLook: ctl.setLook,
    setP: ctl.setP,
    dispose() { window.removeEventListener('resize', onResize); ctl.stop(); },
  };
}
