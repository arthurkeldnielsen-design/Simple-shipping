// script.js - simplified pathfinding with improved Bike/Walk preference for trails

let routeLayer = null;
let startMarker = null;
let endMarker = null;

function showOverlay(text, timeout=3000){
  const ex = document.getElementById('map-overlay'); if (ex) ex.remove();
  const o = document.createElement('div'); o.id = 'map-overlay'; o.innerText = text;
  document.getElementById('map').appendChild(o);
  if (timeout>0) setTimeout(()=>{ const e=document.getElementById('map-overlay'); if (e) e.remove(); }, timeout);
}

function clearRoute(){ if (routeLayer){ map.removeLayer(routeLayer); routeLayer = null; } }
function clearMarkers(){ if (startMarker){ map.removeLayer(startMarker); startMarker=null; } if (endMarker){ map.removeLayer(endMarker); endMarker=null; } }

// Map
const map = L.map('map', { worldCopyJump: true }).setView([56.0, 9.0], 6);
window.map = map;

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 19 });
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 });
esriSat.addTo(map);

// UI state
let clickState = 0; // 0 = next click sets start, 1 = next click sets end

function setModeCar(){ document.getElementById('modeCar').checked = true; }
function setModeBike(){ document.getElementById('modeBike').checked = true; }

function getSelectedProfile(){
  if (document.getElementById('modeCar').checked) return 'driving';
  // bike/walk mode uses OSRM bicycle/foot but we will prefer routes that overlap OSM trails
  return 'bike_or_foot';
}

// click to set start/end
map.on('click', async (e)=>{
  if (clickState === 0){
    clearRoute();
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker(e.latlng, { draggable: true }).addTo(map).bindPopup('Start').openPopup();
    startMarker.on('dragend', ()=>{ if (startMarker && endMarker) requestRoute(); });
    clickState = 1;
    showOverlay('Start set — click map to set End', 2000);
  } else {
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker(e.latlng, { draggable: true }).addTo(map).bindPopup('End').openPopup();
    endMarker.on('dragend', ()=>{ if (startMarker && endMarker) requestRoute(); });
    clickState = 0;
    // auto-request route
    await requestRoute();
  }
});

// Reset button
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('reset').addEventListener('click', ()=>{ clearRoute(); clearMarkers(); clickState = 0; showOverlay('Cleared', 1000); });
});

// Helper: get bbox for a GeoJSON LineString or array of coordinates
function coordsBBox(coords){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  coords.forEach(c=>{ const x=c[0], y=c[1]; if (x<minX) minX=x; if (y<minY) minY=y; if (x>maxX) maxX=x; if (y>maxY) maxY=y; });
  return { west:minX, south:minY, east:maxX, north:maxY };
}

// Overpass query to fetch trail-like ways inside bbox
async function fetchTrailsInBBox(south,west,north,east){
  // Overpass QL: fetch ways tagged as path/footway/track/bridleway/pedestrian/steps
  const q = `[out:json][timeout:25];(way[highway~"path|footway|track|bridleway|pedestrian|steps"](${south},${west},${north},${east}););out geom;`;
  try{
    const res = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body: q });
    if (!res.ok) throw new Error('Overpass network error');
    const j = await res.json();
    // convert to array of LineStrings: each element has .geometry with nodes {lat,lon}
    const ways = (j.elements||[]).filter(e=>e.type==='way' && e.geometry).map(w=>({ id:w.id, coords: w.geometry.map(n=>[n.lon, n.lat]) }));
    return ways;
  }catch(err){
    console.warn('Overpass fetch failed:', err); return [];
  }
}

function routeOverlapScore(routeCoords, ways, map){
  // routeCoords: array of [lon,lat]
  // ways: array of { coords: [[lon,lat], ...] }
  if (!ways || ways.length===0) return 0;
  let score = 0;
  const thresholdPx = 10; // how close (in pixels) a route point must be to consider it overlapping a trail
  // precompute way layer points arrays
  const wayPointsArrays = ways.map(w => w.coords.map(c => map.latLngToLayerPoint([c[1], c[0]])));
  for (let i=0;i<routeCoords.length;i+=Math.max(1, Math.floor(routeCoords.length/200))){ // sample up to ~200 points
    const rc = routeCoords[i];
    const pt = map.latLngToLayerPoint([rc[1], rc[0]]);
    let minD = Infinity;
    for (const arr of wayPointsArrays){
      for (let j=1;j<arr.length;j++){
        const d = L.LineUtil.pointToSegmentDistance(pt, arr[j-1], arr[j]);
        if (d < minD) minD = d;
        if (minD <= thresholdPx) break;
      }
      if (minD <= thresholdPx) break;
    }
    if (minD <= thresholdPx) score++;
  }
  return score;
}

