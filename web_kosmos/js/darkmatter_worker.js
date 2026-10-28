// Worker der Station 05A: Anfangsfeld + Halos (darkmatter.js makeField) außerhalb des Hauptfadens, ≈ 1,5 s bei 128³
import { makeField } from './darkmatter.js';

self.onmessage = (e) => {
  const f = makeField(e.data);
  self.postMessage(f, [f.psi.buffer]);
};
