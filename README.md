# Simple Shipping — Chat-driven Routing

This update removes the Enhance option and adds a small chat box UI to the sidebar. You can now type simple navigation requests such as:

- "around Denmark by car"
- "around Denmark walking"

How it works
- The chat parser recognizes "around <country>" for Denmark (built-in) and picks a set of waypoints (major cities).
- It sends the waypoint list to the public OSRM demo server (router.project-osrm.org) using the chosen profile: `driving` for roads and `foot` for walking/trails.
- The returned route geometry is drawn on the map and the map view is fit to the route.

Notes and limits
- This is a small demo parser; adding general geocoding would let you accept arbitrary place names. We can integrate Nominatim for free geocoding.
- Routing uses the public OSRM demo server — it's free for testing but subject to usage limits. For production or high-volume use, use your own routing server or a provider with an API key.

If you want me to also add:
- Geocoding (Nominatim) so you can say "around Portugal" and it looks up country bounds automatically.
- Support for arbitrary "from A to B" directions.
- A small "follow walking trails" enhancement that prefers foot profile and shows trailheads.

Tell me which extra features you want and I’ll push them next.