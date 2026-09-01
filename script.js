// script.js - simplified pathfinding: Car mode only (driving profile)

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

// Request route using OSRM public demo (driving profile only)
async function requestRoute(){
  if (!startMarker || !endMarker){ showOverlay('Set both Start and End points first', 2000); return; }
  clearRoute();
  const s = startMarker.getLatLng();
  const t = endMarker.getLatLng();

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
}
