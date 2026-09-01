// script.js - Satellite map with a simple chat-driven routing feature

// Helper: city waypoints for Denmark (used for 'around denmark')
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
  return points.map(p => p.coord ? (p.coord[0] + ',' + p.coord[1]) : (p[0] + ',' + p[1])).join(';');
}

async function requestOSRMRoute(profile, points){
  try{
    const coords = buildOSRMCoords(points);
    // ask OSRM for a route visiting the points in order
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

// parse chat text into action
function parseAndExecute(text){
  const t = text.toLowerCase();
  // default profile: driving
  let profile = 'driving';
  if (t.includes('walk') || t.includes('walking') || t.includes('trail') || t.includes('hike')) profile = 'foot';

  if (t.includes('around') && t.includes('denmark')){
    addMessage(`Planning a route around Denmark, profile: ${profile}`,'system');
    // use DANISH waypoints
    const points = DENMARK_WAYPOINTS;
    placeMarkers(points);
    // OSRM expects lon,lat pairs; our points already in [lon,lat]
    requestOSRMRoute(profile, points)
      .then(geo => { drawRoute(geo); addMessage('Route drawn.'); })
      .catch(err => { addMessage('Routing failed: ' + err.message); });
    return;
  }

  // simple 'from X to Y' handling could be added, but for now respond with help
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

// UI hookups
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('satToggle').addEventListener('click', ()=>{
    if (!map.hasLayer(esriSat)){ map.addLayer(esriSat); if (map.hasLayer(osm)) map.removeLayer(osm); }
  });

  document.getElementById('reset').addEventListener('click', ()=>{
    clearRoute(); map.setView([56.0, 9.0], 6);
  });

  const send = document.getElementById('send');
  const input = document.getElementById('chatText');
  send.addEventListener('click', ()=>{
    const txt = input.value.trim(); if (!txt) return;
    addMessage(txt,'user'); input.value = '';
    parseAndExecute(txt);
  });
  input.addEventListener('keydown', e=>{ if (e.key === 'Enter'){ send.click(); } });

  addMessage('Hello — ask me to plan simple routes. Try: "around Denmark by car"', 'system');
});
