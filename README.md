# Simple Shipping — Dark Satellite Map

This commit updates the demo to a clean dark UI and ensures free satellite/street tiles are used with fallbacks.

What it includes
- Dark theme (style.css) with a left sidebar and map on the right.
- script.js: Leaflet map using CartoDB Dark tiles as the default base, Esri World Imagery for satellite, and OpenStreetMap as a final fallback.
- Robust tile error handling and a small on-page diagnostic overlay.

How to run locally (free)
1. Clone or pull the repo and open the folder.
2. Serve with a static server (recommended):
   python3 -m http.server 8000
   Open http://localhost:8000

If the map is blank
- Disable adblock/privacy extensions that might block tile hosts.
- Check the browser console for network errors (requests to cartocdn, arcgisonline, or tile.openstreetmap.org).
- Try another network or hotspot if you are behind a firewall.

Next steps (optional)
- Add clickable GeoJSON country outlines for direct map clicks.
- Add a small gameplay loop (deliveries, scoring).
- Deploy to GitHub Pages (free): enable Pages in repo settings to serve the `main` branch.
