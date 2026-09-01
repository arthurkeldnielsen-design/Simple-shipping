// script.js - add drawing + snapping to roads/trails
// Updated: support holding Space to draw (temporary draw while holding Space), keep Draw button for touch users

// Existing Denmark waypoints for chat routing
const DENMARK_WAYPOINTS = [
  { name: 'Copenhagen', coord: [12.5683, 55.6761] },
  { name: 'Malmö', coord: [13.0038, 55.6050] },
  { name: 'Køge', coord: [12.1806, 55.4590] },
  { name: 'Roskilde', coord: [12.0803, 55.6419] },
  { name: 'Odense', coord: [10.4024, 55.4038] },
  { name: 'Esbjerg', coord: [8.4594, 55.4765] },
  { name: 'Aalborg', coord: [9.9217, 57.0488] },
  { name: 'Aarhus', coord: [10.2039, 56.1629] },
  { name: 'Copenhagen', coord: [12.5683, 55.6761] }
];

let routeLayer = null;
let markers = [];

function addMessage(text, who='system'){
  const m = document.createElement('div');
  m.className = 'message ' + (who === 'user' ? 'user' : 'system');
  m.textContent = text;
  const box = document.getElementById('messages');
  box.appendChild(m);
  box.scrollTop = box.scrollHeight;
}

function clearRoute(){
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  markers.forEach(m => map.removeLayer(m)); markers = [];
}

function buildOSRMCoords(points){
  // OSRM expects lon,lat pairs separated by ;
  return points.map(p => p.coord ? (p.coord[0] + ',' + p.coord[1]) : (p.lng + ',' + p.lat)).join(';');
}

async function requestOSRMRoute(profile, points){
  try{
    const coords = buildOSRMCoords(points);
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
    addMessage('Requesting route from OSRM...', 'system');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response not ok');
    const j = await res.json();
    if (j.code !== 'Ok' || !j.routes || j.routes.length === 0) throw new Error('No route found');
    return j.routes[0].geometry;
  }catch(err){
    throw err;
  }
}

function drawRoute(geojson){
  clearRoute();
  routeLayer = L.geoJSON(geojson, { style: { color: '#ff6b6b', weight: 4, opacity: 0.9 } }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
}

function placeMarkers(points){
  markers = points.map(p => {
    const m = L.circleMarker([p.coord[1], p.coord[0]], { radius:6, color:'#1e90ff', fill:true, fillOpacity:0.9 }).addTo(map);
    m.bindPopup(p.name || `${p.coord[1].toFixed(4)}, ${p.coord[0].toFixed(4)}`);
    return m;
  });
}

// Chat parsing (keeps previous functionality)
function parseAndExecute(text){
  const t = text.toLowerCase();
  let profile = 'driving';
  if (t.includes('walk') || t.includes('walking') || t.includes('trail') || t.includes('hike')) profile = 'foot';

  if (t.includes('around') && t.includes('denmark')){
    addMessage(`Planning a route around Denmark, profile: ${profile}`,'system');
    const points = DENMARK_WAYPOINTS;
    placeMarkers(points);
    requestOSRMRoute(profile, points)
      .then(geo => { drawRoute(geo); addMessage('Route drawn.'); })
      .catch(err => { addMessage('Routing failed: ' + err.message); });
    return;
  }
  addMessage("Sorry — I only support simple 'around <country>' requests right now (try: 'around Denmark by car' or 'around Denmark walking').", 'system');
}

// --- Map initialization ---
const map = L.map('map', { worldCopyJump: true }).setView([56.0, 9.0], 6);
window.map = map;

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri', maxZoom: 19
});
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 });

esriSat.addTo(map);

// --- Drawing tools (Space-held draw) ---
let drawEnabledByButton = false; // toggled by Draw button for touch users
let drawTemporary = false; // active while holding Space
let isDrawMode = false; // derived
let isMouseDown = false;
let drawnPoints = []; // array of LatLng
let tempLine = null;
let cursorDot = null;

function updateDrawModeUI(){
  const should = drawEnabledByButton || drawTemporary;
  if (should === isDrawMode) return; // no change
  isDrawMode = should;
  const body = document.body;
  if (isDrawMode){
    body.classList.add('drawing-cursor');
    if (!cursorDot){ cursorDot = document.createElement('div'); cursorDot.className = 'cursor-dot'; document.body.appendChild(cursorDot); }
    cursorDot.style.display = 'block';
    addMessage('Draw mode ON: hold mouse and drag to draw. Press Enter to snap to roads/trails.', 'system');
  } else {
    body.classList.remove('drawing-cursor');
    if (cursorDot) cursorDot.style.display = 'none';
    addMessage('Draw mode OFF', 'system');
    // cleanup any unfinished drawing
    if (tempLine){ map.removeLayer(tempLine); tempLine = null; }
    drawnPoints = [];
    isMouseDown = false;
  }
}

function enableDrawByButton(enable){ drawEnabledByButton = enable; updateDrawModeUI(); }

// Helper to test if an element should allow space to draw (ignore when typing)
function isTyping(){
  const ae = document.activeElement;
  if (!ae) return false;
  const tag = ae.tagName && ae.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (ae.isContentEditable) return true;
  return false;
}

// pointer/mouse handlers
map.getContainer().addEventListener('pointerdown', (e)=>{
  // only start drawing if draw mode active
  if (!isDrawMode) return;
  // only left button
  if (e.button !== 0) return;
  isMouseDown = true;
  drawnPoints = [];
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  const p = map.mouseEventToLatLng(e);
  drawnPoints.push(p);
  tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
});

