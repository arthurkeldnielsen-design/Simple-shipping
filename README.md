# Simple Shipping — Satellite Map Demo

This replaces the previous demo. It uses Esri World Imagery tiles for satellite imagery and OpenStreetMap tiles for streets.

Important notes
- "Live satellite footage" (real-time video from satellites) is not available as free browser tiles. This demo uses high-resolution satellite imagery tiles (Esri World Imagery) which are updated periodically but are not live.
- If you need near-real-time or frequently updated imagery, you must use specialized APIs (Planet, Maxar, Sentinel hub) which typically require an API key and processing.

How to run
1. Open `index.html` in a modern browser (internet required for tiles).
2. Or run a local server from the repo folder to avoid some browser restrictions:
   python3 -m http.server 8000
   then open http://localhost:8000

What I changed
- Replaced project files with a fresh demo that:
  - Shows satellite tiles by default (Esri)
  - Lets you toggle to street tiles (OpenStreetMap)
  - Keeps the continent/country buttons for zooming
  - Adds error overlay and robust initialization

If you want real-time imagery or a specific provider (Mapbox/Google/Planet), tell me which provider and whether you have an API key — I can integrate that instead. Otherwise I can also add clickable GeoJSON outlines so you can click countries directly to zoom (instead of buttons).