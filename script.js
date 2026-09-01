// script.js - drawing toggled by pressing Space (press once to start drawing, press again to snap)

let routeLayer = null;
let markers = [];

function addMessageOverlay(text){
  const existing = document.getElementById('map-overlay');
  if (existing) existing.remove();
  const o = document.createElement('div');
  o.id = 'map-overlay';
  o.innerText = text;
  document.getElementById('map').appendChild(o);
  setTimeout(()=>{ const e = document.getElementById('map-overlay'); if (e) e.remove(); }, 3500);
}

function clearRoute(){
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  markers.forEach(m => map.removeLayer(m)); markers = [];
}

// --- Map initialization ---
const map = L.map('map', { worldCopyJump: true }).setView([56.0, 9.0], 6);
window.map = map;

const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri', maxZoom: 19
});
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 });

esriSat.addTo(map);

// --- Drawing tools (Space toggles draw on/off) ---
let isDrawing = false;
let isMouseDown = false;
let drawnPoints = []; // array of LatLng
let tempLine = null;
let cursorDot = null;

function setDrawing(on){
  if (on === isDrawing) return;
  isDrawing = on;
  if (isDrawing){
    document.body.classList.add('drawing-cursor');
    if (!cursorDot){ cursorDot = document.createElement('div'); cursorDot.className = 'cursor-dot'; document.body.appendChild(cursorDot); }
    cursorDot.style.display = 'block';
    addMessageOverlay('Drawing ON — draw with mouse or touch. Press Space again to snap.');
    // prepare
    drawnPoints = [];
    if (tempLine){ map.removeLayer(tempLine); tempLine = null; }
  } else {
    document.body.classList.remove('drawing-cursor');
    if (cursorDot) cursorDot.style.display = 'none';
    addMessageOverlay('Drawing OFF');
  }
}

map.getContainer().addEventListener('pointerdown', (e)=>{
  if (!isDrawing) return;
  if (e.button !== 0) return;
  isMouseDown = true;
  drawnPoints = [];
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  const p = map.mouseEventToLatLng(e);
  drawnPoints.push(p);
  tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
});

map.getContainer().addEventListener('pointermove', (e)=>{
  if (!isDrawing) return;
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
  if (!isDrawing) return;
  if (e.button !== 0) return;
  isMouseDown = false;
});

// touch fallback
map.getContainer().addEventListener('touchstart', (e)=>{
  if (!isDrawing) return;
  isMouseDown = true;
  drawnPoints = [];
  if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
  const touch = e.touches[0]; const p = map.mouseEventToLatLng(touch);
  drawnPoints.push(p);
  tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
}, {passive:false});
map.getContainer().addEventListener('touchmove', (e)=>{
  if (!isDrawing) return;
  const touch = e.touches[0]; const p = map.mouseEventToLatLng(touch);
  if (!p) return;
  const last = drawnPoints[drawnPoints.length-1];
  if (!last || last.distanceTo(p) > 5){ drawnPoints.push(p); if (tempLine) tempLine.setLatLngs(drawnPoints); }
}, {passive:false});
map.getContainer().addEventListener('touchend', (e)=>{ if (!isDrawing) return; isMouseDown = false; });

// Space press toggles drawing on/off; when turning off we attempt to snap
window.addEventListener('keydown', async (e)=>{
  if (e.code !== 'Space' || e.repeat) return;
  // avoid toggling when typing in an input
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  e.preventDefault();
  if (!isDrawing){
    setDrawing(true);
  } else {
    // If currently drawing, pressing Space again will snap if we have a path
    if (!drawnPoints || drawnPoints.length < 2){
      addMessageOverlay('Draw a path first (hold and drag), then press Space again to snap.');
      setDrawing(false);
      return;
    }
    // Snap
    await snapDrawnPath();
    setDrawing(false);
  }
});

window.addEventListener('keyup', (e)=>{
  // nothing here — we toggle on keydown
});

// snapping: try OSRM Match API first, fallback to Route
async function snapDrawnPath(){
  addMessageOverlay('Snapping drawn path to network...');
  const sample = sampleLatLngs(drawnPoints, 120);
  const coords = sample.map(ll => `${ll.lng},${ll.lat}`).join(';');

  // choose profile
  const trailOn = document.getElementById('trailToggle').checked;
  const roadOn = document.getElementById('roadToggle').checked;
  let profile = 'driving';
  if (trailOn && !roadOn) profile = 'foot';
  else if (trailOn && roadOn) profile = 'foot';

  // Try Match API - better for snapping traces and avoiding small side roads
  const matchUrl = `https://router.project-osrm.org/match/v1/${profile}/${coords}?overview=full&geometries=geojson`;
  try{
    const res = await fetch(matchUrl);
    if (!res.ok) throw new Error('Match network error');
    const j = await res.json();
    if (j.code === 'Ok' && j.matchings && j.matchings.length){
      // choose the longest matching (highest confidence)
      let best = j.matchings.reduce((a,b)=> ( (a && a.geometry && a.geometry.coordinates.length) > (b && b.geometry && b.geometry.coordinates.length) ? a : b));
      if (best && best.geometry){
        clearRoute();
        routeLayer = L.geoJSON(best.geometry, { style: { color: '#ff8c42', weight: 4, opacity: 0.95 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
        addMessageOverlay('Snapped (match) route drawn.');
        if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
        drawnPoints = [];
        return;
      }
    }
    // otherwise fall back
  }catch(err){
    console.warn('Match failed, falling back to route:', err);
  }

  // Fallback: use route endpoint to compute a path visiting sampled points in order
  try{
    const routeUrl = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
    const rres = await fetch(routeUrl);
    if (!rres.ok) throw new Error('Route network error');
    const jr = await rres.json();
    if (jr.code === 'Ok' && jr.routes && jr.routes.length){
      clearRoute();
      routeLayer = L.geoJSON(jr.routes[0].geometry, { style: { color: '#ff8c42', weight: 4, opacity: 0.95 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
      addMessageOverlay('Snapped (route) drawn.');
      if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
      drawnPoints = [];
      return;
    } else {
      throw new Error('No route found');
    }
  }catch(err){
    addMessageOverlay('Snap failed: ' + err.message);
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

  document.getElementById('reset').addEventListener('click', ()=>{
    clearRoute(); if (tempLine) { map.removeLayer(tempLine); tempLine = null; } drawnPoints = []; map.setView([56.0, 9.0], 6); setDrawing(false);
  });

  addMessageOverlay('Ready — press Space to start drawing.');
});
