// Ladebild-Hintergrund (Vorschau 28.10.2026 „Neuer Hintergrund für das Ladebild“, User wählt alle drei als Looks):
// A Nebel = Emissionsnebel mit jungem Stern und Lichtstrahlen · B Linse = tiefes Feld voller Galaxien, eine unsichtbare
// Masse biegt ihr Licht · C Lichtpunkt = Gas verdichtet sich mit dem Ladefortschritt zum blauen Lichtpunkt, mit dem der
// Auftakt-Film beginnt (Standard). Gegen „pixelig“: die Szene rechnet in reduzierter Auflösung, aber jedes Bild mit
// anderem Subpixel-Versatz (R2-Folge) und anderem Startpunkt der Schritte (Interleaved Gradient Noise) und mittelt über
// die Bilder (Akku in RGBA16F). Ausgabe in Gerätepixeln: weich hochgezogen, Sterne, Lichtpunkt, Strahlen und Korn werden
// erst dort scharf gezeichnet. Steht die Zeit (Bewegung reduzieren = Standbild), wird exakt gemittelt.
// Rechnet in einem Worker (OffscreenCanvas) – läuft also flüssig weiter, während der Hauptfaden Shader und Texturen der
// Reise vorbereitet; ohne OffscreenCanvas auf dem Hauptfaden.
// Detail (User 29.10.2026 „Qualität erhöhen, mehr Details“): Rauschen aus einer 3D-Textur statt gerechnet (ein Zugriff je
// Oktave), dadurch 5–6 Oktaven, Fäden, Staubsäume mit Schatten zum Stern und höhere Auflösung im selben Zeitrahmen;
// Ausgabe mit Catmull-Rom-Filter statt bilinear (schärfer hochgezogen).

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
float titleMask(vec2 uv, float lo) { return mix(lo, 1., smoothstep(.1, .5, length(uv * vec2(.5, 1.7)))); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

// Rauschen aus einer 3D-Textur mit 64³ Zufallswerten (4 unabhängige Kanäle, wiederholt sich nahtlos): der Bruchteil
// wird vor dem Zugriff geglättet, die Hardware interpoliert dann stetig wie Perlin-Rauschen – ein Zugriff statt ~60
// Rechenschritten je Oktave
const NOISE = `
vec4 tn(vec3 p) { vec3 i = floor(p), f = fract(p); return texture(uNoise, (i + f * f * (3. - 2. * f) + .5) / 64.) * 2. - 1.; }
float tfbm(vec3 p, int oct) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * tn(p).x; p = RM * p * 2.03; a *= .5; } return s; }
// vier unabhängige Felder in einem Durchgang (je Kanal eins) – spart Zugriffe, wo mehrere Felder dieselbe Größe haben
vec4 tfbm4(vec3 p, int oct, float gain) { vec4 s = vec4(0); float a = .5; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * tn(p); p = RM * p * 2.03; a *= gain; } return s; }
`;

// A Nebel in Kinoqualität: Volumen-Emissionsnebel (H-alpha rosa, O-III türkis), feine leuchtende Fäden, Staubbahnen mit
// Lichtsaum zum Stern hin (Schatten: Staub ein Stück Richtung Stern hält das Licht ab), dunkle Bok-Globulen, nahe am Stern
// heißeres, weißeres Gas und blauer Reflexionsnebel. Der junge Stern rechts oben fliegt mit und beleuchtet das Gas;
// a = Durchlässigkeit zum Stern hin (Lichtstrahlen in der Ausgabe)
const SCENE_A = `
vec4 mediumA(vec3 p, vec3 S, int oct) {
  float t = uT * .025;
  vec3 q = p * .5;
  vec3 w = tn(q * .6 + vec3(0, 0, t)).xyz + .5 * tn(RM * q * 1.3 + vec3(5.1, 0, -t)).xyz;
  q += .5 * w;
  float mask = smoothstep(-.45, .05, tn(p * .09 + vec3(1.3, 4., 2.)).w + .5 * tn(RM * p * .2 + 3.).w);
  if (mask < .01) return vec4(0);
  vec4 G = tfbm4(q * 2.6, oct, .6);   // feine Oktaven stärker (0,6 statt 0,5): sonst bleibt nahes Gas glatt
  // Maske verschiebt die Schwelle statt die Dichte zu verdünnen: am Rand dichte Klumpen mit Kanten statt glattem Dunst
  float cov = (1. - mask) * .45;
  float gas = smoothstep(-.12 + cov, .26 + cov * .7, G.x);
  float dust = smoothstep(.1 + cov, .2 + cov, G.y) + .45 * smoothstep(.14 + cov, .3 + cov, G.w);
  float mott = .35 + 1.3 * smoothstep(-.2, .25, G.z);
  vec3 ls = normalize(S - p);
  float light = exp(-2. * smoothstep(.1, .2, tfbm4(q * 2.6 + ls * .2, 3, .6).y) * mask);
  float rid = 1. - abs(tn(q * 5.5 + w * .8 + 3.).y + .5 * tn(RM * q * 11. + 7.).y);
  float fil = pow(clamp(rid, 0., 1.), 14.) * smoothstep(-.2 + cov, .15 + cov, G.x);
  fil += pow(1. - abs(tn(RM * q * 13. + w * 1.5 + 9.).z), 18.) * gas * .7;
  vec4 M = tfbm4(q * 1.2 + 11., 3, .5);
  float glob = smoothstep(.36, .44, M.y) * mask;
  float lane = pow(clamp(1. - abs(M.x * 2.4), 0., 1.), 7.) * mask;
  vec3 d = S - p;
  float lit = 3.6 / (1. + dot(d, d) * .25) * light;
  float o3 = smoothstep(.02, .4, M.z * 1.6);
  vec3 em = mix(vec3(1., .24, .34), vec3(1., .52, .28), smoothstep(.15, .6, w.z) * .4);
  em = mix(em, vec3(.18, .78, .85), o3 * .85);
  em = mix(em, vec3(.75, .88, 1.), smoothstep(1.2, 3., lit) * .35);
  vec3 c = em * (gas * mott * (.35 + lit) + fil * (1.4 + 2.6 * lit))
         + vec3(1., .85, .7) * gas * lit * lit * .07
         + vec3(1., .78, .6) * dust * lit * .22
         + vec3(.4, .58, 1.) * dust * lit * lit * .035;
  return vec4(c * .8, gas * .45 + dust * 2.4 + lane * 2.6 + glob * 14.);
}
vec4 scene(vec2 uv) {
  float t = uT;
  vec3 ro = vec3(sin(t * .05) * .5, sin(t * .037) * .3, t * .16);
  vec3 fw = normalize(vec3(sin(t * .031) * .08, sin(t * .023) * .05, 1.));
  vec3 rt = normalize(cross(vec3(0, 1, 0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.6 * fw);
  vec3 S = ro + rt * min(.587, .5 * uRes.x / uRes.y - .08) * 3.75 + up * 1.25 + fw * 6.;
  float ts = dot(S - ro, rd), Ts = 1.;
  vec3 col = vec3(0); float T = 1., dt = .1;
  float s = .5 + dt * fract(hash21(gl_FragCoord.xy) + uFrame * .618034);
  for (int i = 0; i < 64; i++) {
    if (T < .02) break;
    vec4 m = mediumA(ro + rd * s, S, s < 4.5 ? 6 : 4);
    float ds = dt * (1. + s * .12);
    float a = 1. - exp(-m.a * ds);
    col += T * m.rgb * ds * exp(-s * .07);
    T *= 1. - a;
    if (s < ts) Ts = T;
    s += ds;
  }
  col += T * vec3(.004, .006, .014);
  return vec4(col * titleMask(uv, .3), Ts);
}`;

// B Gravitationslinse wie im ersten Webb-Tiefenfeld: tiefes Feld voller ferner Galaxien (Spiralen mit Armen, rosa
// Sternentstehung und gelbem Kern, Ellipsen gold, Scheiben von der Kante mit Staubband, ganz ferne rote), davor ein
// Galaxienhaufen (hellste Haufengalaxie, goldene Mitglieder, Haufenlicht). Seine Masse (isotherme Kugel, leicht
// elliptisch, dazu zwei Haufengalaxien) biegt das Licht dahinter zu Bögen und Einsteinringen. Der Haufen wandert langsam
// quer durch die Bildmitte, auch hinter dem Titel durch (User 29.10.2026)
const SCENE_B = `
vec3 galaxy(vec2 f, vec2 id, float seed, float sz) {
  float h0 = hash21(id + seed + 3.), h1 = hash21(id + seed + 4.), ty = hash21(id + seed + 7.), h3 = hash21(id + seed + 8.);
  vec2 d = rot(h0 * 6.2832) * f;
  if (ty < .22) {
    d.y /= .45 + .55 * h1;
    float r = length(d) / sz;
    return vec3(1., .78, .52) * (exp(-r * r * 2.5) + .3 * exp(-sqrt(r) * 3.2));
  }
  if (ty < .3) { float r = length(d) / (sz * .55); return vec3(1., .42, .26) * exp(-r * r * 2.); }
  float e = ty < .4 ? .13 + .07 * h1 : .3 + .7 * h1;
  d.y /= e;
  float r = length(d) / sz;
  if (r > 2.4) return vec3(0);
  float arm = pow(.5 + .5 * cos(2. * atan(d.y, d.x) - (4. + 3. * h3) * log(r + .05) + h0 * 9.), 2.);
  float disk = exp(-r * 1.7) * smoothstep(2.3, .4, r);
  float knots = smoothstep(.45, .85, snoise(vec3(d / sz * 3.4, h3 * 50.))) * arm;
  float lane = 1. - (e < .5 ? .75 : 0.) * exp(-pow(d.y * e / sz / .07, 2.)) * smoothstep(.15, .6, r);
  vec3 c = vec3(.45, .62, 1.) * disk * (.3 + .95 * arm) + vec3(1., .48, .75) * knots * disk * 1.8;
  return c * lane + vec3(1., .86, .62) * exp(-r * r * 22.) * 1.1;
}
vec3 galaxies(vec2 b, float cell, float seed, float w, float thr) {
  vec2 g = b / cell, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + seed);
  if (h < thr) return vec3(0);
  vec2 off = (vec2(hash21(id + seed + 1.), hash21(id + seed + 2.)) - .5) * .3;
  float sz = .06 + .1 * pow(hash21(id + seed + 5.), 2.);
  float br = (.12 + .88 * pow(hash21(id + seed + 6.), 3.)) * w;
  return galaxy(f - off, id, seed, sz) * br;
}
// ganz ferne Galaxien: kleine rote und orange Punkte, sehr dicht
vec3 farField(vec2 b) {
  vec2 g = b / .014, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + 63.);
  if (h < .76) return vec3(0);
  vec2 q = f - (vec2(hash21(id + 64.), hash21(id + 65.)) - .5) * .5;
  float k = mix(160., 40., pow(hash21(id + 67.), 3.));
  return mix(vec3(1., .4, .25), vec3(1., .72, .5), hash21(id + 66.)) * exp(-dot(q, q) * k) * pow((h - .76) / .24, 2.) * .8;
}
// Haufen im Vordergrund (nicht gebeugt), d in Achsen der Linse
vec3 cluster(vec2 d) {
  float r = length(d * vec2(1., 1.25));
  vec3 gold = vec3(1., .8, .56);
  vec3 c = gold * (exp(-r * r * 3000.) * 1.05 + exp(-sqrt(r) * 9.5) * .5 + exp(-r * 6.) * .03);
  vec2 s1 = d - vec2(.12, .045), s2 = d - vec2(-.085, -.065);
  c += gold * (exp(-dot(s1, s1) * 9000.) + exp(-sqrt(length(s1)) * 16.) * .5) * .8;
  c += gold * (exp(-dot(s2, s2) * 11000.) + exp(-sqrt(length(s2)) * 17.) * .5) * .65;
  vec2 g = d / .045, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + 77.);
  if (h < .55 * exp(-length((id + .5) * .045) * 6.)) {
    vec2 q = rot(hash21(id + 78.) * 6.2832) * (f - (vec2(hash21(id + 79.), hash21(id + 80.)) - .5) * .4);
    q.y /= .55 + .45 * hash21(id + 81.);
    float rr = length(q) / (.06 + .07 * hash21(id + 82.));
    c += gold * (exp(-rr * rr * 3.) + .25 * exp(-rr * 1.5)) * (.35 + .65 * hash21(id + 83.)) * .7;
  }
  return c;
}
vec4 scene(vec2 uv) {
  float t = uT;
  vec2 L = vec2(min(.36, .5 * uRes.x / uRes.y - .06) * sin(t * .028 + .2), .03 * sin(t * .043 + 1.));
  mat2 R = rot(.5 + t * .006);
  vec2 d = R * (uv - L);
  float tE = mix(.11, .145, uP);
  vec2 de = d * vec2(1., 1.18);
  vec2 al = tE * de / sqrt(dot(de, de) + .0004);
  vec2 s1 = d - vec2(.12, .045), s2 = d - vec2(-.085, -.065);
  al += .0016 * s1 / (dot(s1, s1) + .00015) + .0011 * s2 / (dot(s2, s2) + .00012);
  vec2 b = uv - al * R + vec2(t * .004, t * .0015);
  vec3 c = vec3(.02, .015, .04) * smoothstep(-.2, .8, snoise(vec3(b * 1.8, 3.)))
         + vec3(0., .025, .035) * smoothstep(0., .9, snoise(vec3(b * 3.1, 7.)));
  c += galaxies(b, .24, 91., 1.5, .7) + galaxies(b, .11, 0., 1.15, .6) + galaxies(b, .055, 17., .75, .55)
     + galaxies(b, .03, 41., .45, .5) + farField(b);
  c += cluster(d);
  return vec4(c * titleMask(uv, .6), 1.);
}`;

// C Verdichtung zum Lichtpunkt: Gas und Lichtteilchen strömen spiralig zur Bildmitte; je weiter das Laden, desto enger
// die Spirale, desto heißer das Gas – bei 100 % bleibt der blaue Lichtpunkt, mit dem der Auftakt-Film beginnt. Feine
// Stromfäden entlang der Spirale, dunkle Staubbahnen dazwischen, drei Lagen Lichtteilchen
const SCENE_C = `
vec4 scene(vec2 uv) {
  float t = uT, P = uP;
  float r = length(uv) + 1e-4, a = atan(uv.y, uv.x), lr = log(r);
  float flow = t * (.12 + .3 * P);
  float a2 = a + mix(.6, 2.6, P) * lr + t * .05;
  vec2 cs = vec2(cos(a2), sin(a2));
  float g = tfbm(vec3(cs * 1.4, lr * 1.7 + flow), 6) + .3 * tn(vec3(cs * 3., lr * 3.5 + flow * 1.3) + 9.).x;
  float gas = smoothstep(-.1, .4, g);
  float fil = pow(1. - abs(tn(vec3(cs * 5., lr * 7. + flow * 1.7) + 3.).y), 9.);
  float dust = smoothstep(.05, .35, tfbm(vec3(cs * 2.2, lr * 2.6 + flow * 1.1) + 17., 4));
  float env = mix(.35, 1., P) * exp(-r * mix(1.1, 2.6, P));
  float heat = clamp(env * 1.6, 0., 1.);
  vec3 gc = mix(vec3(.26, .18, .55), vec3(.15, .55, .85), smoothstep(.1, .5, heat));
  gc = mix(gc, vec3(.75, .92, 1.), smoothstep(.55, 1., heat));
  vec3 col = gc * (gas * 1.15 + fil * (.45 + gas)) * env * (1. - .6 * dust);
  float fl = .5 + .5 * tn(vec3(uv * 3.5, t * .03) + 40.).z;
  col += (vec3(.08, .03, .06) * fl + vec3(.02, .04, .08) * (1. - fl)) * (1. - P) * .6;
  col += vec3(.15, .55, .85) * pow(.5 + .5 * sin(lr * 6. + t * .8), 12.) * .14 * P * exp(-r * 1.5);
  for (int k = 0; k < 3; k++) {
    float N = k == 0 ? 70. : k == 1 ? 110. : 170.;
    vec2 gg = vec2(a / 6.2832 * N, lr * 3. + t * (.25 + .9 * P) * (1. + float(k) * .4));
    vec2 id = floor(gg), f = fract(gg) - .5;
    id.x = mod(id.x, N);
    float h = hash21(id + float(k) * 31.);
    if (h < .78) continue;
    vec2 off = (vec2(hash21(id + 5.), hash21(id + 9.)) - .5) * .6;
    vec2 q = f - off;
    col += vec3(.7, .85, 1.) * exp(-(q.x * q.x * 260. + q.y * q.y * mix(60., 14., P))) * (h - .78) * 3.5 * smoothstep(.02, .15, r) * (.4 + .6 * P) * (k == 2 ? .6 : 1.);
  }
  float tm = titleMask(uv, .3);
  return vec4(col * tm * tm, 1.);
}`;

const SCENE_MAIN = `
void main() {
  vec2 uv = (gl_FragCoord.xy + uJit - .5 * uRes) / uRes.y;
  o = mix(texture(uPrev, gl_FragCoord.xy / uRes), scene(uv), uBlend);
}`;
const SCENE_HEAD = `#version 300 es
precision highp float; precision highp sampler3D;
uniform vec2 uRes, uJit; uniform float uT, uP, uFrame, uBlend; uniform sampler2D uPrev; uniform sampler3D uNoise;
out vec4 o;`;

const PRESENT = `#version 300 es
precision highp float;
uniform vec2 uRes, uSun; uniform float uT, uP, uFrame, uDpr; uniform int uMode; uniform sampler2D uTex;
out vec4 o;
${COMMON}
// Szene schärfer hochziehen: Catmull-Rom (9 Zugriffe, bilinear gewichtet) statt bilinear
vec4 sharp(vec2 tc) {
  vec2 ts = vec2(textureSize(uTex, 0)), sp = tc * ts, t1 = floor(sp - .5) + .5, f = sp - t1;
  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);
  vec2 w12 = w1 + w2, t0 = (t1 - 1.) / ts, t3 = (t1 + 2.) / ts, tm = (t1 + w2 / w12) / ts;
  vec4 r = (texture(uTex, vec2(t0.x, t0.y)) * w0.x + texture(uTex, vec2(tm.x, t0.y)) * w12.x + texture(uTex, vec2(t3.x, t0.y)) * w3.x) * w0.y
         + (texture(uTex, vec2(t0.x, tm.y)) * w0.x + texture(uTex, vec2(tm.x, tm.y)) * w12.x + texture(uTex, vec2(t3.x, tm.y)) * w3.x) * w12.y
         + (texture(uTex, vec2(t0.x, t3.y)) * w0.x + texture(uTex, vec2(tm.x, t3.y)) * w12.x + texture(uTex, vec2(t3.x, t3.y)) * w3.x) * w3.y;
  return max(r, 0.);
}
vec3 starLayer(vec2 uv, float cell, float seed, float bright) {
  vec2 g = uv / cell, id = floor(g), f = fract(g) - .5;
  float h = hash21(id + seed);
  if (h < .8) return vec3(0);
  vec2 off = (vec2(hash21(id + seed + 1.), hash21(id + seed + 2.)) - .5) * .7;
  float d = length(f - off) * cell * uRes.y / uDpr;
  float m = pow(hash21(id + seed + 3.), 5.) * bright * (.85 + .15 * sin(uT * (1. + h * 2.) + h * 40.));
  return mix(vec3(1., .86, .72), vec3(.72, .86, 1.), hash21(id + seed + 4.)) * m * (exp(-d * d * .9) + .06 * exp(-d * .5));
}
// Vordergrund-Sterne im Tiefenfeld (Linse) mit dem Beugungsbild des Webb-Teleskops: sechs lange Streben, zwei kurze waagrechte
vec3 spiky(vec2 uv, float px) {
  vec3 s = vec3(0);
  vec2 id0 = floor(uv / .3);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = id0 + vec2(i, j);
    float h = hash21(id + 501.);
    if (h < .72) continue;
    vec2 d = (uv - (id + .5 + (vec2(hash21(id + 502.), hash21(id + 503.)) - .5) * .7) * .3) * px;
    float m = (h - .72) / .28, r = length(d);
    float a = exp(-r * r * .12) * 2.5 + exp(-r * .22) * .2;
    for (int k = 0; k < 3; k++) {
      vec2 dir = vec2(cos(1.5708 + float(k) * 1.0472), sin(1.5708 + float(k) * 1.0472));
      a += exp(-abs(d.x * dir.y - d.y * dir.x) * 1.1) * exp(-abs(dot(d, dir)) * .04) * .5;
    }
    a += exp(-abs(d.y) * 1.6) * exp(-abs(d.x) * .1) * .18;
    s += mix(vec3(1., .88, .74), vec3(.78, .88, 1.), hash21(id + 504.)) * a * m * m;
  }
  return s;
}
// Beugungsfarben entlang einer Strebe: nahe am Stern weiß, weiter außen feine Regenbogen-Säume
vec3 spec(float x) { return mix(vec3(1.), .5 + .5 * cos(6.2832 * (x * .008 + vec3(0., .33, .67))), .35 * smoothstep(15., 90., x)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 tc = gl_FragCoord.xy / uRes;
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec4 sc = sharp(tc);
  vec3 c = sc.rgb;
  float px = uRes.y / uDpr;
  if (uMode == 0) {
    // Junger Stern (User 29.10.2026 / 30.10.2026): kleiner feiner Dot, atmet, flackert leise und fadet schneller aus,
    // kein Ausstoß-Ring; Hof und feine Spikes bleiben zentriert und zart
    vec2 sv = uv - uSun;
    float br = .5 - .5 * cos(uT * 1.6535);
    float fk = .55 * snoise(vec3(uT * 3.5, 1.7, 0.)) + .3 * snoise(vec3(uT * 8.2, 5.3, 2.)) + .15 * snoise(vec3(uT * 16.5, 9.1, 4.));
    float cy = uT / 11., ph = fract(cy);
    float fl = (.55 + .45 * hash21(vec2(floor(cy), 3.))) * smoothstep(0., .025, ph) * exp(-ph * 20.);
    float I = .8 + .26 * br + .14 * fk + .85 * fl;
    c *= 1. + (.3 * br + .8 * fl + .06 * fk) * exp(-length(sv) * 5.);
    vec2 drift = vec2(-uT * .0015, uT * .0006);
    c += sc.a * (starLayer(uv + drift, .009, 11., 1.1) + starLayer(uv + drift, .014, 1., 1.6) + starLayer(uv + drift * 1.6, .03, 7., 2.4)) * titleMask(uv, .3);
    vec2 dir = uv - uSun; float acc = 0.;
    for (int i = 0; i < 32; i++) {
      float k = (float(i) + ign(gl_FragCoord.xy)) / 32.;
      vec2 pp = uv - dir * k;
      float tr = texture(uTex, pp * vec2(uRes.y / uRes.x, 1.) + .5).a;
      acc += tr * exp(-length(pp - uSun) * 7.) * (1. - k);
    }
    c += vec3(1., .85, .68) * acc / 32. * .95 * exp(-length(dir) * 1.05) * (.7 + .3 * br + .8 * fl);
    float d = length(sv) * px;
    vec2 ds = abs(sv) * px;
    float sl = .012 / (.72 + .42 * br + .2 * fk + 1.2 * fl);
    float sx = 1. + .22 * snoise(vec3(uT * 5.5, sign(sv.x) * 4., 1.)), sy = 1. + .22 * snoise(vec3(uT * 5.0, sign(sv.y) * 4. + 9., 1.));
    vec3 spikes = (exp(-ds.y * 1.3) * exp(-ds.x * sl) * sx * spec(ds.x) + exp(-ds.x * 1.3) * exp(-ds.y * sl * 1.5) * sy * spec(ds.y)) * .36 * I;
    vec2 dr = abs(rot(.7854) * sv) * px;
    float glint = (exp(-dr.y * 1.7) * exp(-dr.x * .07) + exp(-dr.x * 1.7) * exp(-dr.y * .07)) * (.09 + .26 * max(fk, 0.) + .35 * fl);
    float halo = exp(-d * .095 / (.8 + .38 * br + .6 * fl)) * .35;
    c += vec3(1., .93, .85) * (exp(-d * d * .25) * 3. * I + halo * I + glint) + spikes;
  } else if (uMode == 1) {
    vec2 sd = uv + vec2(uT * .0008, 0.);
    c += (starLayer(sd, .016, 3., 1.) * .8 + starLayer(sd, .009, 13., .7) * .6) * titleMask(uv, .6) + spiky(sd, px);
  } else {
    float k = smoothstep(.55, 1., uP) * (uP > .99 ? .85 + .15 * sin(uT * 5.) : 1.);
    float d = length(uv) * px;
    c += vec3(.6, .85, 1.) * k * (exp(-d * d * .08) * 2.5 + exp(-d * .05) * .3 + exp(-abs(uv.y) * px * .5) * exp(-abs(uv.x) * 3.5) * .7);
    c += (starLayer(uv, .02, 5., .9) + starLayer(uv, .011, 15., .7) * .7) * (1. - uP * .6) * titleMask(uv, .3);
  }
  c = aces(c * 1.5);
  c *= 1. - .3 * pow(length((tc - .5) * vec2(1.1, 1.3)), 2.);
  c += (hash21(gl_FragCoord.xy + fract(uFrame * .1317) * 911.) - .5) * .014;
  o = vec4(c, 1.);
}`;

const MAX = { A: 0.75, B: 1, C: 0.9 };   // Anteil der Gerätepixel, in dem die Szene höchstens rechnet
const T_STILL = 12, STILL_FRAMES = 32;
// Anteil des neuen Bilds beim Mitteln in Bewegung: Nebel fährt langsam und hat feine Fäden → über ~5 Bilder mitteln
// (kein Korngitter, kein sichtbares Nachziehen); Linse und Lichtpunkt über ~3
const BLEND = { A: 0.2, B: 0.3, C: 0.3 };

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
  const sceneOf = (l) => scenes[l] || (scenes[l] = program(gl, SCENE_HEAD + COMMON + NOISE + { A: SCENE_A, B: SCENE_B, C: SCENE_C }[l] + SCENE_MAIN));
  const present = program(gl, PRESENT);
  if (!present || !sceneOf(look)) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // Rauschtextur (NOISE): 64³ × 4 Zufallsbytes aus fester Folge (xorshift), nahtlos wiederholt, auf Einheit 1
  const N = 64, rnd = new Uint8Array(N * N * N * 4);
  for (let i = 0, x = 0x9e3779b9; i < rnd.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rnd[i] = x & 255; }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, N, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, rnd);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_WRAP_R, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
  gl.activeTexture(gl.TEXTURE0);

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
    n = same ? n + 1 : Math.min(n + 1, Math.round(1 / BLEND[look]));
    lastT = t; lastP = pv;
    frame++;
    const j = [((0.5 + frame * 0.7548776662) % 1) - 0.5, ((0.5 + frame * 0.569840291) % 1) - 0.5];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(scene.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(scene.u.uPrev, 0); gl.uniform1i(scene.u.uNoise, 1);
    gl.uniform2f(scene.u.uRes, sw, sh); gl.uniform2f(scene.u.uJit, j[0], j[1]);
    gl.uniform1f(scene.u.uT, t); gl.uniform1f(scene.u.uP, pv); gl.uniform1f(scene.u.uFrame, frame % 1000);
    gl.uniform1f(scene.u.uBlend, same ? Math.max(1 / n, 0.004) : Math.max(1 / n, BLEND[look]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(present.p);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(present.u.uTex, 0);
    gl.uniform2f(present.u.uRes, W, H); gl.uniform2f(present.u.uSun, Math.min(0.587, 0.5 * W / H - 0.08), 0.333);
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
