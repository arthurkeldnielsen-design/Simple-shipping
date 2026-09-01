# Simple Shipping — Dark Satellite Map (updated)

This update removes the old dark basemap option and adds an "Enhance" button that requests higher-resolution satellite tiles when you need maximum quality while zoomed in.

How it works
- Default base: Esri World Imagery (satellite)
- Enhance: switches to an enhanced satellite tile layer that uses detectRetina and tile/zoom hints to request higher-resolution tiles where available. If enhanced tiles fail, it falls back to standard satellite, then OpenStreetMap.

Usage
- Open the page (serve locally or deploy to GitHub Pages).
- Click "Satellite" to ensure standard satellite tiles are used.
- Click "Enhance" to request maximum available tile quality. The map will try to zoom one level in to encourage higher-resolution tiles to load.

Notes
- "Enhance" cannot force new imagery beyond what the provider exposes. For truly higher-resolution commercial imagery you would need a provider/API with explicit high-res tiles or an access token.
- This is implemented with free tile endpoints (Esri and OSM). If you later add a paid provider (Mapbox/Google/Planet) we can wire it into the enhance flow behind an API key.
