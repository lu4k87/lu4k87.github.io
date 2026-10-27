// Nebel im Ladebild (Vorschau 27.10.2026 „Ladebild: Nebelwolken und Kamera-Idle“, alle drei Looks wählbar):
// A Dunkelwolke vor Rotleuchten · B Emissionsnebel in der Hubble-Palette · C eisblaue Filamente.
// Einmal je Look per WebGL 2 gerechnet (Domain-Warp-fbm, 8 Oktaven) und in zwei 2D-Ebenen kopiert: Leuchten (über die
// Sterne geblendet) und Staub (schwarz mit Alpha, verdeckt Sterne). Die Kamera bewegt danach nur diese fertigen Ebenen
// per CSS-transform – das läuft weiter, während der Hauptfaden Shader und Texturen der Reise vorbereitet.

export const LOOKS = { A: 'Dunkelwolke', B: 'Emissionsnebel', C: 'Eisblaue Filamente' };

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform int uV; uniform int uPass;
out vec4 o;
// Hash auf gewrapptem Gitter (mod 289): bleibt bei hohen Oktaven präzise, keine Dreiecks-Artefakte
float h(vec2 p) { p = mod(p, 289.); vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 8; i++) { s += a * n(p); p = M * p + 17.3; a *= .5; } return s; }
float ridge(vec2 p) { float s = 0., a = .5, w = 1.; for (int i = 0; i < 7; i++) { float r = 1. - abs(n(p) * 2. - 1.); r *= r; s += a * r * w; w = clamp(r * 1.6, 0., 1.); p = M * p + 17.3; a *= .5; } return s; }
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float title = mix(.25, 1., smoothstep(.10, .45, length(uv * vec2(.5, 1.7))));   // Textblock in der Mitte bleibt dunkel
  vec2 p = uv * 1.7 + (uV == 0 ? vec2(3.1, 1.7) : uV == 1 ? vec2(7.4, 2.2) : vec2(1.3, 4.6));
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + 4. * q + vec2(1.7, 9.2)), fbm(p + 4. * q + vec2(8.3, 2.8)));
  float f = fbm(p + 3.5 * r);
  // zwei Wolkenzentren: oben rechts groß, unten links klein; außen bleibt schwarzer Himmel
  float m = 1. - smoothstep(0., .95, length((uv - vec2(.48, .22)) * vec2(.8, 1.))) + .55 * (1. - smoothstep(0., .6, length(uv - vec2(-.72, -.34))));
  vec3 col = vec3(0); float a = 0.;
  if (uV == 0) {
    float back = smoothstep(.35, .8, f) * m;
    float dust = smoothstep(.55, .72, fbm(p * 1.2 + r * 2.2 + 3.)) * m;
    float rim = dust * (1. - dust) * 4. * back;
    if (uPass == 0) col = (vec3(.62, .26, .22) * back * .30 + vec3(1., .78, .6) * rim * .16 + vec3(.35, .4, .55) * pow(f, 3.) * m * .12) * title;
    else a = clamp(dust * .9, 0., .9);
  } else if (uV == 1) {
    float ha = smoothstep(.38, .9, f);
    float o3 = smoothstep(.45, .95, fbm(p * 1.3 + q * 1.8 + 7.));
    float fr = pow(ridge(p * 1.3 + r * 1.4), 4.);
    float dust = smoothstep(.56, .74, fbm(p * 1.1 + r * 2.4 + 3.)) * m;
    if (uPass == 0) col = (vec3(.95, .34, .46) * ha * .42 + vec3(.25, .78, .78) * o3 * .34 + vec3(1., .88, .78) * fr * ha * .5) * m * title;
    else a = clamp(dust * .85, 0., .85);
  } else {
    float rg = ridge(p * 1.15 + 1.7 * q);
    float fil = pow(rg, 3.5), knot = pow(rg, 9.) * 1.6, haze = smoothstep(.3, .9, f) * .35;
    vec3 ice = vec3(.20, .80, 1.), vio = vec3(.50, .38, .95);
    if (uPass == 0) col = (mix(vio, ice, smoothstep(.35, .85, rg)) * fil * .55 + vec3(.85, .95, 1.) * knot * .5 + vio * haze * .3) * m * title;
    else a = clamp(smoothstep(.58, .78, fbm(p * 1.3 + q * 2.)) * m * .5, 0., .6);
  }
  o = uPass == 0 ? vec4(col * 2.6, 1.) : vec4(0., 0., 0., a);
}`;

// Ein GL-Kontext für alle Looks (Wechsel per Knopf), nach dem Ladebild freigeben (dispose), damit die Reise ihn nicht
// mitträgt. Ohne WebGL 2 bleibt nur der Sternhimmel.
export function createNebula() {
  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pg = gl.createProgram();
  gl.attachShader(pg, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0, 1); }'));
  gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { console.warn('[kosmos] Ladebild-Nebel:', gl.getProgramInfoLog(pg)); return null; }
  gl.useProgram(pg);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pg, 'uRes'), uV = gl.getUniformLocation(pg, 'uV'), uPass = gl.getUniformLocation(pg, 'uPass');

  return {
    // look 'A' | 'B' | 'C' in die beiden 2D-Ebenen zeichnen (Größe = Ebenen-Größe in Gerätepixeln)
    draw(look, glow, dust) {
      cv.width = glow.width; cv.height = glow.height;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1i(uV, 'ABC'.indexOf(look));
      [glow, dust].forEach((dst, pass) => {
        gl.uniform1i(uPass, pass);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const g = dst.getContext('2d');
        g.clearRect(0, 0, dst.width, dst.height);
        g.drawImage(cv, 0, 0);
      });
    },
    dispose() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); },
  };
}

// Filmkorn für Look A: einmal Rauschen, das CSS danach in Sprüngen verschiebt
export function drawGrain(cv) {
  cv.width = cv.height = 256;
  const g = cv.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.random() * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
}
