// Grafikkarte grob einordnen und daraus die Startstufe der Auto-Qualität schätzen – ohne three.js, damit `npm test`
// es prüfen kann (tests/gpu.test.js). Name = WEBGL_debug_renderer_info, z. B. „ANGLE (Intel, Mesa Intel(R) UHD Graphics
// 620 (KBL GT2), OpenGL 4.6)“ oder „ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 …)“.

// soft = ohne GPU (Software-Rendering) · igpu = Grafik im Prozessor (Laptops ohne eigene Grafikkarte, Handys)
// · dgpu = eigene Grafikkarte · '' = unbekannt (verdeckter Name, Apple M, Konsolen …) → Mitte, Auto misst nach
const SOFT = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i;
// Intel Arc mit Modellnummer (A380, A770, B580, A370M) ist eine eigene Karte, „Intel Arc Graphics“ (Core Ultra) nicht
const DGPU = /nvidia|geforce|quadro|tesla|\brtx\b|\bgtx\b|radeon\s*(\(tm\)\s*)?(rx|pro|r9|r7|hd\s*[5-9]\d{3})|firepro|arc\s*(\(tm\)\s*)?[ab]\d{3}/i;
// AMD-APU: „Radeon(TM) Graphics“, „Radeon Vega 8 Graphics“, „Radeon 780M“; Handy-/ARM-Grafik; Intel ohne eigene Karte
const IGPU = /intel|iris|mali|adreno|powervr|videocore|radeon\s*(\(tm\)\s*)?(vega\s*\d*\s*)?graphics|radeon\s*(\(tm\)\s*)?\d{3}m\b/i;

export function gpuClass(name) {
  const s = String(name || '');
  if (SOFT.test(s)) return 'soft';
  if (DGPU.test(s)) return 'dgpu';
  if (IGPU.test(s)) return 'igpu';
  return '';
}

// Startstufe 1 Niedrig · 2 Mittel · 3 Hoch. hw = { mem: GB (navigator.deviceMemory), cores, maxTex }.
// Niedrig: ohne GPU, Grafik im Prozessor, wenig Speicher/Kerne, kleine Texturgrenze (4k-Erdkarten, beim Start nur eine
// Station). Hoch: eigene Grafikkarte mit 16k-Texturen (16k-Erdkarten). Sonst Mittel.
export function guessTier(name, hw = {}) {
  const cls = gpuClass(name);
  const mem = hw.mem || 8, cores = hw.cores || 8, maxTex = hw.maxTex || 16384;
  if (cls === 'soft' || cls === 'igpu' || mem <= 4 || cores <= 4 || maxTex < 8192) return { cls, q: 1 };
  if (cls === 'dgpu' && maxTex >= 16384) return { cls, q: 3 };
  return { cls, q: 2 };
}
