# Simple Shipping — Satellite Map (Esri World Imagery)

This demo uses free, stationary satellite imagery tiles (Esri World Imagery) and OpenStreetMap street tiles. Esri's World Imagery provides high-resolution satellite imagery tiles suitable for demos and prototypes without requiring an API key.

Files
- index.html — demo page (Leaflet + Esri)
- style.css — layout and controls
- script.js — map initialization, layer toggles, and zoom-to-place buttons

How to run locally
1. Clone the repo:
   git clone https://github.com/arthurkeldnielsen-design/Simple-shipping
   cd Simple-shipping
2. Serve with a simple static server (recommended):
   python3 -m http.server 8000
   Open http://localhost:8000
3. Click a continent or country in the left sidebar to zoom in. Toggle between Satellite and Street.

Deploy to GitHub Pages
- You can host this as a static site using GitHub Pages: go to repository Settings → Pages and set the site source to the `main` branch (root) and save.

Notes about "live" imagery
- Esri World Imagery is not live video; it is periodically updated satellite imagery suitable for demos.
- For true near-real-time imagery you would need commercial providers (Planet, Maxar) or satellite processing APIs (Sentinel Hub), which typically require accounts and API keys.

If you want clickable country outlines (GeoJSON) or a small gameplay mechanic (deliveries, scoring), tell me which and I will add it next.