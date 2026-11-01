Bürocontainer: eigene 3D-Modelle für die drei Angebote

- buero-3m.glb: 3 × 2,4 m; Fenster links, Tür rechts
- buero-4m.glb: 4 × 2,4 m; Tür links, Doppelfenster rechts
- buero-6m.glb: 6 × 2,4 m; Tür zwischen zwei Fenstern

Alle drei Dateien sind eigenständige glTF-Binary-Modelle mit echten Öffnungen,
PVC-Fensterprofilen, Gläsern, Türbeschlägen, blauen Stahlrahmen, Hebeösen,
feinen Wandprofilen, Dach, Holzfußboden, Innenwänden und Unterkonstruktion.
Die Website lädt je nach Angebotskarte die passende Datei.

Grundlage: die drei Angebotsbilder in bilder/buero/buero-{3,4,6}m.png sowie
die bereitgestellten Fotos für Holzfußboden und weißen Innenausbau.
Die bestätigten Maße sind Länge und Breite. Die Höhe ist vorläufig mit
2,60 m angesetzt; Fenster, Türen und Details wurden aus den Bildern
abgeleitet. Nicht sichtbare Rück- und Seitenflächen sind als geschlossen
angenommen. Dies ist eine Visualisierung, kein vermessenes Bau-/CAD-Modell.
Die Breite des Stahlrahmens ist 2,40 m; Griffe und Fensterbänke stehen vor.

Reproduzierbar erzeugen: node tools/generate-office-models.mjs
Dateien und Fensteröffnungen prüfen: node tools/verify-office-models.mjs
Maße und Öffnungspositionen: office-models.json bzw. officeModels im Skript.

Die früheren Dateien buero-container.glb, lager-container.glb und
modul-container.glb bleiben erhalten und werden von den drei Karten
nicht mehr verwendet.
