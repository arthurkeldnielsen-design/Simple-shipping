# Simple Shipping — Pathfinding (Car only)

This branch removes the bicycle/trail preference logic and exposes a simple, reliable Car-only pathfinding flow.

What the app now does
- Mode: Car only (driving profile).
- Click the map to set Start (first click) and End (second click). Markers are draggable — moving them updates the route.
- The app requests a route from the public OSRM demo server using the driving profile and draws the fastest route.

What type of road finding this uses
- Routing engine: OSRM (Open Source Routing Machine) public demo at router.project-osrm.org.
- Profile: driving (OSRM driving profile). OSRM computes shortest-travel-time routes using preprocessed OSM data and a routing algorithm (OSRM uses contraction hierarchies to accelerate shortest-path queries on road networks).
- Data: OpenStreetMap (OSM). The routing graph and edge costs are derived from OSM tags (highway, maxspeed, access, surface, etc.). The driving profile favors roads suitable for motor vehicles and accounts for turn costs and speed estimates.
- Request specifics: the app calls the Route API endpoint (route/v1/driving) with overview=full and geometries=geojson, requesting alternatives. OSRM returns candidate routes ordered by travel time; we pick the first (fastest) by default.

Limitations and notes
- This uses the public OSRM demo server (good for testing). It is rate-limited and not guaranteed for production — for robust use host your own OSRM instance or use a commercial provider with SLAs.
- "Driving" routes depend on OSM data quality in the area: if a road is mis-tagged or missing in OSM, the route may take unexpected roads.
- If you need to strictly prefer or avoid certain road classes (e.g., never use tertiary roads, prefer highways), we can post-process alternatives or use a custom routing profile.

Next steps I can implement
- Geocoding (Nominatim) for typed Start/End locations.
- Post-process alternatives using OSM way metadata to avoid/force certain classes.
- Deploy a private OSRM instance with a custom driving profile (strict rules for road classes, speeds, or access restrictions).

How to run locally
1. Pull or refresh the repo.
2. From the repo root run:
   python3 -m http.server 8000
3. Open http://localhost:8000 in your browser.

If you want me to reintroduce bicycle/trail routing with better fidelity, or tune routing choices, tell me which approach you prefer (client-side bias, forced via-points, match/trace flow, or a private routing profile) and I’ll implement it.