// Größenvergleich für die Infotafel (Optik & Didaktik: Info:A)
// Maßstabsgetreue Silhouetten und Vergleiche für alle 31 Stationen in Kosmos.
// Radien nach JPL Fact Sheets, NASA NSSDCA und IAU WGCCRE 2015.

import { nbsp } from './figs.js';

export const SCALE_COMPARISONS = {
  iss: {
    sizeStr: '108 m Spannweite',
    tabs: [
      {
        name: 'Mensch & Bauten',
        items: [
          { name: 'ISS', size: '108 m', r: 42, color: 'linear-gradient(135deg, #33ccff, #1a7599)', type: 'iss' },
          { name: 'Fußballfeld', size: '105 m', r: 41, color: 'linear-gradient(135deg, #38bdf8, #0369a1)', type: 'field' },
          { name: 'Boeing 747', size: '71 m', r: 28, color: 'linear-gradient(135deg, #94a3b8, #475569)', type: 'plane' },
        ],
        note: 'Die ISS ist so lang wie ein Fußballfeld und das größte je von Menschen gebaute Objekt im Weltraum.',
      },
      {
        name: 'vs. Tiangong',
        items: [
          { name: 'ISS', size: '108 m (450 t)', r: 44, color: 'linear-gradient(135deg, #33ccff, #1a7599)', type: 'iss' },
          { name: 'Tiangong', size: '55 m (90 t)', r: 24, color: 'linear-gradient(135deg, #fbbf24, #b45309)', type: 'tg' },
        ],
        note: 'Die chinesische Station Tiangong hat etwa die halbe Spannweite und ein Fünftel der Masse der ISS.',
      },
    ],
  },
  tiangong: {
    sizeStr: '55 m Spannweite',
    tabs: [
      {
        name: 'vs. ISS & Flugzeuge',
        items: [
          { name: 'Tiangong', size: '55 m', r: 30, color: 'linear-gradient(135deg, #fbbf24, #b45309)', type: 'tg' },
          { name: 'Boeing 737', size: '36 m', r: 20, color: 'linear-gradient(135deg, #94a3b8, #475569)', type: 'plane' },
          { name: 'ISS', size: '108 m', r: 52, color: 'linear-gradient(135deg, #33ccff, #1a7599)', type: 'iss' },
        ],
        note: 'Wentians Solarflügel überspannen 55 Meter – mehr als die Spannweite eines Passagierflugzeugs.',
      },
    ],
  },
  earth: {
    sizeStr: 'Ø 12.742 km',
    tabs: [
      {
        name: 'Erde & Monde',
        items: [
          { name: 'Erde', size: '12.742 km', r: 46, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
          { name: 'Mond', size: '3.474 km', r: 13, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Die Erde hat den 3,7-fachen Durchmesser und fasst 50-mal das Volumen des Mondes.',
      },
      {
        name: 'Innere Planeten',
        items: [
          { name: 'Erde', size: '12.742 km', r: 42, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
          { name: 'Venus', size: '12.104 km', r: 40, color: 'radial-gradient(circle at 35% 35%, #fde68a, #d97706)', type: 'globe' },
          { name: 'Mars', size: '6.779 km', r: 22, color: 'radial-gradient(circle at 35% 35%, #f87171, #991b1b)', type: 'globe' },
        ],
        note: 'Venus ist fast eine Zwillingsschwester der Erde (95 % des Durchmessers), Mars dagegen nur etwa halb so groß.',
      },
      {
        name: 'vs. Jupiter',
        items: [
          { name: 'Erde', size: '12.742 km', r: 10, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
          { name: 'Jupiter', size: '139.820 km', r: 54, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #c2410c)', type: 'globe' },
        ],
        note: 'Jupiter ist elfmal breiter als die Erde; mehr als 1.300 Erdkugeln würden in sein Inneres passen.',
      },
    ],
  },
  moon: {
    sizeStr: 'Ø 3.474 km',
    tabs: [
      {
        name: 'Mond vs. Erde',
        items: [
          { name: 'Mond', size: '3.474 km', r: 16, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 48, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Der Monddurchmesser entspricht ungefähr der Breite des australischen Kontinents.',
      },
      {
        name: 'Große Eismonde',
        items: [
          { name: 'Ganymed', size: '5.268 km', r: 38, color: 'radial-gradient(circle at 35% 35%, #e2e8f0, #334155)', type: 'globe' },
          { name: 'Titan', size: '5.150 km', r: 37, color: 'radial-gradient(circle at 35% 35%, #fde047, #ca8a04)', type: 'globe' },
          { name: 'Mond', size: '3.474 km', r: 25, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Unser Mond ist der fünftgrößte Mond im Sonnensystem – Ganymed und Titan sind sogar größer als Merkur.',
      },
    ],
  },
  mars: {
    sizeStr: 'Ø 6.779 km',
    tabs: [
      {
        name: 'Mars vs. Erde & Mond',
        items: [
          { name: 'Erde', size: '12.742 km', r: 44, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
          { name: 'Mars', size: '6.779 km', r: 23, color: 'radial-gradient(circle at 35% 35%, #f87171, #991b1b)', type: 'globe' },
          { name: 'Mond', size: '3.474 km', r: 12, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Mars hat gut die halbe Erdgröße, besitzt aber ohne Ozeane fast dieselbe Landfläche wie die Erde.',
      },
    ],
  },
  phobos: {
    sizeStr: '27 × 22 × 18 km',
    tabs: [
      {
        name: 'vs. Berge & Städte',
        items: [
          { name: 'Phobos', size: '22 km Ø', r: 40, color: 'radial-gradient(circle at 35% 35%, #94a3b8, #334155)', type: 'rock' },
          { name: 'Mt. Everest', size: '8,8 km Höhe', r: 16, color: 'linear-gradient(to top, #64748b, #f1f5f9)', type: 'mountain' },
        ],
        note: 'Phobos ist ein unregelmäßiger Gesteinsbrocken – zweieinhalbmal so hoch wie der Mount Everest.',
      },
    ],
  },
  deimos: {
    sizeStr: '15 × 12 × 10 km',
    tabs: [
      {
        name: 'vs. Phobos',
        items: [
          { name: 'Phobos', size: '22 km Ø', r: 38, color: 'radial-gradient(circle at 35% 35%, #94a3b8, #334155)', type: 'rock' },
          { name: 'Deimos', size: '12 km Ø', r: 21, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'rock' },
        ],
        note: 'Deimos ist nur halb so groß wie Phobos und besitzt durch dicken Regolith-Staub eine sanfte Oberfläche.',
      },
    ],
  },
  asteroid: {
    sizeStr: 'Psyche: 279 × 232 × 189 km',
    tabs: [
      {
        name: 'Asteroiden-Vergleich',
        items: [
          { name: 'Psyche', size: '226 km Ø', r: 40, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #1e293b)', type: 'rock' },
          { name: 'Bennu', size: '490 m', r: 5, color: 'radial-gradient(circle at 35% 35%, #94a3b8, #0f172a)', type: 'rock' },
        ],
        note: 'Psyche ist einer der massereichsten Metall-Asteroiden – Bennu dagegen nur ein winziger Geröllhaufen.',
      },
    ],
  },
  jupiter: {
    sizeStr: 'Ø 139.822 km',
    tabs: [
      {
        name: 'Gasriesen vs. Erde',
        items: [
          { name: 'Jupiter', size: '139.822 km', r: 48, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #c2410c)', type: 'globe' },
          { name: 'Saturn', size: '116.460 km', r: 40, color: 'radial-gradient(circle at 35% 35%, #fef08a, #ca8a04)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 8, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Allein der Große Rote Fleck auf Jupiter ist größer als die gesamte Erde.',
      },
      {
        name: 'Galileische Monde',
        items: [
          { name: 'Ganymed', size: '5.268 km', r: 32, color: 'radial-gradient(circle at 35% 35%, #e2e8f0, #334155)', type: 'globe' },
          { name: 'Kallisto', size: '4.821 km', r: 29, color: 'radial-gradient(circle at 35% 35%, #94a3b8, #1e293b)', type: 'globe' },
          { name: 'Io', size: '3.643 km', r: 22, color: 'radial-gradient(circle at 35% 35%, #fef08a, #ea580c)', type: 'globe' },
          { name: 'Europa', size: '3.122 km', r: 19, color: 'radial-gradient(circle at 35% 35%, #e0f2fe, #0284c7)', type: 'globe' },
        ],
        note: 'Ganymed ist der größte Mond des Sonnensystems und übertrifft sogar den Planeten Merkur (4.880 km).',
      },
    ],
  },
  io: {
    sizeStr: 'Ø 3.643 km',
    tabs: [
      {
        name: 'vs. Erdmond & Europa',
        items: [
          { name: 'Io', size: '3.643 km', r: 35, color: 'radial-gradient(circle at 35% 35%, #fef08a, #ea580c)', type: 'globe' },
          { name: 'Erdmond', size: '3.474 km', r: 33, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
          { name: 'Europa', size: '3.122 km', r: 30, color: 'radial-gradient(circle at 35% 35%, #e0f2fe, #0284c7)', type: 'globe' },
        ],
        note: 'Io ist fast genau so groß wie unser Mond, wird aber durch Gezeitenkräfte zum vulkanischsten Körper im Sonnensystem.',
      },
    ],
  },
  europa: {
    sizeStr: 'Ø 3.122 km',
    tabs: [
      {
        name: 'vs. Erdmond',
        items: [
          { name: 'Europa', size: '3.122 km', r: 32, color: 'radial-gradient(circle at 35% 35%, #e0f2fe, #0284c7)', type: 'globe' },
          { name: 'Erdmond', size: '3.474 km', r: 36, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Obwohl Europa kleiner als unser Mond ist, birgt ihr globaler Ozean mehr flüssiges Wasser als alle Meere der Erde zusammen.',
      },
    ],
  },
  ganymede: {
    sizeStr: 'Ø 5.268 km',
    tabs: [
      {
        name: 'Größte Monde',
        items: [
          { name: 'Ganymed', size: '5.268 km', r: 42, color: 'radial-gradient(circle at 35% 35%, #e2e8f0, #334155)', type: 'globe' },
          { name: 'Merkur', size: '4.880 km', r: 39, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #64748b)', type: 'globe' },
          { name: 'Erdmond', size: '3.474 km', r: 28, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Ganymed übertrifft den Planeten Merkur um 8 % an Durchmesser und besitzt als einziger Mond ein eigenes Magnetfeld.',
      },
    ],
  },
  callisto: {
    sizeStr: 'Ø 4.821 km',
    tabs: [
      {
        name: 'vs. Merkur & Ganymed',
        items: [
          { name: 'Ganymed', size: '5.268 km', r: 40, color: 'radial-gradient(circle at 35% 35%, #e2e8f0, #334155)', type: 'globe' },
          { name: 'Kallisto', size: '4.821 km', r: 37, color: 'radial-gradient(circle at 35% 35%, #94a3b8, #1e293b)', type: 'globe' },
          { name: 'Erdmond', size: '3.474 km', r: 27, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Kallisto erreicht 99 % des Merkur-Durchmessers, hat wegen ihres Eisanteils aber nur ein Drittel seiner Masse.',
      },
    ],
  },
  saturn: {
    sizeStr: 'Ø 116.460 km (Ringe: 282.000 km)',
    tabs: [
      {
        name: 'Saturn & Ringe vs. Erde',
        items: [
          { name: 'Saturn', size: '116.460 km', r: 36, color: 'radial-gradient(circle at 35% 35%, #fef08a, #ca8a04)', type: 'globe' },
          { name: 'Ringe', size: '282.000 km', r: 52, color: 'none', type: 'ring' },
          { name: 'Erde', size: '12.742 km', r: 7, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Saturns Hauptringe spannen 282.000 km weit – mehr als zwei Drittel der Distanz von der Erde zum Mond.',
      },
    ],
  },
  titan: {
    sizeStr: 'Ø 5.150 km',
    tabs: [
      {
        name: 'vs. Erde & Mond',
        items: [
          { name: 'Erde', size: '12.742 km', r: 46, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
          { name: 'Titan', size: '5.150 km', r: 27, color: 'radial-gradient(circle at 35% 35%, #fde047, #ca8a04)', type: 'globe' },
          { name: 'Mond', size: '3.474 km', r: 18, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Titan ist der zweitgrößte Mond und der einzige Himmelskörper außer der Erde mit einer dichten Stickstoff-Atmosphäre.',
      },
    ],
  },
  enceladus: {
    sizeStr: 'Ø 504 km',
    tabs: [
      {
        name: 'vs. Großbritannien',
        items: [
          { name: 'Enceladus', size: '504 km Ø', r: 36, color: 'radial-gradient(circle at 35% 35%, #f8fafc, #94a3b8)', type: 'globe' },
          { name: 'Mond', size: '3.474 km', r: 52, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Enceladus würde bequem auf die Fläche Großbritanniens passen, speist aber den gesamten E-Ring des Saturns.',
      },
    ],
  },
  uranus: {
    sizeStr: 'Ø 50.724 km',
    tabs: [
      {
        name: 'Eisriesen vs. Erde',
        items: [
          { name: 'Uranus', size: '50.724 km', r: 42, color: 'radial-gradient(circle at 35% 35%, #a5f3fc, #0891b2)', type: 'globe' },
          { name: 'Neptun', size: '49.244 km', r: 40, color: 'radial-gradient(circle at 35% 35%, #93c5fd, #1d4ed8)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 15, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Uranus ist viermal so breit wie die Erde und rotiert um 98° gekippt fast auf seiner Bahnlinie.',
      },
    ],
  },
  miranda: {
    sizeStr: 'Ø 471 km',
    tabs: [
      {
        name: 'vs. Enceladus & Mimas',
        items: [
          { name: 'Miranda', size: '471 km', r: 35, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
          { name: 'Enceladus', size: '504 km', r: 38, color: 'radial-gradient(circle at 35% 35%, #f8fafc, #94a3b8)', type: 'globe' },
        ],
        note: 'Miranda besitzt mit Verona Rupes die höchste bekannte Klippe des Sonnensystems (rund 20 km senkrechter Abgrund).',
      },
    ],
  },
  neptune: {
    sizeStr: 'Ø 49.244 km',
    tabs: [
      {
        name: 'vs. Uranus & Erde',
        items: [
          { name: 'Neptun', size: '49.244 km', r: 40, color: 'radial-gradient(circle at 35% 35%, #93c5fd, #1d4ed8)', type: 'globe' },
          { name: 'Uranus', size: '50.724 km', r: 42, color: 'radial-gradient(circle at 35% 35%, #a5f3fc, #0891b2)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 15, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Obwohl minimal kleiner als Uranus, ist Neptun durch seine höhere Dichte massereicher (17 Erdmassen).',
      },
    ],
  },
  triton: {
    sizeStr: 'Ø 2.707 km',
    tabs: [
      {
        name: 'vs. Pluto & Mond',
        items: [
          { name: 'Triton', size: '2.707 km', r: 34, color: 'radial-gradient(circle at 35% 35%, #fbcfe8, #be185d)', type: 'globe' },
          { name: 'Pluto', size: '2.376 km', r: 30, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #9a3412)', type: 'globe' },
          { name: 'Erdmond', size: '3.474 km', r: 44, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Triton ist ein eingefangenes Kuipergürtel-Objekt – er ähnelt Pluto stark, ist aber etwas größer.',
      },
    ],
  },
  pluto: {
    sizeStr: 'Ø 2.376 km (Charon 1.212 km)',
    tabs: [
      {
        name: 'Pluto & Charon vs. Mond',
        items: [
          { name: 'Erdmond', size: '3.474 km', r: 46, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
          { name: 'Pluto', size: '2.376 km', r: 31, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #9a3412)', type: 'globe' },
          { name: 'Charon', size: '1.212 km', r: 16, color: 'radial-gradient(circle at 35% 35%, #cbd5e1, #475569)', type: 'globe' },
        ],
        note: 'Charon hat mehr als die halbe Pluto-Größe – beide umkreisen einen gemeinsamen Schwerpunkt im freien Raum.',
      },
    ],
  },
  sun: {
    sizeStr: 'Ø 1.392.700 km',
    tabs: [
      {
        name: 'Sonne vs. Planeten',
        items: [
          { name: 'Sonne', size: '1.392.700 km', r: 52, color: 'radial-gradient(circle at 35% 35%, #fef08a, #b45309)', type: 'globe' },
          { name: 'Jupiter', size: '139.822 km', r: 12, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #c2410c)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 4, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'In die Sonne würde die Erde rund 1,3 Millionen Mal hineinpassen; sie vereint 99,86 % der gesamten Masse des Sonnensystems.',
      },
    ],
  },
  solar: {
    sizeStr: 'Ausdehnung ≈ 100 AE (15 Mrd. km)',
    tabs: [
      {
        name: 'Planeten-Ordnung',
        items: [
          { name: 'Sonne', size: '1.392.700 km', r: 45, color: 'radial-gradient(circle at 35% 35%, #fef08a, #b45309)', type: 'globe' },
          { name: 'Jupiter', size: '139.822 km', r: 16, color: 'radial-gradient(circle at 35% 35%, #fed7aa, #c2410c)', type: 'globe' },
          { name: 'Erde', size: '12.742 km', r: 6, color: 'radial-gradient(circle at 35% 35%, #60a5fa, #1e3a8a)', type: 'globe' },
        ],
        note: 'Das Sonnensystem besteht zu 99,86 % aus der Sonne. Alle Planeten zusammen sind nur ein winziger Staubrest.',
      },
    ],
  },
  galaxy: {
    sizeStr: 'Ø ≈ 100.000 Lichtjahre',
    tabs: [
      {
        name: 'Galaxien-Vergleich',
        items: [
          { name: 'Andromeda', size: '220.000 Lj', r: 50, color: 'radial-gradient(circle at 35% 35%, #fbcfe8, #4c1d95)', type: 'galaxy' },
          { name: 'Milchstraße', size: '100.000 Lj', r: 35, color: 'radial-gradient(circle at 35% 35%, #bae6fd, #1e3a8a)', type: 'galaxy' },
          { name: 'Große Mag. Wolke', size: '14.000 Lj', r: 14, color: 'radial-gradient(circle at 35% 35%, #e2e8f0, #334155)', type: 'galaxy' },
        ],
        note: 'Andromeda ist die größte Galaxie der Lokalen Gruppe und mehr als doppelt so weit ausgedehnt wie unsere Milchstraße.',
      },
    ],
  },
  andromeda: {
    sizeStr: 'Ø ≈ 220.000 Lichtjahre',
    tabs: [
      {
        name: 'Galaxien-Vergleich',
        items: [
          { name: 'Andromeda', size: '220.000 Lj', r: 50, color: 'radial-gradient(circle at 35% 35%, #fbcfe8, #4c1d95)', type: 'galaxy' },
          { name: 'Milchstraße', size: '100.000 Lj', r: 35, color: 'radial-gradient(circle at 35% 35%, #bae6fd, #1e3a8a)', type: 'galaxy' },
          { name: 'M32', size: '6.500 Lj', r: 6, color: 'radial-gradient(circle at 35% 35%, #fde68a, #78350f)', type: 'galaxy' },
        ],
        note: 'Andromedas Sternscheibe reicht mehr als doppelt so weit wie die der Milchstraße; ihr Begleiter M32 ist dagegen winzig und sehr dicht.',
      },
    ],
  },
  sgra: {
    sizeStr: 'Schatten Ø ≈ 53 µas (≈ 52 Mio. km)',
    tabs: [
      {
        name: 'vs. Sonnensystem',
        items: [
          { name: 'Schatten Sgr A*', size: '52 Mio. km', r: 35, color: 'radial-gradient(circle at 50% 50%, #000 60%, #ea580c 90%)', type: 'hole' },
          { name: 'Merkurbahn', size: '58 Mio. km', r: 42, color: 'none', type: 'orbit' },
        ],
        note: 'Der Schatten von Sagittarius A* würde fast die gesamte Merkurbahn (58 Mio. km Sonnenabstand) ausfüllen.',
      },
    ],
  },
};

// Rendert die HTML-Karte für den Größenvergleich
export function renderScaleCompare(stationId, tabIdx = 0) {
  const comp = SCALE_COMPARISONS[stationId];
  if (!comp) return '';
  const tabs = comp.tabs || [];
  const activeTab = tabs[tabIdx] || tabs[0];
  if (!activeTab) return '';

  const items = activeTab.items || [];
  // Maßstab in echter Größe (Tafel:C): haben alle Größen dieselbe Einheit, folgen die Radien dem echten Verhältnis zum größten
  // Objekt (mindestens 1 px), sonst bleiben die gezeichneten Radien
  const parsed = items.map((it) => { const m = String(it.size).match(/^([\d.,]+)\s*(.+)$/); return m ? [+m[1].replace(/\./g, '').replace(',', '.'), m[2].trim()] : null; });
  const real = parsed.length > 1 && parsed.every((p) => p && p[0] > 0 && p[1] === parsed[0][1]);
  const big = real ? Math.max(...parsed.map((p) => p[0])) : 0, rMax = Math.max(...items.map((it) => it.r));
  const rTop = real ? Math.min(rMax, 36) : rMax;   // größter Körper 72 px wie im Entwurf; Höhe der Bühne = größter Durchmesser
  const rOf = (it, i) => (real ? Math.max(0.5, rTop * parsed[i][0] / big) : it.r);
  const tabsHtml = tabs.length > 1
    ? `<div class="sc-tabs" role="tablist">${tabs.map((t, i) => `
        <button type="button" role="tab" class="sc-tab-btn${i === tabIdx ? ' is-active' : ''}" data-sc-tab="${i}" aria-selected="${i === tabIdx}">${t.name}</button>`).join('')}</div>`
    : '';

  return `
    <section class="scale-compare" id="scale-compare" aria-label="Maßstabs-Vergleich">
      <div class="sc-head">
        <svg viewBox="0 0 24 24" class="sc-icon" aria-hidden="true">
          <rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <circle cx="8.5" cy="12.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="16" cy="12.5" r="1.8" fill="none" stroke="currentColor" stroke-width="1.4"/>
        </svg>
        <span class="sc-title">Maßstabs-Vergleich${real ? ', echte Größe' : ''}</span>
        <span class="sc-tag">${nbsp(comp.sizeStr)}</span>
      </div>
      <div class="sc-stage">
        <div class="sc-items" style="--vh:${Math.ceil(rTop * 2) + 2}px">
          ${items.map((it, i) => `
            <div class="sc-col">
              <div class="sc-vis-box">
                <span class="sc-shape sc-shape--${it.type || 'globe'}" style="width: ${rOf(it, i) * 2}px; height: ${rOf(it, i) * 2}px; background: ${it.color};"></span>
              </div>
              <b class="sc-name">${it.name}</b>
              <small class="sc-val">${it.size}</small>
            </div>`).join('')}
        </div>
      </div>
      <p class="sc-note">${activeTab.note}</p>
      ${tabsHtml}
    </section>`;
}

