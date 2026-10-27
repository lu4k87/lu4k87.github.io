// Worker für den Ladebild-Nebel (boot_nebula.js): rechnet den Volumennebel auf einem OffscreenCanvas, unabhängig vom
// Hauptfaden, der beim Laden Shader und Texturen der Reise vorbereitet.
import { animate } from './boot_nebula.js';

let loop = null;
self.onmessage = ({ data }) => {
  if (data.canvas) {
    const gl = data.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
    const raf = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 33);
    loop = gl && animate(data.canvas, gl, data.look, data.w, data.h, raf, data.still);
    if (!loop) self.postMessage({ failed: true });
  } else if (data.look && loop) loop.setLook(data.look);
};