// Request route using OSRM public demo
async function requestRoute(){
  if (!startMarker || !endMarker){ showOverlay('Set both Start and End points first', 2000); return; }
  clearRoute();
  const s = startMarker.getLatLng();
  const t = endMarker.getLatLng();
  const selected = getSelectedProfile();

  if (selected === 'driving'){
    const url = `https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
    showOverlay('Routing (car) — finding fastest route on main roads...', 2000);
    try{
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      const j = await res.json();
      if (j.code !== 'Ok' || !j.routes || j.routes.length === 0) throw new Error('No route found');
      const route = j.routes[0].geometry;
      routeLayer = L.geoJSON(route, { style: { color: '#1e90ff', weight: 5, opacity: 0.95 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
      showOverlay('Car route drawn', 1500);
    }catch(err){ showOverlay('Car routing failed: ' + err.message, 3000); }
    return;
  }

  // Bike/Walk: request alternatives and prefer the one that overlaps OSM trails
  try{
    const url = `https://router.project-osrm.org/route/v1/bicycle/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
    showOverlay('Routing (bike) — fetching alternatives...', 2000);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error for bicycle');
    const j = await res.json();
    let routes = [];
    if (j.code === 'Ok' && j.routes && j.routes.length){
      routes = j.routes.map(r=>r.geometry);
    }
    // if no bicycle routes or empty, fall back to foot
    if (!routes || routes.length===0){
      const furl = `https://router.project-osrm.org/route/v1/foot/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
      showOverlay('Bicycle profile not available — trying walking profile...', 2000);
      const fres = await fetch(furl);
      if (!fres.ok) throw new Error('Network error for foot');
      const fj = await fres.json();
      if (fj.code === 'Ok' && fj.routes && fj.routes.length) routes = fj.routes.map(r=>r.geometry);
    }
    if (!routes || routes.length===0) throw new Error('No bike/walk routes found');

    // compute a combined bbox for all routes and fetch nearby trail ways once
    let allCoords = [];
    routes.forEach(rt => { if (rt && rt.coordinates) allCoords = allCoords.concat(rt.coordinates); });
    const bbox = coordsBBox(allCoords);
    // expand bbox by a small margin (~0.02 deg ~2km) to capture nearby trails
    const pad = 0.02;
    const south = Math.max(-90, bbox.south - pad);
    const west = Math.max(-180, bbox.west - pad);
    const north = Math.min(90, bbox.north + pad);
    const east = Math.min(180, bbox.east + pad);

    showOverlay('Fetching nearby trail data (Overpass)...', 2500);
    const ways = await fetchTrailsInBBox(south, west, north, east);

    // score each route by overlap with ways
    let bestIdx = 0; let bestScore = -1;
    for (let i=0;i<routes.length;i++){
      const r = routes[i];
      const score = routeOverlapScore(r.coordinates, ways, map);
      // small heuristic: prefer higher score, break ties by route distance (shorter)
      let dist = 0;
      for (let k=1;k<r.coordinates.length;k++){
        const a = L.latLng(r.coordinates[k-1][1], r.coordinates[k-1][0]);
        const b = L.latLng(r.coordinates[k][1], r.coordinates[k][0]);
        dist += a.distanceTo(b);
      }
      const tie = (score === bestScore) && (dist < (routes[bestIdx] ? routeLength(routes[bestIdx].coordinates) : Infinity));
      if (score > bestScore || tie){ bestScore = score; bestIdx = i; }
    }

    // if bestScore is 0 (no overlap), just pick the shortest route
    if (bestScore <= 0){
      let minIdx = 0; let minDist = Infinity;
      for (let i=0;i<routes.length;i++){ const d = routeLength(routes[i].coordinates); if (d < minDist){ minDist = d; minIdx = i; } }
      bestIdx = minIdx;
    }

    const chosen = routes[bestIdx];
    routeLayer = L.geoJSON(chosen, { style: { color: '#33cc33', weight: 4, opacity: 0.95 } }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
    showOverlay('Bike/Walk route drawn (preferred trails when available)', 1500);

  }catch(err){
    console.warn('Bike/Walk routing error:', err);
    showOverlay('Bike/Walk routing failed: ' + err.message, 3000);
  }
}

function routeLength(coords){
  let d = 0;
  for (let i=1;i<coords.length;i++){ const a=L.latLng(coords[i-1][1],coords[i-1][0]); const b=L.latLng(coords[i][1],coords[i][0]); d += a.distanceTo(b); }
  return d;
}

