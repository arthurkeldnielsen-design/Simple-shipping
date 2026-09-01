# Simple Shipping — Draw & Snap

This update adds a drawing tool to the map. You can toggle Draw mode and sketch a path directly on the map. When you press Enter the sketch is snapped to roads or trails (depending on the toggles) using the OSRM routing service.

How to use
- Click "Draw" and hold the mouse button while dragging to sketch a path. On touch devices touch and drag.
- Toggle Road / Trail to indicate preference for snapping (Trail uses OSRM foot profile, Road uses driving).
- Press Enter to snap the sketch to the network and draw the resulting route.
- Press Escape to cancel drawing mode.

Limitations
- Snapping uses the public OSRM demo server and is subject to rate limits; for production use please host your own OSRM instance or use a commercial routing provider.
- Trail snapping quality depends on OSM coverage of walking trails.

Next steps (optional)
- Add geocoding so drawn sketches can be automatically offset/translated by place names.
- Improve snapping by using OSRM Match API to better snap raw GPS traces.
- Allow users to edit snapped routes and save/export GeoJSON.
