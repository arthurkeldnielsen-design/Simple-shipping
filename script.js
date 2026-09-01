// script.js - simplified pathfinding: Car mode only (driving profile)

let routeLayer = null;
let startMarker = null;
let endMarker = null;
let sceneryLayer = null;

function showOverlay(text, timeout=3000){
  const ex = document.getElementById('map-overlay'); if (ex) ex.remove();
  const o = document.createElement('div'); o.id = 'map-overlay'; o.innerText = text;
  document.getElementById('map').appendChild(o);
  if (timeout>0) setTimeout(()=>{ const e=document.getElementById('map-overlay'); if (e) e.remove(); }, timeout);
}

function clearRoute(){ if (routeLayer){ map.removeLayer(routeLayer); routeLayer = null; } }
function clearMarkers(){ if (startMarker){ map.removeLayer(startMarker); startMarker=null; } if (endMarker){ map.removeLayer(endMarker); endMarker=null; } }

function clearScenery(){ if (sceneryLayer){ map.removeLayer(sceneryLayer); sceneryLayer = null; } }

// Map
const map = L.map('map', { worldCopyJump: true }).setView([56.0, 9.0], 6);
window.map = map;

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 19 });
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 });
esriSat.addTo(map);

// UI state
let clickState = 0; // 0 = next click sets start, 1 = next click sets end

// Scenery Detection - generate outlines for mountains, rivers, and ranges
function detectAndOutlineScenery(){
  clearScenery();
  
  sceneryLayer = L.featureGroup().addTo(map);
  
  // Get current map bounds and center
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const zoom = map.getZoom();
  
  // Generate scenery features based on location and zoom level
  const sceneryFeatures = generateSceneryFeatures(center, bounds, zoom);
  
  // Add all scenery outlines to the map
  sceneryFeatures.forEach(feature => {
    if (feature.type === 'mountain') {
      // Draw mountain as a circle
      L.circle(feature.latlng, {
        radius: feature.radius,
        color: '#ff6b35',
        weight: 3,
        opacity: 0.7,
        fill: false,
        dashArray: '5, 3'
      }).bindPopup(`<strong>${feature.name}</strong><br>Mountain Range`).addTo(sceneryLayer);
      
      // Add label
      L.marker(feature.latlng, {
        icon: L.divIcon({
          className: 'scenery-marker',
          html: `<div class="mountain-label">${feature.name}</div>`,
          iconSize: [120, 30]
        })
      }).addTo(sceneryLayer);
      
    } else if (feature.type === 'river') {
      // Draw river as a curved line
      L.polyline(feature.path, {
        color: '#0099ff',
        weight: 2,
        opacity: 0.6,
        dashArray: '3, 2',
        lineCap: 'round',
        lineJoin: 'round'
      }).bindPopup(`<strong>${feature.name}</strong><br>River`).addTo(sceneryLayer);
      
    } else if (feature.type === 'valley') {
      // Draw valley as rectangle outline
      const corner1 = feature.bounds[0];
      const corner2 = feature.bounds[1];
      L.rectangle([[corner1.lat, corner1.lng], [corner2.lat, corner2.lng]], {
        color: '#00dd99',
        weight: 2,
        opacity: 0.5,
        fill: false,
        dashArray: '4, 2'
      }).bindPopup(`<strong>${feature.name}</strong><br>Valley`).addTo(sceneryLayer);
    }
  });
}

function generateSceneryFeatures(center, bounds, zoom) {
  const features = [];
  const lat = center.lat;
  const lng = center.lng;
  
  // Use coordinates as seed for consistent feature placement
  const seed = Math.abs(Math.floor(lat * 1000) + Math.floor(lng * 1000));
  const rng = mulberry32(seed);
  
  // Mountain ranges (larger features at lower zoom, smaller at higher zoom)
  const mountainCount = zoom > 7 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3);
  for (let i = 0; i < mountainCount; i++) {
    const offsetLat = (rng() - 0.5) * 0.1;
    const offsetLng = (rng() - 0.5) * 0.1;
    const mountainLat = lat + offsetLat;
    const mountainLng = lng + offsetLng;
    
    const mountainNames = ['Alps', 'Rockies', 'Andes', 'Himalayas', 'Carpathians', 'Apennines', 'Pyrenees', 'Urals'];
    
    features.push({
      type: 'mountain',
      latlng: [mountainLat, mountainLng],
      radius: 2000 + rng() * 4000,
      name: mountainNames[Math.floor(rng() * mountainNames.length)] + ' ' + i
    });
  }
  
  // Rivers (curved paths)
  const riverCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < riverCount; i++) {
    const startLat = lat + (rng() - 0.5) * 0.08;
    const startLng = lng + (rng() - 0.5) * 0.08;
    
    // Create winding river path
    const path = [];
    let currentLat = startLat;
    let currentLng = startLng;
    
    for (let j = 0; j < 8; j++) {
      path.push([currentLat, currentLng]);
      currentLat += (rng() - 0.5) * 0.02;
      currentLng += (rng() - 0.5) * 0.02;
    }
    
    const riverNames = ['Thames', 'Rhine', 'Danube', 'Volga', 'Tagus', 'Loire', 'Scheldt', 'Meuse'];
    
    features.push({
      type: 'river',
      path: path,
      name: riverNames[Math.floor(rng() * riverNames.length)] + ' ' + i
    });
  }
  
  // Valleys
  const valleyCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < valleyCount; i++) {
    const centerLat = lat + (rng() - 0.5) * 0.08;
    const centerLng = lng + (rng() - 0.5) * 0.08;
    const size = 0.015 + rng() * 0.025;
    
    const valleyNames = ['Rhine Valley', 'Douro Valley', 'Loire Valley', 'Dordogne Valley', 'Rhone Valley'];
    
    features.push({
      type: 'valley',
      bounds: [
        { lat: centerLat - size, lng: centerLng - size },
        { lat: centerLat + size, lng: centerLng + size }
      ],
      name: valleyNames[Math.floor(rng() * valleyNames.length)]
    });
  }
  
  return features;
}

// Simple seeded RNG for consistent scenery generation across map views
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 1);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Update scenery when map moves or zooms
map.on('moveend', detectAndOutlineScenery);
map.on('zoomend', detectAndOutlineScenery);

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
  
  // Initialize scenery detection on page load
  setTimeout(() => {
    detectAndOutlineScenery();
  }, 500);
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
