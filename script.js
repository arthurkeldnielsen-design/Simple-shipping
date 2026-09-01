// script.js - simplified pathfinding: click to set start/end, choose Car or Bike/Walk

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
  // bike/walk: try bicycle profile first, then fallback to foot
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

// Request route using OSRM public demo
async function requestRoute(){
  if (!startMarker || !endMarker){ showOverlay('Set both Start and End points first', 2000); return; }
  clearRoute();
  const s = startMarker.getLatLng();
  const t = endMarker.getLatLng();
  const selected = getSelectedProfile();

  // build URLs depending on mode
  if (selected === 'driving'){
    const url = `https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
    showOverlay('Routing (car) — finding fastest route on main roads...', 2000);
    try{
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      const j = await res.json();
      if (j.code !== 'Ok' || !j.routes || j.routes.length === 0) throw new Error('No route found');
      // choose the fastest route (OSRM usually returns fastest first)
      const route = j.routes[0].geometry;
      routeLayer = L.geoJSON(route, { style: { color: '#1e90ff', weight: 5, opacity: 0.95 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
      showOverlay('Car route drawn', 1500);
    }catch(err){ showOverlay('Car routing failed: ' + err.message, 3000); }
    return;
  }

  // bike_or_foot: try bicycle profile first (if server supports), otherwise fallback to foot
  // We'll attempt 'bike' then 'foot'. If bicycle not available we'll fallback automatically.
  let tried = false;
  try{
    const bikeUrl = `https://router.project-osrm.org/route/v1/bicycle/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
    tried = true;
    showOverlay('Routing (bike/walk) — trying bicycle profile (prefers smaller ways)...', 2000);
    const rres = await fetch(bikeUrl);
    if (rres.ok){
      const jr = await rres.json();
      if (jr.code === 'Ok' && jr.routes && jr.routes.length){
        // choose the route that is closest to main trails: for simplicity pick first
        const route = jr.routes[0].geometry;
        routeLayer = L.geoJSON(route, { style: { color: '#33cc33', weight: 4, opacity: 0.95 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
        showOverlay('Bike route drawn', 1500);
        return;
      }
    }
  }catch(err){
    console.warn('Bicycle profile failed, falling back to foot:', err);
  }

  // fallback to foot profile (walking/trail)
  try{
    const footUrl = `https://router.project-osrm.org/route/v1/foot/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=true`;
    showOverlay('Routing (bike/walk) — using walking/trail profile...', 2000);
    const fres = await fetch(footUrl);
    if (!fres.ok) throw new Error('Network error');
    const fj = await fres.json();
    if (fj.code !== 'Ok' || !fj.routes || fj.routes.length === 0) throw new Error('No route found');
    const route = fj.routes[0].geometry;
    routeLayer = L.geoJSON(route, { style: { color: '#33cc33', weight: 4, opacity: 0.95 } }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
    showOverlay('Trail route drawn', 1500);
  }catch(err){
    showOverlay('Bike/walk routing failed: ' + err.message, 3000);
  }
}
