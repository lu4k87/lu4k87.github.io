// Worker für den Ladebild-Hintergrund (boot_nebula.js): rechnet Szene und Ausgabe auf einem OffscreenCanvas, unabhängig
// vom Hauptfaden, der beim Laden Shader und Texturen der Reise vorbereitet.
import { animate } from './boot_nebula.js';

let loop = null;
self.onmessage = ({ data }) => {
  if (data.canvas) {
    const gl = data.canvas.getContext('webgl2', { antialias: false, alpha: false });
    const raf = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
    loop = gl && animate(data.canvas, gl, data, raf);
    if (!loop) self.postMessage({ failed: true });
  } else if (!loop) return;
  else if (data.look) loop.setLook(data.look);
  else if ('p' in data) loop.setP(data.p);
  else if (data.w) loop.resize(data.w, data.h);
};
