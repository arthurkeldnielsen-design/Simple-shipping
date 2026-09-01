# Simple Shipping — World Map Zoom Game

This is a minimal demo game that shows a world map you can zoom in and out on by pressing countries and continents.

Files added:
- index.html — page that loads a Leaflet map and UI
- style.css — simple layout and button styles
- script.js — map logic and zoom-to-place handlers

How to run
1. Open `index.html` in a modern browser (internet connection required to load Leaflet and OpenStreetMap tiles).
2. Click any continent or country on the left to zoom in. Use Reset to go back to the world view.

Notes & next steps
- This is intentionally very small. Next, we can:
  - Add more countries and precise boundaries (GeoJSON) so clicking an actual country on the map selects it.
  - Replace buttons with an in-map UI (clicking shapes) or a search box.
  - Persist player state and add simple gameplay (deliveries, scoring, etc.).

If you'd like, I can add GeoJSON-based country outlines and let you click the map directly to zoom into the country.
