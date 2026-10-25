# Recherche: Reise durch das All (Stand 2026-10-25)

Grundlage für Zahlen, Texte und Shader der Seite. Jede Zahl hat eine Quelle; was nicht belegt ist, steht als **[nicht belegt]** da. Kennzeichnungen:

- **[eigene Rechnung]** – aus belegten Werten abgeleitet (Formel genannt), keine Messung.
- **[umstritten]** – Quellen widersprechen sich; beide Werte stehen da.
- **[neu 2024–2026]** – jüngere Arbeit, noch wenig geprüft oder nur als Preprint/Pressemitteilung.
- **[Modell]** – Darstellungsannahme der Seite, keine Messung.
- „zitiert nach X“ – Wert aus einer Arbeit, die die Originalquelle zitiert; Original nicht selbst gelesen.

Einheiten: 1 AE = 149 597 870 700 m (IAU 2012, Definition) · 1 pc = 648 000/π AE (IAU 2015, Definition) ≈ 3,2616 Lichtjahre · c = 299 792 458 m/s (Definition).

---

## 1. Erde & Mond

### Kennzahlen

| Größe | Wert | Quelle | Stand |
|---|---|---|---|
| Erdradius äquatorial / polar / mittel | 6378,137 / 6356,752 / 6371,000 km | NASA NSSDC Earth Fact Sheet | 2024-11-15 |
| Erdmasse | 5,9722 × 10²⁴ kg | NSSDC Earth | 2024-11-15 |
| Achsneigung (Obliquität) | 23,44° (J2000: 23,43928°) | NSSDC Earth; JPL Approx. Positions | 2024-11-15 |
| Siderische Rotation | 23,9345 h | NSSDC Earth | 2024-11-15 |
| Albedo Erde (Bond / geometrisch) | 0,294 / 0,434 | NSSDC Earth | 2024-11-15 |
| Atmosphäre: Bodendruck, Skalenhöhe | 1014 mbar, 8,5 km | NSSDC Earth | 2024-11-15 |
| Zusammensetzung (trocken, Vol.) | N₂ 78,08 %, O₂ 20,95 %, Ar 9340 ppm | NSSDC Earth | 2024-11-15 |
| Mondradius mittel / äquatorial | 1737,4 / 1738,1 km | NSSDC Moon Fact Sheet | 2024-01-11 |
| Mondmasse | 0,07346 × 10²⁴ kg | NSSDC Moon | 2024-01-11 |
| Große Halbachse / Perigäum / Apogäum | 384 400 / 363 300 / 405 500 km | NSSDC Moon | 2024-01-11 |
| Siderischer / synodischer Monat | 27,3217 d / 29,53 d | NSSDC Moon | 2024-01-11 |
| Siderische Rotation Mond | 655,720 h = 27,32 d → gleich Umlaufzeit: **gebundene Rotation** | NSSDC Moon | 2024-01-11 |
| Bahnneigung zur Ekliptik / Exzentrizität | 5,145° / 0,0549 | NSSDC Moon | 2024-01-11 |
| Albedo Mond (Bond / geometrisch) | 0,11 / 0,12 | NSSDC Moon | 2024-01-11 |
| Entfernungszunahme | 3,8 cm/Jahr | NSSDC Moon | 2024-01-11 |
| Lichtlaufzeit Erde–Mond | 1,282 s (Mittel), 1,212–1,353 s | [eigene Rechnung] a/c | – |

### Darstellungsrelevante Physik (Shader)
- **Blauer Rand = Rayleigh-Streuung ∝ λ⁻⁴.** Referenzmodell Bruneton (Code 2017, BSD-Lizenz): β_R(λ) = 1,24062 × 10⁻⁶ · λ[µm]⁻⁴ m⁻¹ → (5,8 / 13,6 / 33,1) × 10⁻⁶ m⁻¹ bei 680 / 550 / 440 nm [eigene Rechnung aus der Code-Konstante]; Skalenhöhe Rayleigh H_R = 8,0 km, Mie (Dunst) H_M = 1,2 km, Mie-Asymmetrie g = 0,8, Einfachstreu-Albedo Mie 0,9, Atmosphärenoberkante 60 km über dem Boden (6360 → 6420 km), Bodenalbedo 0,1. Quelle: `atmosphere/demo/demo.cc` in github.com/ebruneton/precomputed_atmospheric_scattering; Verfahren: Bruneton & Neyret 2008.
- NSSDC nennt 8,5 km Skalenhöhe (Druck), Bruneton 8 km (Dichte der Rayleigh-Schicht) – beides vertretbar.
- Nachtseite: Stadtlichter aus Black Marble (Abschnitt 12).
- Mond: dunkel (geometrische Albedo 0,12 gegenüber Erde 0,434); stets dieselbe Seite zur Erde.

---

## 2. Sonnensystem

### Sonne

| Größe | Wert | Quelle | Stand |
|---|---|---|---|
| Radius (mittel) | 695 700 km | NSSDC Sun Fact Sheet | 2024-05-09 |
| Masse | 1 988 400 × 10²⁴ kg | NSSDC Sun | 2024-05-09 |
| Effektivtemperatur | 5772 K | NSSDC Sun | 2024-05-09 |
| Leuchtkraft | 382,8 × 10²⁴ W | NSSDC Sun | 2024-05-09 |
| Spektraltyp | G2 V | NSSDC Sun | 2024-05-09 |
| Photosphäre | oben ≈ 4400 K, unten ≈ 6600 K, ≈ 500 km dick | NSSDC Sun | 2024-05-09 |
| Rotation (bei 16° Breite) / Neigung zur Ekliptik | 609,12 h / 7,25° | NSSDC Sun | 2024-05-09 |
| Lichtlaufzeit Sonne–Erde | 8,32 min (499 s) | [eigene Rechnung] 1 AE/c | – |

**Randverdunklung (Shader):** I(μ)/I(1) = 0,30 + 0,93 μ − 0,23 μ² bei 550 nm, μ = cos ψ (ψ = Winkel Sehstrahl–Sonnenradius) → Rand 30 % der Mitte, Scheibenmittel 80,5 %. Quelle: Cox (Hrsg.) 2000, Allen's Astrophysical Quantities, 4. Aufl., zitiert nach Wikipedia „Limb darkening“. Stärker im Blauen als im Roten (Polynome je Wellenlänge: Neckel & Labs 1994, Sol. Phys. 153, 91) – Koeffizienten je Farbkanal **[nicht belegt]** in dieser Recherche.

### Planeten (NSSDC Planetary Fact Sheet, Stand 2025-03-18)

| Planet | Durchmesser (km) | Rotation (h) | Achsneigung (°) | Bahnneigung (°) | Exzentrizität |
|---|---|---|---|---|---|
| Merkur | 4879 | 1407,6 | 0,034 | 7,0 | 0,206 |
| Venus | 12 104 | −5832,5 (rückläufig) | 177,4 | 3,4 | 0,007 |
| Erde | 12 756 | 23,9 | 23,4 | 0,0 | 0,017 |
| Mars | 6792 | 24,6 | 25,2 | 1,8 | 0,094 |
| Jupiter | 142 984 | 9,9 | 3,1 | 1,3 | 0,049 |
| Saturn | 120 536 | 10,7 | 26,7 | 2,5 | 0,052 |
| Uranus | 51 118 | −17,2 (rückläufig) | 97,8 | 0,8 | 0,047 |
| Neptun | 49 528 | 16,1 | 28,3 | 1,8 | 0,010 |

Durchmesser = äquatorial (Gasriesen abgeplattet).

### Farben / Albedo (geometrische Albedo je Band, Mallama et al. 2017, Icarus, Tab. 7)

| Planet | B (≈ 440 nm) | V (≈ 550 nm) | R (≈ 700 nm) |
|---|---|---|---|
| Merkur | 0,105 | 0,142 | 0,172 |
| Venus | 0,658 | 0,689 | 0,708 |
| Erde | 0,512 | 0,434 | 0,418 |
| Mars | 0,088 | 0,170 | 0,288 |
| Jupiter | 0,443 | 0,538 | 0,495 |
| Saturn | 0,339 | 0,499 | 0,568 |
| Uranus | 0,561 | 0,488 | 0,202 |
| Neptun | 0,562 | 0,442 | 0,181 |

→ Verhältnis B:V:R als Farbton der Grundfarbe nutzbar (Mars rötlich, Uranus/Neptun blaugrün, Erde bläulich). Wellenlängen der Bänder sind Richtwerte der Johnson-Filter.

### Saturnringe (NSSDC Saturnian Rings Fact Sheet, Stand 2022-04-19; Radien ab Saturnmitte)