map.getContainer().addEventListener('pointermove', (e)=>{
  if (!isDrawMode) return;
  const p = map.mouseEventToLatLng(e);
  if (cursorDot){ cursorDot.style.left = e.clientX + 8 + 'px'; cursorDot.style.top = e.clientY + 8 + 'px'; }
  if (isMouseDown){
    const last = drawnPoints[drawnPoints.length-1];
    if (!last || last.distanceTo(p) > 5){
      drawnPoints.push(p);
      if (tempLine) tempLine.setLatLngs(drawnPoints);
      else tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
    }
  }
});

map.getContainer().addEventListener('pointerup', (e)=>{
  if (!isDrawMode) return;
  if (e.button !== 0) return;
  isMouseDown = false;
});

// touch: pointer events cover touch as well, but keep touch handlers as fallback
map.getContainer().addEventListener('touchstart', (e)=>{
  if (!isDrawMode) return;
  isMouseDown = true;
  drawnPoints = [];
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  const touch = e.touches[0]; const p = map.mouseEventToLatLng(touch);
  drawnPoints.push(p);
  tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
}, {passive:false});
map.getContainer().addEventListener('touchmove', (e)=>{
  if (!isDrawMode) return;
  const touch = e.touches[0]; const p = map.mouseEventToLatLng(touch);
  if (!p) return;
  const last = drawnPoints[drawnPoints.length-1];
  if (!last || last.distanceTo(p) > 5){ drawnPoints.push(p); if (tempLine) tempLine.setLatLngs(drawnPoints); }
}, {passive:false});
map.getContainer().addEventListener('touchend', (e)=>{ if (!isDrawMode) return; isMouseDown = false; });

// keyboard handling: Enter to snap, Esc to cancel, Space hold to draw
window.addEventListener('keydown', (e)=>{
  // ignore repeated events
  if (e.repeat) return;

  // Space to temporarily enable draw (unless typing in an input)
  if (e.code === 'Space'){
    if (isTyping()) return; // don't hijack typing
    // prevent page scrolling while holding space for drawing
    e.preventDefault();
    drawTemporary = true;
    updateDrawModeUI();
    return;
  }

  if (!isDrawMode) return;
  if (e.key === 'Enter'){
    e.preventDefault();
    if (!drawnPoints || drawnPoints.length < 2){ addMessage('Draw a path first (hold Space and drag), then press Enter.', 'system'); return; }
    snapDrawnPath();
  }
  if (e.key === 'Escape'){
    // cancel drawing (only cancel temporary or full)
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
    drawnPoints = [];
    // if draw was only temporary, disabling will be handled on keyup; if button-enabled, keep it
    if (!drawEnabledByButton){ drawTemporary = false; updateDrawModeUI(); }
  }
});

window.addEventListener('keyup', (e)=>{
  if (e.code === 'Space'){
    // release temporary draw
    drawTemporary = false;
    updateDrawModeUI();
  }
});

async function snapDrawnPath(){
  addMessage('Snapping drawn path to network...', 'system');
  // build simple sampling of points to avoid huge URLs
  const sample = sampleLatLngs(drawnPoints, 100); // at most 100 points
  // Build coords in lon,lat for OSRM route
  const coords = sample.map(ll => ({ lng: ll.lng, lat: ll.lat }));
  // decide profile
  const trailOn = document.getElementById('trailToggle').checked;
  const roadOn = document.getElementById('roadToggle').checked;
  let profile = 'driving';
  if (trailOn && !roadOn) profile = 'foot';
  else if (trailOn && roadOn) profile = 'foot'; // prefer trail when both on
  else profile = 'driving';
  try{
    const geo = await requestOSRMRoute(profile, coords);
    // draw snapped route
    clearRoute();
    routeLayer = L.geoJSON(geo, { style: { color: '#ff8c42', weight: 4, opacity: 0.95 } }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
    addMessage('Snapped route drawn.', 'system');
    // cleanup temp draw
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
    drawnPoints = [];
    // If draw was temporary, turn it off now (user released Space anyway)
    if (!drawEnabledByButton){ drawTemporary = false; updateDrawModeUI(); }
  }catch(err){
    addMessage('Snap failed: ' + err.message, 'system');
  }
}

function sampleLatLngs(arr, maxPoints){
  if (arr.length <= maxPoints) return arr.slice();
  const step = Math.ceil(arr.length / maxPoints);
  const out = [];
  for (let i=0;i<arr.length;i+=step) out.push(arr[i]);
  if (out[out.length-1] !== arr[arr.length-1]) out.push(arr[arr.length-1]);
  return out;
}

// --- UI hookups ---
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('satToggle').addEventListener('click', ()=>{
    if (!map.hasLayer(esriSat)){ map.addLayer(esriSat); if (map.hasLayer(osm)) map.removeLayer(osm); }
  });

  // Draw button toggles persistent draw mode (useful for touch devices)
  document.getElementById('drawToggle')?.addEventListener('click', ()=>{
    enableDrawByButton(!drawEnabledByButton);
  });

  document.getElementById('reset').addEventListener('click', ()=>{
    clearRoute(); if (tempLine) { map.removeLayer(tempLine); tempLine = null; } drawnPoints = []; map.setView([56.0, 9.0], 6); drawEnabledByButton = false; updateDrawModeUI();
  });

  const send = document.getElementById('send');
  const input = document.getElementById('chatText');
  send.addEventListener('click', ()=>{
    const txt = input.value.trim(); if (!txt) return;
    addMessage(txt,'user'); input.value = '';
    parseAndExecute(txt);
  });
  input.addEventListener('keydown', e=>{ if (e.key === 'Enter'){ send.click(); } });

  addMessage('Hello — hold Space and draw to sketch a route; press Enter to snap to roads/trails. Use Draw button for touch devices.', 'system');
});
