# Kartendaten KreiswertS – Herkunft, Lizenzen, neu erzeugen

Quellenangabe auf jeder Karte (Pflicht): **© OpenStreetMap-Mitwirkende · © GeoBasis-DE / BKG (2026)** – setzt `grundkarte.js` als Attribution.

| Datei | Inhalt | Quelle | Lizenz |
|---|---|---|---|
| `de.pmtiles` | Grundkarte Deutschland bis Zoom 8 | OpenStreetMap über den Protomaps-Basemap-Build (`build.protomaps.com`, Stand 2026-10-22) | Daten: ODbL 1.0 (OpenStreetMap-Mitwirkende) |
| `region.pmtiles` | Grundkarte Region Kamp-Lintfort (6.33,51.40 – 6.78,51.62) Zoom 9–14 | wie oben | ODbL 1.0 |
| `grenzen/laender.json`, `kreise.json`, `01.json` … `16.json` | Länder, Kreise, Gemeinden je Land (vereinfacht) | BKG VG250 Ebenen, Stand 01.01. (`daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/`) | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2.0) |
| `fonts/` | Schriften für Ortsnamen (Noto Sans, 3 Zeichenbereiche) | `github.com/protomaps/basemaps-assets` | SIL Open Font License 1.1 |

Bibliotheken in `../vendor/`: MapLibre GL JS 6.15 (BSD-3-Clause, `LICENSE-maplibre-gl.txt`), pmtiles 4.5 (BSD-3-Clause, `LICENSE-pmtiles.txt`).

## Neu erzeugen (z. B. andere Region)

- Werkzeuge: pmtiles-CLI `github.com/protomaps/go-pmtiles` (Release v1.31.2, Linux_x86_64); mapshaper (npm, Node ≥ 18)
- Grundkarte, `<U>` = aktueller Build, z. B. `https://build.protomaps.com/20261022.pmtiles`:
  - `pmtiles extract <U> de.pmtiles --bbox=3.6,46.4,16.6,55.6 --maxzoom=8`
  - `pmtiles extract <U> region.pmtiles --bbox=6.33,51.40,6.78,51.62 --minzoom=9 --maxzoom=14` (Rechteck um die Firmen in `daten.js`)
- Grenzen aus `vg250_01-01.utm32s.shape.ebenen.zip`:
  - `mapshaper VG250_LAN.shp -filter 'GF==4' -proj wgs84 -simplify 4% keep-shapes -filter-fields AGS,GEN -o grenzen/laender.json format=geojson precision=0.0001`
  - `mapshaper VG250_KRS.shp -filter 'GF==4' -proj wgs84 -simplify 6% keep-shapes -filter-fields AGS,GEN,BEZ -o grenzen/kreise.json format=geojson precision=0.0001`
  - `mapshaper VG250_GEM.shp -filter 'GF==4' -proj wgs84 -simplify 8% keep-shapes -filter-fields AGS,GEN,BEZ -each 'LAND=AGS.slice(0,2)' -split LAND -o grenzen/ format=geojson precision=0.0001`
- Schriften: `fonts/Noto Sans {Regular,Medium,Italic}/{0-255,256-511,8192-8447}.pbf` aus basemaps-assets
- Testserver ohne Byte-Bereiche (python `http.server`) → `grundkarte.js` lädt jede `.pmtiles` einmal ganz; Startebene der Plattform: `region.ags` in `daten.js`