| Ring / Lücke | innen (km) | außen (km) | optische Tiefe | Dicke | Albedo |
|---|---|---|---|---|---|
| D | 66 900 | 74 510 | 10⁻⁵ | – | – |
| C | 74 658 | 91 975 | 0,05–0,35 | ≈ 5 m | 0,12–0,30 |
| Maxwell-Lücke | 87 491 | – | – | – | – |
| B | 91 975 | 117 507 | 0,4–2,5 | 5–10 m | 0,4–0,6 |
| Cassini-Teilung | 117 507 | 122 340 | 0–0,1 | 20 m | 0,2–0,4 |
| A | 122 340 | 136 780 | 0,4–1,0 | 10–30 m | 0,4–0,6 |
| Encke-Lücke | 133 410 | – | – | – | – |
| Keeler-Lücke | 136 487 | – | – | – | – |
| F | 139 826 | – | 0,1 | – | 0,6 |
| G | 166 000 | 173 000 | 10⁻⁶ | – | – |
| E | 180 000 | 480 000 | 10⁻⁶ | – | – |

Cassini-Teilung = Lücke zwischen B-Außenrand und A-Innenrand (NSSDC nennt die Ränder nicht gesondert). Ringebene = Saturnäquator, 26,7° zur Bahn. Optische Tiefe → Alpha im Ring-Shader (B undurchsichtig, C und Cassini durchscheinend) **[Modell]**.

### JPL „Approximate Positions of the Planets“ – Tabelle 1 (wörtlich)
Quelle: https://ssd.jpl.nasa.gov/planets/approx_pos.html, Inhalt aus E. M. Standish & J. G. Williams 1992. Bezug: mittlere Ekliptik und Äquinoktium J2000, **gültig 1800–2050**. Zweite Zeile je Planet = Raten pro Jahrhundert (Cy).

```
                a              e               I                L            long.peri.      long.node.
            au, au/Cy     rad, rad/Cy     deg, deg/Cy      deg, deg/Cy      deg, deg/Cy     deg, deg/Cy
-----------------------------------------------------------------------------------------------------------
Mercury   0.38709927      0.20563593      7.00497902      252.25032350     77.45779628     48.33076593
          0.00000037      0.00001906     -0.00594749   149472.67411175      0.16047689     -0.12534081
Venus     0.72333566      0.00677672      3.39467605      181.97909950    131.60246718     76.67984255
          0.00000390     -0.00004107     -0.00078890    58517.81538729      0.00268329     -0.27769418
EM Bary   1.00000261      0.01671123     -0.00001531      100.46457166    102.93768193      0.0
          0.00000562     -0.00004392     -0.01294668    35999.37244981      0.32327364      0.0
Mars      1.52371034      0.09339410      1.84969142       -4.55343205    -23.94362959     49.55953891
          0.00001847      0.00007882     -0.00813131    19140.30268499      0.44441088     -0.29257343
Jupiter   5.20288700      0.04838624      1.30439695       34.39644051     14.72847983    100.47390909
         -0.00011607     -0.00013253     -0.00183714     3034.74612775      0.21252668      0.20469106
Saturn    9.53667594      0.05386179      2.48599187       49.95424423     92.59887831    113.66242448
         -0.00125060     -0.00050991      0.00193609     1222.49362201     -0.41897216     -0.28867794
Uranus   19.18916464      0.04725744      0.77263783      313.23810451    170.95427630     74.01692503
         -0.00196176     -0.00004397     -0.00242939      428.48202785      0.40805281      0.04240589
Neptune  30.06992276      0.00859048      1.77004347      -55.12002969     44.96476227    131.78422574
          0.00026291      0.00005105      0.00035372      218.45945325     -0.32241464     -0.00508664
------------------------------------------------------------------------------------------------------
EM Bary = Earth/Moon Barycenter
```

- Kopfzeile wörtlich von JPL; e ist dimensionslos (die Angabe „rad“ steht so im Original).
- Rechenweg (JPL): T = (JD_TDB − 2451545,0)/36525 · Element = Wert₀ + Rate · T · ω = ϖ − Ω · M = L − ϖ (für Tabelle 1 ohne Zusatzterme b, c, s, f; diese gelten nur für Tabelle 2a/2b, 3000 v. Chr.–3000 n. Chr.) · M auf −180…+180° bringen · Kepler-Gleichung M = E − e* sin E mit e* = 57,29578 · e (Grad), Start E₀ = M + e* sin M, Newton-Schritte bis |ΔE| ≤ 10⁻⁶° · x′ = a(cos E − e), y′ = a√(1−e²) sin E · Drehung R_z(−Ω) R_x(−I) R_z(−ω) in die Ekliptik J2000 · Äquator-System mit ε = 23,43928°.
- Genauigkeit 1800–2050 (JPL): Länge 15″ (Merkur) bis 600″ (Saturn), Abstand 1000 km (Merkur) bis 1,5 Mio. km (Saturn) – für die Darstellung weit ausreichend.

Lichtlaufzeit Sonne → Planet (a/c): Merkur 3,2 min · Venus 6,0 · Erde 8,3 · Mars 12,7 · Jupiter 43,3 min · Saturn 1,32 h · Uranus 2,66 h · Neptun 4,17 h [eigene Rechnung].

---

## 3. Milchstraße (Hub)

### Kennzahlen

| Größe | Wert | Quelle |
|---|---|---|
| R₀ (Sonne–Sgr A*) | **8277 ± 9 (stat.) pc**, Systematik ≈ 30 pc | GRAVITY Collab. 2022, A&A 657, L12 |
| R₀ früher | 8178 ± 13 ± 22 pc (2019) · 8249 ± 9 ± 45 pc (2020) | GRAVITY 2019; GRAVITY 2020 |
| R₀ Keck/UCLA | 7946 ± 50 ± 32 pc | Do et al. 2019, Science 365, 664 |
| R₀ Maser | 8,15 ± 0,15 kpc | Reid et al. 2019, ApJ 885, 131 |
| Höhe der Sonne über der Ebene z⊙ | 20,8 ± 0,3 pc · Übersicht 25 ± 5 pc · Maser 5,5 ± 5,8 pc **[umstritten]** | Bennett & Bovy 2019; Bland-Hawthorn & Gerhard 2016 (BHG); Reid et al. 2019 |
| Balken (langer Balken): Halblänge | 5,0 ± 0,2 kpc | Wegg et al. 2015 |
| Balken: Winkel zur Linie Sonne–Zentrum | 28–33° (langer Balken) · 27 ± 2° (Box/Peanut-Bulge) | Wegg et al. 2015; BHG 2016 |
| Dünne Scheibe: Skalenlänge / -höhe | 2,6 ± 0,5 kpc / 300 ± 50 pc | BHG 2016 |
| Dicke Scheibe: Skalenlänge / -höhe | 2,0 ± 0,2 kpc / 900 ± 180 pc | BHG 2016 |
| Sternmasse gesamt | 5 ± 1 × 10¹⁰ M☉ | BHG 2016 |
| Gesamtmasse (virial) | 1,3 ± 0,3 × 10¹² M☉ · Rotationskurve: 7,25 ± 0,26 × 10¹¹ M☉ **[umstritten]** | BHG 2016; Eilers et al. 2019 |
| Kreisbahngeschwindigkeit am Ort der Sonne | 229,0 ± 0,2 km/s (Systematik 2–5 %) · 236 ± 7 km/s · 238 ± 15 km/s | Eilers et al. 2019; Reid et al. 2019; BHG 2016 |
| Gesamtbewegung Sonne / Winkelgeschw. | 247 ± 4 km/s / 30,32 ± 0,27 km s⁻¹ kpc⁻¹ | Reid et al. 2019 |
| Galaktisches Jahr | ≈ 203 Mio. J. (aus 30,32 km/s/kpc) bis ≈ 222 Mio. J. (229 km/s, 8,277 kpc) | [eigene Rechnung] 2πR₀/V |
| Sternzahl | 100–400 Mrd. | J. de Bruijne (ESA/Gaia), zitiert nach Space.com 2022 – schwache Quelle |
| Lichtlaufzeit zum Zentrum | ≈ 27 000 Jahre | [eigene Rechnung] 8277 pc |

### Spiralarme (Reid et al. 2019, Tab. 2; log-periodische Spiralen, Knick bei β_kink, R₀ = 8,15 kpc)

| Arm | R_kink (kpc) | β_kink (°) | ψ innen (°) | ψ außen (°) | Breite (kpc) |
|---|---|---|---|---|---|
| 3-kpc (N) | 3,52 ± 0,26 | 15 | −4,2 ± 3,8 | −4,2 ± 3,8 | 0,18 |
| Norma | 4,46 ± 0,19 | 18 ± 4 | −1,0 ± 3,3 | 19,5 ± 5,1 | 0,14 |
| Scutum-Centaurus | 4,91 ± 0,09 | 23 | 14,1 ± 1,7 | 12,1 ± 2,4 | 0,23 |
| Sagittarius-Carina | 6,04 ± 0,09 | 24 ± 2 | 17,1 ± 1,6 | 1,0 ± 2,1 | 0,27 |
| Local (Orion-Arm) | 8,26 ± 0,05 | 9 | 11,4 ± 1,9 | 11,4 ± 1,9 | 0,31 |
| Perseus | 8,87 ± 0,13 | 40 | 10,3 ± 1,4 | 8,7 ± 2,7 | 0,35 |
| Outer | 12,24 ± 0,36 | 18 | 3,0 ± 4,4 | 9,4 ± 4,0 | 0,65 |

