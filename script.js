// script.js - simplified pathfinding with trail and driving modes

let routeLayer = null;
let startMarker = null;
let endMarker = null;

// Route mode state
let trailsMode = false;
let drivingMode = true;

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
esriSat.addTo(map);

// UI state
let clickState = 0; // 0 = next click sets start, 1 = next click sets end

// Update route mode display
function updateModeDisplay(){
  const modeEl = document.getElementById('route-mode');
  if (trailsMode && !drivingMode) {
    modeEl.textContent = 'Mode: Trails & Sidewalks';
  } else if (drivingMode && !trailsMode) {
    modeEl.textContent = 'Mode: Driving';
  } else if (trailsMode && drivingMode) {
    modeEl.textContent = 'Mode: Mixed';
  } else {
    modeEl.textContent = 'Mode: None Selected';
  }
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
  
  // Trails mode toggle
  const trailsToggle = document.getElementById('trails-mode');
  trailsToggle.addEventListener('change', (e)=>{
    trailsMode = e.target.checked;
    if (startMarker && endMarker) {
      requestRoute();
    }
    updateModeDisplay();
  });
  
  // Driving mode toggle
  const drivingToggle = document.getElementById('driving-mode');
  drivingToggle.addEventListener('change', (e)=>{
    drivingMode = e.target.checked;
    if (startMarker && endMarker) {
      requestRoute();
    }
    updateModeDisplay();
  });
  
  updateModeDisplay();
});

// Request route using OSRM public demo
async function requestRoute(){
  if (!startMarker || !endMarker){ showOverlay('Set both Start and End points first', 2000); return; }
  
  if (!trailsMode && !drivingMode) {
    showOverlay('Please select at least one mode (Trails or Driving)', 2000);
    return;
  }
  
  clearRoute();
  const s = startMarker.getLatLng();
  const t = endMarker.getLatLng();

  // Route preference logic
  let profile = 'driving';
  let profileDisplay = 'car route';
  let routeColor = '#1e90ff';
  
  if (trailsMode && !drivingMode) {
    // Trails only - use foot profile with option to exclude highways
    profile = 'foot';
    profileDisplay = 'walking route (trails & sidewalks)';
    routeColor = '#00dd88';
  } else if (!trailsMode && drivingMode) {
    // Driving only - use driving profile
    profile = 'driving';
    profileDisplay = 'driving route (roads only)';
    routeColor = '#1e90ff';
  } else if (trailsMode && drivingMode) {
    // Both enabled - prefer smaller roads and trails with bike profile
    profile = 'bike';
    profileDisplay = 'mixed route (all accessible paths)';
    routeColor = '#ffaa00';
  }

  const url = `https://router.project-osrm.org/route/v1/${profile}/${s.lng},${s.lat};${t.lng},${t.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  showOverlay(`Routing (${profileDisplay})...`, 2000);
  
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const j = await res.json();
    if (j.code !== 'Ok' || !j.routes || j.routes.length === 0) throw new Error('No route found');
    
    // Get the best route
    const route = j.routes[0].geometry;
    
    routeLayer = L.geoJSON(route, { 
      style: { 
        color: routeColor, 
        weight: 5, 
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      } 
    }).addTo(map);
    
    map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
    showOverlay(`${profileDisplay} drawn`, 1500);
  }catch(err){ 
    showOverlay(`Route failed: ${err.message}`, 3000); 
  }
}
