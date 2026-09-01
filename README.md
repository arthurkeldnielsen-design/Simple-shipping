# Simple Shipping — Simplified Pathfinding

This update removes the previous freehand draw/snap feature and replaces it with a simple, reliable pathfinding flow:

How it works
- Choose mode: Car or Bike/Walk (radio buttons in the sidebar).
- Click the map to set Start (first click) and End (second click). Markers are draggable — moving them updates the route.
- The app requests a route from the public OSRM demo server:
  - Car mode uses the driving profile (fastest on main roads).
  - Bike/Walk mode attempts the bicycle profile first (to prefer smaller ways/trails) and falls back to the walking/foot profile if needed.
- The route is drawn on the map and the view is fit to it.

Notes & limitations
- This uses the public OSRM demo server (router.project-osrm.org) — it's fine for demos but can be rate-limited or slow. For production, run your own routing server or use a paid provider.
- The routing engine decides what counts as "main roads" or "trails" based on OSM data and the routing profile. We can't force it to only use certain classes without a custom routing backend or filtering heuristics.

Next improvements you might want
- Post-process alternatives: analyze route annotations (way type, surface) and pick the best candidate (e.g. prefer paved main roads for Car and prefer footway/tracks for Bike/Walk).
- Add text-based start/end entry (geocoding) so users can type addresses or place names.
- Add an ‘avoid highways’ toggle or a slider to bias route selection.

How to run locally
1. Pull the repo and run a simple static server from the repo root:
   python3 -m http.server 8000
2. Open http://localhost:8000 in your browser.

If routing fails
- Check DevTools Network for requests to router.project-osrm.org.
- If tiles show "API required" replace the tile URL in script.js or switch to OSM tiles in index.html.