Formel: ln(R/R_kink) = −(β − β_kink) · tan ψ (β = galaktozentrischer Azimut). Reid et al.: vierarmige Spirale, mittlerer Steigungswinkel der Hauptarme ≈ 10°.

### Galaktische Koordinaten (SIMBAD, ICRS → galaktisch, abgefragt 2026-10-25)

| Objekt | l (°) | b (°) | Entfernung | X / Y / Z (kpc) [eigene Rechnung] |
|---|---|---|---|---|
| Orion-Nebel M42 | 209,0095 | −19,3818 | 390 ± 2 pc | −0,322 / −0,178 / −0,129 |
| θ¹ Ori C | 209,0108 | −19,3840 | wie M42 | – |
| Krebsnebel M1 | 184,5547 | −5,7833 | 1,90 (+0,22/−0,18) kpc | – |
| Crab-Pulsar (PSR B0531+21) | 184,5575 | −5,7843 | wie M1 | −1,884 / −0,150 / −0,192 |
| Sgr A* | 359,94424 | −0,04616 | 8,277 kpc | 8,277 / −0,008 / −0,007 |
| M31 | 121,1743 | −21,5733 | 761 ± 11 kpc | −366 / 605 / −280 |
| M33 | 133,6102 | −31,3307 | 840 ± 11 kpc | −495 / 520 / −437 |
| LMC | 280,4652 | −32,8884 | 49,59 kpc | 7,6 / −40,9 / −26,9 |
| SMC | 302,8084 | −44,3277 | 62,44 kpc | 24,2 / −37,5 / −43,6 |
| M87 | 283,7778 | +74,4912 | 16,8 ± 0,8 Mpc | – |

Heliozentrisch kartesisch: X = d cos b cos l (zum Zentrum), Y = d cos b sin l (Drehrichtung), Z = d sin b (galaktischer Nordpol). Galaktozentrisch: X − R₀, dazu z⊙ beachten.

---

## 4. Orion-Nebel (M42)

| Größe | Wert | Quelle |
|---|---|---|
| Entfernung (VLBA) | 414 ± 7 pc | Menten et al. 2007 |
| Entfernung (VLBA, GOBELINS) | 388 ± 5 pc | Kounkel et al. 2017 |
| Entfernung (Gaia EDR3) | 390 ± 2 pc | Maíz Apellániz et al. 2022, zitiert nach Schulz et al. 2024 (arXiv:2404.19676) |
| Lichtlaufzeit | ≈ 1270 Jahre (390 pc) | [eigene Rechnung] |
| Scheinbare Größe | 66′ × 66′ (SIMBAD) · Sh 2-281: 60′ | SIMBAD; Sharpless 1959 (VizieR VII/20) |
| Wahre Größe | ≈ 7,5 pc ≈ 24 Lj (66′ bei 390 pc) | [eigene Rechnung] |
| Orion A (Wolke) wahre Länge | ≈ 90 pc statt projiziert ≈ 40 pc, kometenartig | Großschedl et al. 2018 (Gaia DR2) |
| θ¹ Ori C: Spektraltyp | O7Vp (SIMBAD) · O7–O5,5 je nach Kalibrierung **[umstritten]** | SIMBAD; Kraus et al. 2009 |
| θ¹ Ori C: T_eff, Radius, Masse | 39 000 ± 1000 K · 10,6 ± 1,5 R☉ · M_evol 33 M☉, M_spek 45 ± 16 M☉ | Simón-Díaz et al. 2006, zitiert nach Kraus et al. 2009 |
| Blister-Geometrie | θ¹ Ori C ≈ 0,2 pc vor der Hauptionisationsfront (MIF); leuchtende Schicht ≈ 0,1 pc dick; „Veil“ 1–3 pc vor dem Stern zum Beobachter; Orion-S = eigene Wolke im ionisierten Gas; offene [O III]-Schale um das Trapez | O'Dell et al. 2009, AJ 137, 367 |
| Proplyds | 178 ionisierte Scheiben + 28 Silhouetten-Scheiben (HST/ACS) | Ricci, Robberto & Soderblom 2008 |
| Proplyd-Staubmassen | 0,3–79 Jupitermassen (ALMA) | Mann et al. 2014 |

**Ionisationsschichtung (Shader, von innen nach außen):** [O III] am nächsten zu θ¹ Ori C (H⁺ + He⁺-Zone) → [N II], [O II] (H⁺, He neutral) → [S II] knapp innerhalb der Ionisationsfront → [O I] genau an der Front; [O III]/Hβ ist antikorreliert mit [N II]/Hα und [S II]/Hα. Quelle: IFU-Studie Bright Bar / Orion-S (arXiv:1106.3602), Schalenbild O'Dell et al. 2009. Ionisationsenergien O → O⁺ 13,6 eV, O⁺ → O²⁺ 35,1 eV (gleiche Quelle).

**Linien-Wellenlängen (Luft, NIST Atomic Spectra Database, abgefragt 2026-10-25):**

| Linie | λ (nm) | Farbe am Bildschirm |
|---|---|---|
| Hβ | 486,13 | blaugrün |
| [O III] | 495,89 / 500,68 | grün-türkis |
| [O I] | 630,03 | rot |
| [N II] | 654,81 / 658,35 | rot |
| Hα | 656,27 | rot |
| [S II] | 671,64 / 673,08 | tiefrot |
| [O II] | 372,60 / 372,88 | nahes UV (unsichtbar) |

Farbzuordnung „λ → sRGB“ ist **[Modell]**. Hubble-Farbbild (NASA M42-Seite): orange = Wasserstoff, grün = Sauerstoff, rot = Schwefel + Infrarot → Falschfarben, nicht Augeneindruck.

---

## 5. Krebsnebel (M1)

| Größe | Wert | Quelle |
|---|---|---|
| Supernova | 1054 n. Chr. („Gaststern“) | NASA Hubble Messier 1 |
| Entfernung (VLBI-Parallaxe) | 1,90 (+0,22/−0,18) kpc · π = 0,53 ± 0,06 mas | Lin et al. 2023, ApJ 952, 161 |
| Entfernung (Gaia DR3 / klassisch) | π = 0,51 ± 0,08 mas · ≈ 2 kpc (Trimble 1973) | zitiert nach Lin et al. 2023; Bühler & Blandford 2014 |
| Lichtlaufzeit | ≈ 6200 Jahre (1,90 kpc) | [eigene Rechnung] |
| Scheinbare / wahre Größe | ≈ 7′ × 4,6′ → ≈ 4,1 × 2,7 pc bei 2 kpc (≈ 3,9 × 2,5 pc bei 1,9 kpc) | Bühler & Blandford 2014; [eigene Rechnung] |
| Radialgeschwindigkeiten der Filamente | −1500 … +1500 km/s | Martin et al. 2021 (SITELLE-3D-Karte) |
| Konvergenzdatum Filamente | 1091 ± 34 n. Chr. · 1105,5 ± 0,5 n. Chr. **[neu 2024–2026]** | Bietenholz & Nugent 2015; Martin et al. 2025 |
| Konvergenzdatum Synchrotron (Radio) | 1255 ± 27 n. Chr. → innerer Nebel stärker beschleunigt | Bietenholz & Nugent 2015 |
| Gasmasse (Klumpen-Modell) | 7,0 M☉ | Owen & Barlow 2015 |
| Staubmasse | 0,18–0,27 M☉ (amorpher Kohlenstoff) · 0,24 (+0,32/−0,08) M☉ (Silikat) | Owen & Barlow 2015; Gomez et al. 2012 |
| Leuchtkraft Nebel | ≈ 1,3 × 10³⁸ erg/s | Hester 2008, zitiert nach Bühler & Blandford 2014 |
| Wisps (Ringwellen) | 0,03–0,5 c nach außen; innerer Knoten ≈ 0,6″ vom Pulsar | Bühler & Blandford 2014 |
| Form | nicht ellipsoid, „herzförmig“, symmetrisch zur Torusebene; Filamente wabenartig | Martin et al. 2021 |

**Farben (Shader):** innen bläulich-weißes Kontinuum = Synchrotronstrahlung relativistischer Elektronen im Magnetfeld; außen Filamente mit Linienemission (Hα, [N II], [S II], [O III]). NASA-Hubble-Mosaik (Hester & Loll): orange = Wasserstoff, rot = [O III], grün = [S II], blau = neutraler Sauerstoff → Falschfarben. Röntgen-Torus + Jet senkrecht dazu (Chandra). Achtung: die NASA-Seite nennt „sechs Lichtjahre“ Breite, die Fachliteratur ≈ 13 × 9 Lj – Fachwert verwenden.

