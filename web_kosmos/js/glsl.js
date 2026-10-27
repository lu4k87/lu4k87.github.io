// Gemeinsame Shader-Bausteine: Hash, Gradientenrauschen, fBm/Grat-Rauschen, Planck-Farbe, Himmelshintergrund bei
// unendlicher Entfernung (Position = Richtung, Tiefe = Fernebene).

export const NOISE = /* glsl */ `
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Gradientenrauschen (Perlin-Art), Wertebereich etwa −1 … 1
float gnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(hash3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(hash3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(hash3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(hash3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(hash3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}
// Oktaven gegeneinander gedreht, damit kein Raster sichtbar wird
const mat3 ROT3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * gnoise(p);
    p = ROT3 * p * 2.03;
    a *= 0.5;
  }
  return s;
}
// Grat-Rauschen: feine Fäden (Filamente) an den Nulldurchgängen
float ridged(vec3 p, int oct) {
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(gnoise(p));
    n *= n * w;
    w = clamp(n * 1.6, 0.0, 1.0);
    s += a * n;
    p = ROT3 * p * 2.11;
    a *= 0.5;
  }
  return s;
}
`;

// Planck-Farbe als Näherung (Kim et al. 2002 → sRGB, siehe astro.js blackbody) für Shader: Stützstellen je 1000 K
export const BLACKBODY = /* glsl */ `
vec3 blackbodyRGB(float T) {
  T = clamp(T, 1000.0, 40000.0);
  float t = log(T / 1000.0) / log(40.0);
  vec3 c1 = vec3(1.0, 0.22, 0.0), c2 = vec3(1.0, 0.56, 0.24), c3 = vec3(1.0, 0.85, 0.72), c4 = vec3(1.0, 0.98, 0.98),
       c5 = vec3(0.78, 0.85, 1.0), c6 = vec3(0.62, 0.73, 1.0);
  if (t < 0.19) return mix(c1, c2, t / 0.19);            // 1 000 → 2 000 K
  if (t < 0.37) return mix(c2, c3, (t - 0.19) / 0.18);   // → 3 800 K
  if (t < 0.48) return mix(c3, c4, (t - 0.37) / 0.11);   // → 5 900 K
  if (t < 0.70) return mix(c4, c5, (t - 0.48) / 0.22);   // → 13 000 K
  return mix(c5, c6, (t - 0.70) / 0.30);                 // → 40 000 K
}
`;

// Himmel bei unendlicher Entfernung: nur die Drehung der Kamera zählt, Tiefe = Fernebene
export const SKY_VERTEX = /* glsl */ `
vec4 skyPosition(vec3 dir) {
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * dir, 1.0);
  return p.xyww;
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
// Hintergrundstrahlung (Station 10 und Auftakt-Film): Muster auf der Kugel als Rauschen in Oktaven ~ ℓ ≈ 10, 25, 50, 100,
// 220, 450, 900 mit Gewicht √D_ℓ (relativ zum ersten Peak, Planck 2018); k = Schärfe 0 … 1 blendet die feinen Oktaven
// nacheinander ein (Plasma wird durchsichtig), k = 1 = volles Muster. Falschfarbe wie in den Planck-Karten. Braucht NOISE.
export const CMB = /* glsl */ `
// Oktave f mit Gewicht a; blendet aus, sobald sie kleiner als ein Pixel wird (fp = Bogenmaß je Pixel), sonst Korn und
// Flimmern. w2 sammelt die Gewichte mit, ref ohne Ausblenden (für den Kontrast-Ausgleich)
float cmbOct(vec3 p, float f, float a, float fp, inout float w2, inout float ref) {
  float w = a * (1.0 - smoothstep(0.22, 0.55, f * fp));
  w2 += w * w; ref += a * a;
  return w > 0.0 ? w * gnoise(p) : 0.0;
}
float cmbField(vec3 d, float k) {
  float fp = length(fwidth(d)), w2 = 0.0, ref = 0.0;
  float s = cmbOct(d * 5.0, 5.0, 0.42, fp, w2, ref) + cmbOct(d * 12.0 + 3.1, 12.0, 0.42, fp, w2, ref) + cmbOct(d * 25.0 + 7.3, 25.0, 0.45, fp, w2, ref)
          + cmbOct(d * 50.0 + 1.7, 50.0, 0.65 * smoothstep(0.0, 0.4, k), fp, w2, ref) + cmbOct(d * 100.0 + 4.4, 100.0, smoothstep(0.15, 0.6, k), fp, w2, ref)
          + cmbOct(d * 200.0 + 9.2, 200.0, 0.7 * smoothstep(0.3, 0.8, k), fp, w2, ref) + cmbOct(d * 400.0 + 2.8, 400.0, 0.5 * smoothstep(0.5, 1.0, k), fp, w2, ref)
          + cmbOct(d * 800.0 + 5.9, 800.0, 0.32 * smoothstep(0.7, 1.0, k), fp, w2, ref);   // feinste Oktave nur aus der Nähe sichtbar
  // was an Oktaven wegfällt, halb ausgleichen, sonst wirkt die Kugel von fern flau
  return s * pow(ref / max(w2, 0.05), 0.25);
}
// ≈ ±300 µK auf ±1; mit Dipol (±3,36 mK ≙ ±1) wird die Anisotropie winzig
float cmbValue(vec3 d, float k, float dipOn, vec3 dip) {
  float x = cmbField(d, k) * 1.15;
  return dipOn > 0.5 ? x * 0.09 + dot(d, dip) : x;
}
vec3 cmbColor(float x) {
  x = clamp(x * 0.5 + 0.5, 0.0, 1.0);
  vec3 c0 = vec3(0.0, 0.03, 0.35), c1 = vec3(0.0, 0.55, 1.0), c2 = vec3(1.0, 0.97, 0.85), c3 = vec3(1.0, 0.5, 0.0), c4 = vec3(0.6, 0.0, 0.0);
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
  if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
  return mix(c3, c4, (x - 0.75) / 0.25);
}
`;