---

## 6. Crab-Pulsar (PSR B0531+21 = J0534+2200)

| Größe | Wert | Quelle |
|---|---|---|
| Periode P | 0,0333924123(12) s → 29,95 Hz | ATNF Pulsar Catalogue v2.6.1 |
| Ṗ | 4,20972(3) × 10⁻¹³ | ATNF v2.6.1 |
| Charakteristisches Alter P/(2Ṗ) | 1,26 × 10³ Jahre (wahres Alter ≈ 970 Jahre seit 1054) | ATNF; [eigene Rechnung] |
| Magnetfeld Oberfläche | 3,79 × 10¹² G | ATNF (B = 3,2 × 10¹⁹ √(PṖ) G) |
| Energieverlust Ė | 4,5 × 10³⁸ erg/s | ATNF |
| Bremsindex | n = 2,342(1) über 45 Jahre | Lyne et al. 2015 |
| Lichtzylinder R_LC = cP/2π | ≈ 1593 km | [eigene Rechnung] |
| Neutronenstern Radius / Masse | 12,71 (+1,14/−1,19) km, 1,34 M☉ · 13,02 (+1,24/−1,06) km, 1,44 M☉ (PSR J0030+0451, NICER) | Riley et al. 2019; Miller et al. 2019 |
| Masse des Crab-Pulsars selbst | **[nicht belegt]** – Darstellung nimmt 1,4 M☉, R ≈ 12 km an **[Modell]** | – |
| Neigung Beobachter–Drehachse ζ | ≈ 60° (aus Torus-Anpassung) | Ng & Romani 2004, zitiert nach Bühler & Blandford 2014 |
| Neigung Magnet- zu Drehachse α | unbekannt; aus Modellen ≈ 45° **[umstritten]** (andere Modelle 75°) | Harding et al. 2008, zitiert nach Bühler & Blandford 2014; arXiv:2403.06282 |
| Pulsprofil | Hauptpuls P1 bei φ ≈ 1,0, Zwischenpuls P2 bei φ ≈ 0,4 (≈ 144° Abstand); Radio-Vorläufer vor P1; optisch „Brücke“ zwischen P1 und P2; Riesenpulse ≈ 1000-fach | Bühler & Blandford 2014 |
| Abstand P1–P2 wächst | 0,62 ± 0,03° pro Jahrhundert → Magnetachse wandert zum Äquator | Lyne et al. 2013 |
| Eigenbewegung quer | 104 (+13/−11) km/s | Lin et al. 2023 |

**Strahlkegel:** Öffnungswinkel **[nicht belegt]** (modellabhängig) → als [Modell] kennzeichnen.

**Darstellung – Blitzen:** 30 Blitze/s verstoßen gegen **WCAG 2.2, Erfolgskriterium 2.3.1 (Stufe A)**: „nicht mehr als drei Blitze in einer Sekunde“, außer die Blitzfläche bleibt unter der Schwelle (≤ 25 % eines 10°-Sichtfelds ≈ 341 × 256 px bei 1024 × 768; „allgemeiner Blitz“ = gegenläufige Helligkeitswechsel ≥ 10 % bei dunklerem Bild < 0,80 relativer Leuchtdichte; gesättigtes Rot zählt gesondert). → Zeitlupe ≥ Faktor 10 (≤ 3 Hz), besser Faktor 30 (≈ 1 Hz), dazu Echtzeit-Frequenz als Zahl/Ton; `prefers-reduced-motion` respektieren.

**Sonifikation:** Jodrell Bank Centre for Astrophysics, Seite „Pulsar sounds“ (Stand 2014-03-07): Crab-Aufnahme `0531.mp3` (Lovell-Teleskop), Radio-Intensität → Lautstärke; Riesenpulse hörbar. Keine Lizenz genannt; für Nutzung Patrick Weltevrede (JBCA) anfragen. Alternativ eigene Synthese aus P (≈ 30 Hz Klick-Folge) **[Modell]**.

---

## 7. Sgr A* (Schwarzes Loch im Zentrum)

| Größe | Wert | Quelle |
|---|---|---|
| Masse | **4,297 ± 0,012 (stat.) × 10⁶ M☉** (bei R₀ = 8277 pc) | GRAVITY 2022 |
| Masse früher / Keck | 4,261 ± 0,012 × 10⁶ M☉ (GRAVITY 2020) · 3,975 ± 0,058 ± 0,026 × 10⁶ M☉ (Keck); auf 8277 pc umgerechnet 4,299 ± 0,063 × 10⁶ M☉ | GRAVITY 2020; Do et al. 2019; Tab. B.1 in GRAVITY 2022 |
| Masse aus EHT-Bild | 4,0 (+1,1/−0,6) × 10⁶ M☉ | EHT 2022 Paper I |
| Schwarzschild-Radius R_s = 2GM/c² | 1,269 × 10¹⁰ m = 0,0848 AE ≈ 18 Sonnenradien | [eigene Rechnung] |
| Winkel-Gravitationsradius θ_g = GM/(c²D) | 5,125 ± 0,009 ± 0,020 µas (aus Sternbahnen) | EHT 2022 Paper I (VLTI-Wert) |
| Photonensphäre | r = 1,5 R_s (3 GM/c²) | Schwarzschild-Metrik (Lehrbuch) |
| Schattenradius (kritischer Stoßparameter) | √27 GM/c² ≈ 2,60 R_s; Schatten-Ø ≈ 10 θ_g | Schwarzschild; EHT 2022 Paper I |
| Erwarteter Schatten-Ø | ≈ 53 µas (4,297 × 10⁶ M☉, 8277 pc) | [eigene Rechnung] |
| Gemessener Ring-Ø / Schatten-Ø | 51,8 ± 2,3 µas / 48,7 ± 7,0 µas | EHT 2022 Paper I |
| ISCO (innerste stabile Kreisbahn) | 3 R_s (6 GM/c²), nur ohne Spin | Schwarzschild (Bardeen, Press & Teukolsky 1972) |
| EHT-Bild | λ = 1,3 mm; Rekonstruktions-Strahl 20 µas FWHM; λ/D_Erde ≈ 21 µas | EHT 2022 Paper I; [eigene Rechnung] |
| Spin / Neigung | nicht rotierend und Neigung > 50° von EHT-Modellen abgelehnt | EHT 2022 Paper I |
| S2: Periode, Exzentrizität | 16,0455 ± 0,0013 Jahre · e = 0,884649 ± 0,000079 (2022: 0,88441 ± 0,00006) | GRAVITY 2020; GRAVITY 2022 |
| S2: a, i, ω, Ω, Perizentrum-Zeit | 125,058 ± 0,044 mas · 134,567° · 66,263° · 228,171° · 2018,379 | GRAVITY 2020, Tab. E.1 |
| S2: Perizentrum, Geschwindigkeit | 120 AE ≈ 1400 R_s · ≈ 7650 km/s (Kepler-Rechnung: 119,5 AE, 7750 km/s) | GRAVITY 2018; [eigene Rechnung] |
| S2: Schwarzschild-Präzession | 12′ pro Umlauf, f_SP = 1,10 ± 0,19 (GR = 1) | GRAVITY 2020 |
| Akkretion | heißer, dünner, strahlungsschwacher Fluss (RIAF/ADAF), keine dünne Scheibe | Yuan & Narayan 2014, ARA&A 52, 529 |
| Akkretionsrate | ≈ 10⁻⁹–10⁻⁷ M☉/Jahr (Faraday-Rotation) | Bower et al. 2003; Marrone et al. 2006/2007, zitiert nach arXiv:1805.02652 |
| Magnetfeld | spiralförmig, stark (Polarisation) **[neu 2024–2026]** | EHT 2024, Paper VII/VIII (ApJL) |
| Lichtlaufzeit | ≈ 27 000 Jahre | [eigene Rechnung] |

**Vergleich M87\*:** Ring-Ø 42 ± 3 µas, M = 6,5 ± 0,7 × 10⁹ M☉ bei D = 16,8 ± 0,8 Mpc (EHT 2019 Paper I) → R_s ≈ 128 AE [eigene Rechnung]; Helligkeitsasymmetrie durch relativistisches Beaming.

**Beaming / Rotverschiebung (Shader):**
- Speziell-relativistisch: g = ν_beob/ν_em = 1 / (γ (1 − β cos θ)); I_ν/ν³ ist invariant → Intensität im Band ∝ g³, bolometrisch ∝ g⁴ (Lehrbuch, Rybicki & Lightman 1979; nicht gesondert geprüft).
- Schwarzschild, Gas auf Kreisbahn (geometrisch, G = c = 1): 1/g = 1 + z = (1 − 3M/r)^(−1/2) · (1 + √(M/r³) · b · sin i · sin α) mit b = Stoßparameter, α = Polarwinkel im Bild, i = Neigung. Form wie Luminet 1979 (A&A 75, 228); hier aus u^t = (1 − 3M/r)^(−1/2) und Ω = √(M/r³) nachgerechnet, Originalgleichung nicht eingesehen.
- Hinweis: Sgr A* hat keine dünne Scheibe (RIAF) → „Disk“-Optik wie im Film Interstellar wäre für Sgr A* falsch; dicker, diffuser Ring passt zur EHT-Aufnahme **[Modell]**.

---

## 8. Lokale Gruppe

| Größe | Wert | Quelle |
|---|---|---|
| M31 Entfernung | 761 ± 11 kpc (Cepheiden, HST) · 785 ± 25 kpc (TRGB) | Li et al. 2021; McConnachie et al. 2005 (zitiert in Chemin et al. 2009) |
| M33 Entfernung | 840 ± 11 kpc (Cepheiden) | Breuval et al. 2023, ApJ 951, 118 |
| LMC Entfernung | 49,59 ± 0,09 ± 0,54 kpc | Pietrzyński et al. 2019, Nature 567, 200 |
| SMC Entfernung | 62,44 ± 0,47 ± 0,81 kpc; Tiefe entlang Sichtlinie bis ≈ 7 kpc | Graczyk et al. 2020 |
| Größe (scheinbar) | M31 199,5′ × 70,8′ · M33 60,3′ × 35,5′ · LMC 322,8′ × 274,8′ · SMC 158,1′ × 93,1′ | SIMBAD (M31/M33: Paturel et al. 2003; LMC/SMC: 2014MNRAS.445..881C) |
| Durchmesser (D25, RC3) | M31 ≈ 190′ → ≈ 42 kpc · M33 ≈ 71′ → ≈ 17 kpc · LMC ≈ 646′ → ≈ 9,3 kpc · SMC ≈ 316′ → ≈ 5,7 kpc | de Vaucouleurs et al. 1991 (VizieR VII/155); [eigene Rechnung] |
| Neigung M31 | 74,3 ± 1,1° (HI-Scheibe), optisch 77°; Lage-Winkel 37,7 ± 0,9°; Scheibe verbogen (Warp) | Chemin et al. 2009 |
| Neigung M33 | ≈ 50–54° (Werte je Methode) **[umstritten]** | Corbelli & Salucci 2000; de Vaucouleurs et al. 1991 |
| Neigung LMC | 25,05 ± 0,02 ± 0,55° | Inno et al. 2016 |
| SMC | keine flache Scheibe, stark entlang Sichtlinie gestreckt | Graczyk et al. 2020 |
| M31 Radialgeschwindigkeit (heliozentrisch) | −300 ± 4 km/s | Chemin et al. 2009 (Tab. 1) |
| M31 relativ zur Milchstraße | V_rad = −109,3 ± 4,4 km/s, V_tan = 17 km/s (< 34,3) | van der Marel et al. 2012a |
| M31 V_tan mit Gaia DR2 + HST | 57 (+35/−31) km/s → Bahn weniger radial | van der Marel et al. 2019 |
| Verschmelzung (2012) | erster Vorbeiflug in 3,87 (+0,42/−0,32) Mrd. J., Verschmelzung in 5,86 (+1,61/−0,72) Mrd. J.; direkter Treffer 41 % | van der Marel et al. 2012b |
| Verschmelzung (2025) **[neu 2024–2026]** | ≈ 50 % Wahrscheinlichkeit, dass es in den nächsten 10 Mrd. J. **keine** Verschmelzung gibt; M33 erhöht, LMC senkt die Chance | Sawala et al. 2025, Nature Astronomy |
| Massen | M31: 1,0 × 10¹² M☉ (virial) bzw. 1,2 × 10¹² M☉ · Milchstraße 1,3 ± 0,3 × 10¹² M☉ | Chemin et al. 2009; Corbelli et al. 2010; BHG 2016 |
| Lichtlaufzeit | LMC ≈ 162 000 J. · SMC ≈ 204 000 J. · M31 ≈ 2,48 Mio. J. · M33 ≈ 2,74 Mio. J. | [eigene Rechnung] |

Weitere Neuarbeit: Eigenbewegungen von M31/M33 mit Gaia DR3 (arXiv:2508.01127, 2025) **[neu 2024–2026]**, Inhalt nicht ausgewertet.

---

## 9. Kosmisches Netz / Laniakea

| Größe | Wert | Quelle |
|---|---|---|
| Laniakea Durchmesser | ≈ 12 000 km/s ≈ 160 Mpc (≈ 520 Mio. Lj) | Tully et al. 2014, Nature 513, 71 |
| Laniakea Masse | ≈ 10¹⁷ M☉ | Tully et al. 2014 |
| Grundlage | Pekuliargeschwindigkeiten (Cosmicflows-2), H₀ = 75,2 ± 3,0 km/s/Mpc | Tully et al. 2014 |
| Zentrum („Great Attractor“-Region) | ≈ (−4700, 1300, −500) km/s supergalaktisch → ≈ 4900 km/s ≈ 65 Mpc | Tully et al. 2014; [eigene Rechnung] |
| Laniakea Teil von Shapley? **[neu 2024–2026]** | mit Cosmicflows-4 „leichte“ Bevorzugung: Laniakea gehört zum größeren Shapley-Becken (Pressemitteilung: ≈ 60 %); größtes Becken Sloan Great Wall, 15,5 × 10⁶ (Mpc/h)³ | Valade et al. 2024, Nature Astronomy |
| Anteile (Masse / Volumen) | Knoten 11 % / < 0,1 % · Filamente 50 % / 6 % · Wände 24 % / 18 % · Voids 15 % / 77 % | Cautun et al. 2014 (NEXUS+, Simulation) |
| Streuung je Methode **[umstritten]** | Void-Volumen ≈ 10 % bis ≈ 90 % je nach Definition | Cautun et al. 2014, Tab. 3 |
| Voids | Mittlere Dichte 1 + δ ≈ 0,2 (Simulation); SDSS: Median-Radius 17 h⁻¹ Mpc (≈ 25 Mpc), größter ≈ 30 h⁻¹ Mpc, Füllfaktor 62 % | Cautun et al. 2014; Pan et al. 2012 |
| Filamente | fast gerade Filamente > 100 h⁻¹ Mpc zwischen Haufen | Cautun et al. 2014 |
| BAO-Skala (Schallhorizont r_drag) | 147,09 ± 0,26 Mpc (mitbewegt) ≈ 99,5 h⁻¹ Mpc | Planck 2018 VI; [eigene Rechnung] |
| Voronoi-Modell | Zellwände = Wände, Kanten = Filamente, Ecken = Haufen; Ecken-Korrelation passt zu Abell-Haufen → zulässige Näherung | Icke & van de Weygaert 1987 (A&A 184, 16); van de Weygaert & Icke 1989 (A&A 213, 1 – Band/Seite nicht geprüft); Übersicht van de Weygaert 2007 (arXiv:0707.2877) |
| Lichtlaufzeit (Laniakea-Zentrum) | ≈ 0,2 Mrd. Jahre (z ≈ 0,016) | [eigene Rechnung], Planck-Kosmologie |

---

## 10. Beobachtbares Universum / kosmischer Mikrowellenhintergrund (CMB)

| Größe | Wert | Quelle |
|---|---|---|
| Alter | 13,787 ± 0,020 Mrd. J. (mit BAO) · 13,797 ± 0,023 (ohne BAO) | Planck 2018 VI, Tab. 2 |
| H₀ (Planck) | 67,66 ± 0,42 (mit BAO) · 67,36 ± 0,54 km/s/Mpc | Planck 2018 VI |
| H₀ (SH0ES, Cepheiden) | 73,04 ± 1,04 km/s/Mpc, 5σ zu Planck → **Hubble-Spannung** | Riess et al. 2022 |
| H₀ (CCHP, TRGB) **[neu 2024–2026]** | 70,39 ± 1,22 (stat.) ± 1,33 (sys.) ± 0,70 | Freedman et al. 2025 (arXiv:2408.06153) |
| H₀ (ACT DR6 + Planck + DESI) **[neu 2024–2026]** | 68,22 ± 0,36; mit DESI DR2 68,43 ± 0,27 | Louis et al. 2025 (arXiv:2503.14452) |
| H₀ (H0DN, „Local Distance Network“) **[neu 2024–2026]** | 73,50 ± 0,81 km/s/Mpc, 5–7σ zu Planck | Casertano et al. 2026, A&A – nur Pressemitteilung CfA gelesen |
| Dunkle Energie **[neu 2024–2026, umstritten]** | DESI DR2 bevorzugt zeitlich veränderliche Dunkle Energie mit 2,8–4,2σ | DESI Collab. 2025, PRD 112, 083515 |
| Ω_m / Ω_Λ | 0,3111 ± 0,0056 / 0,6889 ± 0,0056 (mit BAO) | Planck 2018 VI |
| CMB-Temperatur | 2,72548 ± 0,00057 K | Fixsen 2009 |
| Rotverschiebung der Entkopplung z* | 1089,80 ± 0,21 (mit BAO) · 1089,92 ± 0,25 | Planck 2018 VI |
| Zeitpunkt | ≈ 372 000 Jahre nach dem Urknall (ESA rundet: 380 000) | [eigene Rechnung] Friedmann-Integral mit Planck-Werten; ESA Planck-Bildseite |
| Anisotropie | ≈ 30 ± 5 µK (rms, 10°-Glättung) → ΔT/T ≈ 1,1 × 10⁻⁵ | Smoot et al. 1992; [eigene Rechnung] |
| Erster akustischer Peak | ℓ = 220,6 ± 0,6, D_ℓ = 5733 ± 39 µK² (≈ 0,8°, „etwa 1°“) | Planck 2018 I, Tab. 5; [eigene Rechnung] 180°/ℓ |
| Akustische Winkelskala | 100 θ* = 1,04119 ± 0,00029 (θ* ≈ 0,597°) | Planck 2018 VI |
| Dipol | 3362,08 ± 0,99 µK Richtung (l, b) = (264,021 ± 0,011°, 48,253 ± 0,005°); Sonne relativ zum CMB 369,82 ± 0,11 km/s | Planck 2018 I |
| Radius beob. Universum (mitbewegt, Teilchenhorizont) | ≈ 14,16 Gpc ≈ 46,2 Mrd. Lj | [eigene Rechnung] Planck 2018 (mit BAO), Strahlung N_eff = 3,046 |
| Entfernung der CMB-Fläche (mitbewegt) | ≈ 13,88 Gpc ≈ 45,3 Mrd. Lj (Planck: r*/θ* = 13,885 Gpc) | [eigene Rechnung] |
| Blick zurück | Licht ist ≈ 13,79 Mrd. Jahre unterwegs | [eigene Rechnung] |

Prüfung der eigenen Rechnung: das Friedmann-Integral ergibt 13,786 bzw. 13,795 Mrd. Jahre – deckt sich mit Planck (13,787 / 13,797).

---

## 11. HUD „Blick zurück in die Zeit“ (Lichtlaufzeit zur Erde)

| Ebene | Ziel | Entfernung | Lichtlaufzeit |
|---|---|---|---|
| 1 | Mond | 384 400 km | 1,28 s |
| 2 | Sonne · Neptun (von der Sonne) | 1 AE · 30,07 AE | 8,3 min · 4,17 h |
| 3 | Milchstraßenzentrum (Hub) | 8,277 kpc | ≈ 27 000 J. |
| 4 | Orion-Nebel | 390 pc | ≈ 1270 J. |
| 5 | Krebsnebel | 1,90 kpc | ≈ 6200 ± 700 J. (1054 gesehen → geschah ≈ 5150 v. Chr.) |
| 6 | Crab-Pulsar | 1,90 kpc | ≈ 6200 J. |
| 7 | Sgr A* | 8,277 kpc | ≈ 27 000 J. |
| 8 | M31 | 761 kpc | ≈ 2,5 Mio. J. |
| 9 | Laniakea-Zentrum | ≈ 65 Mpc | ≈ 0,2 Mrd. J. |
| 10 | CMB | 45,3 Mrd. Lj (mitbewegt) | ≈ 13,79 Mrd. J. |

Alle Werte [eigene Rechnung] aus den Quellen oben. Ab Ebene 9 unterscheiden sich Lichtlaufzeit und heutige (mitbewegte) Entfernung – im HUD beides nennen.

---

## 12. Bilder/Texturen und Lizenzen

| Quelle | Inhalt | Lizenz / Bedingung | URL |
|---|---|---|---|
| NASA allgemein | Bilder, 3D-Dateien | in den USA meist nicht urheberrechtlich geschützt; „NASA als Quelle nennen“; keine NASA-Logos, keine Werbung mit NASA; Bilder Dritter ausgenommen | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| NASA Blue Marble Next Generation | 12 Monate Echtfarben-Erde (Seite von 2005; Jahr 2004 nur aus Dateinamen), Variante mit Relief/Bathymetrie | NASA-Richtlinie oben; Credit-Zeile auf der Sammelseite nicht angegeben → Produktseite prüfen | https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/ |
| NASA Black Marble 2016 | Nachtlichter, VIIRS/Suomi NPP, 742 m/Pixel; PNG 5760 × 3240 | Credit: „NASA's Goddard Space Flight Center“ | https://svs.gsfc.nasa.gov/30876/ |
| Solar System Scope | Planeten, Erde Tag/Nacht/Wolken/Normal/Specular, Mond, Sonne, Saturnring (PNG mit Alpha), Sterne + Milchstraße; 2K–8K | **CC BY 4.0** („for any purpose, even commercially“); Grundlage NASA-Daten, ungekartete Flächen erfunden | https://www.solarsystemscope.com/textures/ · https://creativecommons.org/licenses/by/4.0/ |
| three.js-Beispieltexturen (`examples/textures/planets`) | Erde, Mond u. a. | Code MIT (`web/vendor/three/LICENSE`); Herkunft/Lizenz der Bilddateien **[nicht belegt]** → nicht verwenden oder vorher klären | https://github.com/mrdoob/three.js |
| ESA/Planck CMB-Karte (2013) | Temperaturkarte | Credit „ESA and the Planck Collaboration“, ESA Standard Licence: nicht-kommerziell frei, kommerziell nur mit schriftlicher Erlaubnis; manche ESA-Bilder CC BY-SA 3.0 IGO | https://www.esa.int/ESA_Multimedia/Images/2013/03/Planck_CMB · https://www.esa.int/ESA_Multimedia/Copyright_Notice_Images |
| NASA/ESA Hubble M1, M42 | Mosaike | NASA-Richtlinie; Credit z. B. „NASA, ESA, J. Hester and A. Loll (Arizona State University)“ (M1) | NASA-Seiten Messier 1/42 |
| Jodrell Bank Pulsar-Töne | Crab `0531.mp3` | keine Lizenz genannt → anfragen | https://www.jb.man.ac.uk/research/pulsar/Education/Sounds/ |
| d3-celestial (Olaf Frohn) | `stars.6.json` (Yale Bright Star Catalogue, 5 044 Sterne bis 6 mag: RA/Dec, V, B−V), `constellations.lines.json` + Namen (88 IAU-Sternbilder) | **BSD-3** (Lizenztext `web/data/LICENSE-d3-celestial.txt`); BSC5 selbst gemeinfrei (Yale) – eingebaut als `web/data/stars.json`, `web/data/constellations.json` (2026-10-25) | https://github.com/ofrohn/d3-celestial |

---

## 13. Darstellung vs. Wirklichkeit (ehrlich kennzeichnen)

| Vereinfachung | Wirklichkeit | Kennzeichnung im HUD (Vorschlag) |
|---|---|---|
| Planeten vergrößert | maßstäblich wären sie bei sichtbaren Bahnen kleiner als ein Pixel (Erde 12 756 km vs. 1 AE = 11 700 Erddurchmesser) | Schalter „Maßstab echt / vergrößert“, Faktor anzeigen |
| Abstände gestaucht (Mond, Planeten) | Mond 30 Erddurchmesser entfernt | „Abstände nicht maßstäblich“ |
| Zeitraffer (Bahnen, Galaxienrotation, Verschmelzung M31) | Galaktisches Jahr ≈ 0,2 Mrd. J.; M31-Begegnung offen (Sawala 2025) | Zeitfaktor sichtbar („1 s = 10 Mio. J.“) |
| Zeitlupe (Pulsar) | 30 Umdrehungen/s | „Zeitlupe ×30 – WCAG 2.3.1“ |
| Nebelfarben aus Schmalbandfiltern | Hubble-Bilder sind Falschfarben (NASA-Seiten sagen das selbst); Auge sieht lichtschwache Nebel fast farblos | „Falschfarben: Linie → Farbe“ mit Legende (Wellenlängen aus Abschnitt 4) |
| Spiralarme der Milchstraße von außen | niemand hat die Milchstraße von außen gesehen; Arme aus Maser-Parallaxen modelliert | „Modell nach Reid et al. 2019“ |
| Sgr A*-Ring | EHT-Bild mit ≈ 20 µas Auflösung, zeitlich gemittelt; Gas ändert sich in Minuten | „Simulation, angelehnt an EHT 2022“ |
| Kosmisches Netz als Voronoi-Gitter | echtes Netz aus Simulationen/Galaxienkarten, keine Zellen | „Näherung (Voronoi-Modell)“ |
| Beobachtbares Universum „von außen“ | es gibt kein Außen; die Kugel ist unser Horizont, jeder Beobachter hat seinen eigenen | „Gedankenbild: Horizont von der Erde aus“ |
| CMB als Kugelschale mit Karte | Karte ist Mollweide-Projektion der Temperatur, ΔT stark überhöht (10⁻⁵) | „Schwankungen ×100 000 verstärkt“ |
| Lichtlaufzeit vs. Entfernung | ab ≈ 100 Mpc verschieden (Expansion) | beide Werte nennen |
| Linsenreflex, Glanzlicht heller Sterne | Kamera-/Augeneffekte, keine Eigenschaft der Objekte | Zahnrad „Farbsaum/Linse“ schaltet ab; Hinweis in der Station Erde |
| Schattenkegel Erde/Mond sichtbar | im Vakuum unsichtbar; Längen aus den Radien gerechnet | Schalter „Schatten“, Text nennt „eigene Rechnung“ |
| Fermi-Blasen, Röntgen-/Radio-Blick Krebsnebel, Hubble-Palette, Infrarot Orion | Falschfarben nach Fermi/Chandra/VLA/Hubble/JWST; Ausdehnung der Komponenten qualitativ | Schalter beschriftet „Gammastrahlung“, „Röntgen“, „Radio“, „Hubble-Palette“, „Infrarot“ |
| Krebsnebel-Expansion gleichmäßig ab 1130 | Hülle wurde beschleunigt (Nugent 1998; Martin et al. 2025: 1105), wird abgebremst werden | Live-Zeile „Rückrechnung/Vorausrechnung“, Hotspot „Expansion“ |
| Milchstraße–Andromeda als Zweikörper-Punktmassen | ausgedehnte Halos, dynamische Reibung, M33, Unsicherheit der Quergeschwindigkeit (Sawala 2025: ≈ 50 %) | Live-Zeile „Modell“, endet beim ersten Vorbeiflug |
| Strömung Laniakea aus Punktmassen | gemessene Geschwindigkeitsfelder (Cosmicflows) sind Grundlage von Tully 2014 | Text „schematisch“ |
| Flare bei Sgr A* als Klumpen in dünner Scheibe | heißer Fleck in dicker, schwacher Strömung; Bahn aus GRAVITY 2018 (≈ 3,5 Rs, ≈ 45 min) | Hotspot „Flare“ nennt Quelle und Modell |
| S2-Bahn in der Szene | Bahnlage aus den Elementen (GRAVITY 2020), Erde in +z gesetzt, Scheibenachse der Darstellung senkrecht dazu | Hinweis in „Darstellung und Quellen“ |
| Pulsarwind, Lichtkurve | Teilchenstrom schematisch; Pulsprofil nach dem optischen Profil, Phase an die gesetzte Erdrichtung gebunden | Hinweis in „Darstellung und Quellen“ |

---

## 14. Neu oder umstritten (2024–2026) – Übersicht
- Milchstraße–Andromeda: Verschmelzung nur ≈ 50 % in 10 Mrd. J. (Sawala et al. 2025) statt „sicher in ≈ 5–6 Mrd. J.“ (van der Marel et al. 2012).
- Laniakea möglicherweise Teil des Shapley-Beckens (Valade et al. 2024).
- Hubble-Spannung: H0DN 73,50 ± 0,81 (2026) vs. CMB 67–68,4; CCHP 70,4 dazwischen; Übersicht Cai et al. 2026 (RAA 26, 084011).
- DESI DR2: Hinweis auf veränderliche Dunkle Energie (2,8–4,2σ, 2025).
- Sgr A*: spiralförmiges Magnetfeld (EHT 2024); 2018-Kampagne Polarisation (arXiv:2604.10287, Preprint 2026, nicht ausgewertet).
- Krebsnebel: ungleichmäßige Expansion, Konvergenz 1105,5 n. Chr. (Martin et al. 2025); neue HST/WFC3-Aufnahmen (Blair et al. 2025).
- R₀: GRAVITY 8277 pc vs. Keck 7946 pc (2019) – ≈ 4 % Unterschied.
- Höhe der Sonne über der Ebene: 5,5 / 20,8 / 25 pc je nach Definition der Ebene.

---

## 15. Quellen

**Fact Sheets und Daten**
- NASA NSSDC: Earth (2024-11-15), Moon (2024-01-11), Sun (2024-05-09), Planetary Fact Sheet (2025-03-18), Saturnian Rings (2022-04-19) – https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- JPL SSD: Approximate Positions of the Planets (Standish & Williams 1992) – https://ssd.jpl.nasa.gov/planets/approx_pos.html
- ATNF Pulsar Catalogue v2.6.1 (Manchester et al. 2005, AJ 129, 1993) – https://www.atnf.csiro.au/research/pulsar/psrcat/
- SIMBAD (CDS) – https://simbad.cds.unistra.fr · RC3 (de Vaucouleurs et al. 1991), VizieR VII/155 · Sharpless 1959, VizieR VII/20
- NIST Atomic Spectra Database – https://physics.nist.gov/asd
- W3C WCAG 2.2, Understanding SC 2.3.1 – https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html

**Erde, Sonnensystem**
- Bruneton & Neyret 2008, Computer Graphics Forum 27(4), 1079–1086; Code: https://github.com/ebruneton/precomputed_atmospheric_scattering
- Mallama, Krobusek & Pavlov 2017, Icarus, doi:10.1016/j.icarus.2016.09.023 (arXiv:1609.05048)
- Cox (Hrsg.) 2000, Allen's Astrophysical Quantities, 4. Aufl., Springer (zitiert nach https://en.wikipedia.org/wiki/Limb_darkening)

**Milchstraße, Sgr A***
- GRAVITY Collab. 2018, A&A 615, L15, doi:10.1051/0004-6361/201833718
- GRAVITY Collab. 2019, A&A 625, L10, doi:10.1051/0004-6361/201935656
- GRAVITY Collab. 2020, A&A 636, L5, doi:10.1051/0004-6361/202037813
- GRAVITY Collab. 2022, A&A 657, L12, doi:10.1051/0004-6361/202142465
- Do et al. 2019, Science 365, 664, doi:10.1126/science.aav8137
- EHT Collab. 2022, ApJL 930, L12 (Sgr A* Paper I), doi:10.3847/2041-8213/ac6674
- EHT Collab. 2019, ApJL 875, L1 (M87* Paper I), doi:10.3847/2041-8213/ab0ec7
- EHT Collab. 2024, ApJL, Sgr A* Paper VII/VIII (Polarisation) – Band/Seite nicht geprüft
- Yuan & Narayan 2014, ARA&A 52, 529, doi:10.1146/annurev-astro-082812-141003
- Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529, doi:10.1146/annurev-astro-081915-023441
- Reid et al. 2019, ApJ 885, 131, doi:10.3847/1538-4357/ab4a11
- Bennett & Bovy 2019, MNRAS 482, 1417, doi:10.1093/mnras/sty2813
- Wegg, Gerhard & Portail 2015, MNRAS, doi:10.1093/mnras/stv745
- Eilers et al. 2019, ApJ, doi:10.3847/1538-4357/aaf648
- Luminet 1979, A&A 75, 228

**Orion, Krebsnebel, Pulsar**
- Menten et al. 2007, A&A 474, 515, doi:10.1051/0004-6361:20078247
- Kounkel et al. 2017, ApJ 834, 142, doi:10.3847/1538-4357/834/2/142
- Maíz Apellániz et al. 2022, A&A 657, A131, doi:10.1051/0004-6361/202142364
- Großschedl et al. 2018, A&A 619, A106, doi:10.1051/0004-6361/201833901
- O'Dell et al. 2009, AJ 137, 367, doi:10.1088/0004-6256/137/1/367
- Kraus et al. 2009 (θ¹ Ori C), arXiv:0902.0365
- Ricci, Robberto & Soderblom 2008, AJ 136, 2136 (arXiv:0808.3336) · Mann et al. 2014, ApJ 784, 82
- Bühler & Blandford 2014, Übersicht Crab (arXiv:1309.7046)
- Lin et al. 2023, ApJ 952, 161, doi:10.3847/1538-4357/acdc98
- Bietenholz & Nugent 2015, MNRAS, doi:10.1093/mnras/stv2112
- Martin et al. 2021, MNRAS, doi:10.1093/mnras/staa4046 · Martin et al. 2025, MNRAS, doi:10.1093/mnras/staf1597
- Blair et al. 2025, ApJ, doi:10.3847/1538-4357/ae2adc
- Owen & Barlow 2015, ApJ 801, 141 · Gomez et al. 2012, ApJ 760, 96
- Lyne et al. 2013, Science 342, 598, doi:10.1126/science.1243254 · Lyne et al. 2015, MNRAS 446, 857, doi:10.1093/mnras/stu2118
- Riley et al. 2019, ApJL 887, L21 · Miller et al. 2019, ApJL 887, L24

**Lokale Gruppe, großräumige Struktur, Kosmologie**
- Li et al. 2021, ApJ, doi:10.3847/1538-4357/ac1597 · Breuval et al. 2023, ApJ 951, 118
- Pietrzyński et al. 2019, Nature 567, 200, doi:10.1038/s41586-019-0999-4 · Graczyk et al. 2020, ApJ, doi:10.3847/1538-4357/abbb2b
- Chemin, Carignan & Foster 2009, ApJ 705, 1395 · Corbelli et al. 2010, A&A 511, A89 · Inno et al. 2016, ApJ 832, 176
- van der Marel et al. 2012a/b, ApJ 753, 8 / 9 · van der Marel et al. 2019, ApJ, doi:10.3847/1538-4357/ab001b
- Sawala et al. 2025, Nature Astronomy, doi:10.1038/s41550-025-02563-1
- Tully et al. 2014, Nature 513, 71, doi:10.1038/nature13674 · Valade et al. 2024, Nature Astronomy, doi:10.1038/s41550-024-02370-0
- Cautun et al. 2014, MNRAS, doi:10.1093/mnras/stu768 · Pan et al. 2012, MNRAS, doi:10.1111/j.1365-2966.2011.20197.x
- Planck Collab. 2020 (2018 results) I: A&A 641, A1, doi:10.1051/0004-6361/201833880 · VI: A&A 641, A6, doi:10.1051/0004-6361/201833910
- Riess et al. 2022, ApJL 934, L7, doi:10.3847/2041-8213/ac5c5b · Freedman et al. 2025 (arXiv:2408.06153) · Louis et al. 2025 (arXiv:2503.14452) · DESI Collab. 2025, PRD 112, 083515
- H0DN/Casertano et al. 2026 – Pressemitteilung: https://www.cfa.harvard.edu/news/scientists-report-most-precise-measurement-yet-universes-expansion
- Cai et al. 2026, RAA 26, 084011, doi:10.1088/1674-4527/ae842f
- Fixsen 2009, ApJ 707, 916, doi:10.1088/0004-637X/707/2/916 · Smoot et al. 1992, ApJ 396, L1

---

## 16. Ausbau der Stationen (2026-10-25): neue Inhalte und ihre Belege

| Station | Neu | Beleg |
|---|---|---|
| Erde & Mond | Sternhimmel aus dem Yale BSC (5 044 Sterne, Farbe aus B−V nach Ballesteros 2012: T = 4600 K·(1/(0,92·BV+1,7) + 1/(0,92·BV+0,62))), 88 Sternbilder mit Linien, 20 Sternnamen mit Entfernungen (Hipparcos/Gaia, gerundet), Schattenkegel (Kernschatten Erde L = r·D/(R☉−r) = 1,38 Mio. km; Mond ≈ 375 000 km), ISS-Bahn (420 km, 51,64°), Wolkenschatten, Airglow (O I 557,7 nm, ≈ 90–100 km), Linsenreflex | d3-celestial/BSC5 · Ballesteros 2012 (EPL 97, 34008) · van Leeuwen 2007 · NASA ISS Facts · NSSDC Fact Sheets |
| Milchstraße | 10 bekannteste Kugelsternhaufen (ω Cen 309,10/14,97/5,2 kpc; 47 Tuc 305,89/−44,89/4,5; M13 59,01/40,91/7,1; M22 9,89/−7,55/3,2; M4 350,97/15,97/2,2; M5 3,86/46,80/7,5; M15 65,01/−27,31/10,4; M3 42,22/78,71/10,2; M2 53,37/−35,77/11,5; M92 68,34/34,86/8,3) + 140 statistische Halo-Haufen (ρ ∝ r⁻³·⁵), Sternhalo (ρ ∝ r⁻³ bis 50 kpc), Sonnenbahn (R₀, ≈ 220 Mio. J.), Sichtlinien, Fermi-Blasen (je ≈ 8 kpc hoch), Arm-Namen Sagittarius/Norma/Lokal | Harris 1996 (2010 edition) · Bland-Hawthorn & Gerhard 2016 · Su, Slatyer & Finkbeiner 2010 (ApJ 724, 1044) · Reid et al. 2019 |
| Orion-Nebel | M43 (≈ 7′ NO, NU Ori B0.5), BN/KL-Region hinter der Front (Explosion vor ≈ 500 J.), Staubfinger, Farbmodi: sichtbar · Hubble-Palette (SHO) · Infrarot (Staub durchsichtig, eingebettete Protosterne) | O'Dell 2001/2009 · Bally et al. 2017 (ApJ 837, 60) |
| Krebsnebel | Spektrum: sichtbar · Röntgen (nur innerer Synchrotronnebel, Torus + Jet) · Radio (Synchrotron bis zum Rand); Jahr-Regler 1054–2600 mit gleichmäßiger Expansion ab dem Konvergenzjahr 1130 ± 16 | Weisskopf et al. 2000 (ApJL 536, L81) · Bühler & Blandford 2014 · Nugent 1998 (PASP 110, 831); neuer: Martin et al. 2025 (1105,5) |
| Crab-Pulsar | Pulsarwind (≈ c, Äquatorband + Jets), Lichtkurve (Hauptpuls, Zwischenpuls bei 0,4 P), Polkappe, Zwischenpuls | Bühler & Blandford 2014 · ATNF |
| Sgr A* | Flare: Fleck auf ≈ 3,5 Rs (7 GM/c²), Umlauf ≈ 42 min nach Kepler (T = 2π√(r³/GM)); S-Stern-Ansicht: S2 mit a = 0,125058″ (≈ 1 035 AE ≈ 12 200 Rs), e = 0,884649, i = 134,567°, Ω = 228,171°, ω = 66,263°, P = 16,0455 a, T₀ = 2018,379; Strahlstart analytisch bei r = 70 Rs; Zentralhaufen | GRAVITY 2018 (A&A 618, L10) · GRAVITY 2020 (A&A 636, L5) · Genzel, Eisenhauer & Gillessen 2010 |
| Lokale Gruppe | 25 Zwerggalaxien mit Namen, M32, Grenze (Nullgeschwindigkeitsfläche ≈ 1 Mpc), Zukunft als Zweikörper-Modell (1,2 + 1,5·10¹² M☉, v_rad −109,3 km/s, v_tan 17 km/s, G = 4,498·10⁻¹² kpc³/(M☉·Myr²); erstes Perizentrum ≈ 3,7 Gyr), ferne Hintergrund-Galaxien | McConnachie 2012 · van der Marel et al. 2012 · Sawala et al. 2025 |
| Kosmisches Netz | 9 Haufen/Superhaufen (l, b, d = cz/H₀ mit H₀ = 70): Virgo 283,8/74,5/16,5 Mpc; Fornax 236,7/−53,6/19; Centaurus 302,4/21,6/49; Hydra 269,6/26,5/54; Norma/GA 325,3/−7,3/68; Perseus 150,6/−13,3/77 (+ Perseus-Pisces-Kette); Coma 58,1/88,0/99; Hercules 31,6/44,5/157; Shapley 312,0/30,7/206; Strömung schematisch (Punktmassen) | Abell, Corwin & Olowin 1989 · NED · Tully et al. 2014 |
| Beobachtbares Universum | ΛCDM numerisch (astro.js `cosmo`): H₀ = 67,66, Ωm = 0,3111, ΩΛ = 0,6889, Ωr = 9,1·10⁻⁵ → Alter 13,786 Gyr, D(z = 1090) = 45,27 Gly, D(z = 14,3) = 33,8 Gly, Alter bei z = 14,3 ≈ 287 Myr; Regler „Blick zurück“ (z, Alter, T = 2,7255·(1+z), mitbewegter Abstand); Zeitschichten z = 0,3 · 2 · 6 · 14,3 · 20 | Planck 2018 VI · Madau & Dickinson 2014 · Bromm 2013 · Carniani et al. 2024 |
| Durchfahrten | Prüfer `tests/flight.py` (alle 17 Flüge: Route, Hinaus, Mehr-Etappen); Befund: Punkt-Sprites wurden beim Durchflug zu 48-px-Klecksen → Nah-Ausblendung in `vol.js`/`galaxy.js` (ab 20–24 px weich auf 0) | eigene Messung 2026-10-25 |

Neue Quellen (Kürzel in `content.js`): `d3-celestial`, `hipparcos`, `ballesteros-2012`, `nasa-iss`, `harris-2010`, `su-2010`, `nugent-1998`, `bally-2017`, `weisskopf-2000`, `gravity-2018b`, `genzel-2010`, `abell-1989`, `madau-2014`, `bromm-2013`.
