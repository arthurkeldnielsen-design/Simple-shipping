// script.js - drawing & improved trail snapping to prefer a single track close to the sketch

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

// --- Drawing tools (Space toggles draw on/off). When drawing is ON, moving the mouse draws without pressing.
let isDrawing = false;
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
    addMessageOverlay('Drawing ON — move the mouse to sketch. Press Space again to snap.');
    // prepare
    drawnPoints = [];
    if (tempLine){ map.removeLayer(tempLine); tempLine = null; }
  } else {
    document.body.classList.remove('drawing-cursor');
    if (cursorDot) cursorDot.style.display = 'none';
    addMessageOverlay('Drawing OFF');
    // cleanup any unfinished drawing
    if (tempLine){ map.removeLayer(tempLine); tempLine = null; }
    drawnPoints = [];
  }
}

// pointermove: when isDrawing, add points continuously (no mouse button required)
map.getContainer().addEventListener('pointermove', (e)=>{
  if (!isDrawing) return;
  // prevent drawing while typing
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

  const p = map.mouseEventToLatLng(e);
  if (!p) return;
  if (cursorDot){ cursorDot.style.left = e.clientX + 8 + 'px'; cursorDot.style.top = e.clientY + 8 + 'px'; }

  const last = drawnPoints[drawnPoints.length-1];
  if (!last || last.distanceTo(p) > 2){ // smaller threshold for smoother freehand
    drawnPoints.push(p);
    if (tempLine) tempLine.setLatLngs(drawnPoints);
    else tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map);
  }
});

// touch fallback: when isDrawing, use touchmove to add points
map.getContainer().addEventListener('touchmove', (e)=>{
  if (!isDrawing) return;
  const touch = e.touches[0]; if (!touch) return;
  const p = map.mouseEventToLatLng(touch);
  if (!p) return;
  const last = drawnPoints[drawnPoints.length-1];
  if (!last || last.distanceTo(p) > 2){ drawnPoints.push(p); if (tempLine) tempLine.setLatLngs(drawnPoints); else tempLine = L.polyline(drawnPoints, { color: '#ff8c42', weight: 3, dashArray: '6 4' }).addTo(map); }
}, {passive:false});

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
      addMessageOverlay('Draw a path first by moving the mouse, then press Space again to snap.');
      setDrawing(false);
      return;
    }
    // Snap
    await snapDrawnPath();
    setDrawing(false);
  }
});

// snapping: try OSRM Match API first, fallback to Route. For trail profile, enforce closeness to the sketch to avoid detours.
async function snapDrawnPath(){
  addMessageOverlay('Snapping drawn path to network...');
  const sample = sampleLatLngs(drawnPoints, 160); // more samples for mouse-move drawing
  const coords = sample.map(ll => `${ll.lng},${ll.lat}`).join(';');

  // choose profile
  const trailOn = document.getElementById('trailToggle').checked;
  const roadOn = document.getElementById('roadToggle').checked;
  let profile = 'driving';
  if (trailOn && !roadOn) profile = 'foot';
  else if (trailOn && roadOn) profile = 'foot';

  // precompute drawn points in layer (pixel) space for distance checks
  const drawnLayerPoints = sample.map(p => map.latLngToLayerPoint(p));
  const thresholdPx = 20; // how close (in pixels) the matched geometry must remain to the sketch (tweakable)

  // Try Match API - better for snapping traces and avoiding small side roads
  const matchUrl = `https://router.project-osrm.org/match/v1/${profile}/${coords}?overview=full&geometries=geojson&annotations=true`;
  try{
    const res = await fetch(matchUrl);
    if (!res.ok) throw new Error('Match network error');
    const j = await res.json();
    if (j.code === 'Ok' && j.matchings && j.matchings.length){
      // choose the matching that stays closest to the sketch and is reasonably long
      let best = null; let bestScore = Infinity;
      for (const m of j.matchings){
        if (!m.geometry || !m.geometry.coordinates) continue;
        const score = scoreMatchingAgainstSketch(m.geometry.coordinates, drawnLayerPoints);
        // lower score is better (mean pixel distance), penalize very short matchings
        const len = m.geometry.coordinates.length;
        const penalized = score * (1 + Math.max(0, 100 - len) / 100); // favor longer matches
        if (penalized < bestScore){ bestScore = penalized; best = m; }
      }
      if (best && best.geometry){
        // prune to the single best contiguous segment close to the sketch
        const pruned = pruneToClosestSegment(best.geometry, drawnLayerPoints, thresholdPx);
        if (pruned && pruned.coordinates && pruned.coordinates.length > 1){
          const final = pruneShortSegments(pruned, 8); // also remove tiny ends (meters)
          clearRoute();
          routeLayer = L.geoJSON(final, { style: { color: '#ff8c42', weight: 4, opacity: 0.95 } }).addTo(map);
          map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
          addMessageOverlay('Snapped (match) route drawn (trail-preferred).');
          if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
          drawnPoints = [];
          return;
        }
      }
    }
    // otherwise fall back
  }catch(err){
    console.warn('Match failed, falling back to route:', err);
  }

  // Fallback: use route endpoint to compute a path visiting sampled points in order, then prune
  try{
    const routeUrl = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
    const rres = await fetch(routeUrl);
    if (!rres.ok) throw new Error('Route network error');
    const jr = await rres.json();
    if (jr.code === 'Ok' && jr.routes && jr.routes.length){
      const pruned = pruneToClosestSegment(jr.routes[0].geometry, drawnLayerPoints, thresholdPx) || jr.routes[0].geometry;
      const final = pruneShortSegments(pruned, 8);
      clearRoute();
      routeLayer = L.geoJSON(final, { style: { color: '#ff8c42', weight: 4, opacity: 0.95 } }).addTo(map);
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

// compute a simple mean distance score (in pixels) between a matching coordinates array and the drawn sketch (layer points)
function scoreMatchingAgainstSketch(matchingCoords, drawnLayerPoints){
  if (!matchingCoords || matchingCoords.length === 0) return Infinity;
  let sum = 0; let count = 0;
  for (const c of matchingCoords){
    const pt = map.latLngToLayerPoint([c[1], c[0]]);
    // compute min distance to drawn segments using Leaflet's LineUtil
    let minD = Infinity;
    for (let i=1;i<drawnLayerPoints.length;i++){
      const d = L.LineUtil.pointToSegmentDistance(pt, drawnLayerPoints[i-1], drawnLayerPoints[i]);
      if (d < minD) minD = d;
    }
    if (minD === Infinity) minD = 9999;
    sum += minD; count++;
  }
  return sum / Math.max(1, count);
}

// pruneToClosestSegment: given a LineString geometry and the drawnLayerPoints, extract the largest contiguous subsequence of coordinates that stays within thresholdPx to the drawn sketch
function pruneToClosestSegment(geometry, drawnLayerPoints, thresholdPx){
  if (!geometry || !geometry.coordinates || geometry.coordinates.length === 0) return null;
  const coords = geometry.coordinates;
  const keep = new Array(coords.length).fill(false);
  for (let i=0;i<coords.length;i++){
    const pt = map.latLngToLayerPoint([coords[i][1], coords[i][0]]);
    // compute min distance to drawn segments
    let minD = Infinity;
    for (let j=1;j<drawnLayerPoints.length;j++){
      const d = L.LineUtil.pointToSegmentDistance(pt, drawnLayerPoints[j-1], drawnLayerPoints[j]);
      if (d < minD) minD = d;
    }
    if (minD <= thresholdPx) keep[i] = true;
  }
  // find the longest contiguous run of true in keep[]
  let bestStart = 0, bestLen = 0;
  let curStart = -1, curLen = 0;
  for (let i=0;i<keep.length;i++){
    if (keep[i]){
      if (curStart === -1) curStart = i; curLen++;
    } else {
      if (curLen > bestLen){ bestLen = curLen; bestStart = curStart; }
      curStart = -1; curLen = 0;
    }
  }
  if (curLen > bestLen){ bestLen = curLen; bestStart = curStart; }
  if (bestLen <= 1) return null; // nothing meaningful
  const outCoords = coords.slice(bestStart, bestStart + bestLen);
  return { type: 'LineString', coordinates: outCoords };
}

// pruneShortSegments: removes tiny distances at start/end shorter than thresholdMeters
function pruneShortSegments(geojson, thresholdMeters){
  function lengthBetween(a,b){
    const latlngA = L.latLng(a[1], a[0]);
    const latlngB = L.latLng(b[1], b[0]);
    return latlngA.distanceTo(latlngB);
  }

  if (!geojson) return geojson;
  if (geojson.type === 'LineString'){
    let coords = geojson.coordinates.slice();
    // prune from start
    let startRemoved = 0;
    let acc = 0;
    for (let i=1;i<coords.length;i++){
      acc += lengthBetween(coords[i-1], coords[i]);
      if (acc > thresholdMeters) break;
      startRemoved = i;
    }
    if (startRemoved) coords = coords.slice(startRemoved);
    // prune from end
    acc = 0; let endRemoved = 0;
    for (let i=coords.length-1;i>0;i--){
      acc += lengthBetween(coords[i], coords[i-1]);
      if (acc > thresholdMeters) break;
      endRemoved = coords.length - i;
    }
    if (endRemoved) coords = coords.slice(0, coords.length - endRemoved);
    return { type: 'LineString', coordinates: coords };
  }
  return geojson;
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

  addMessageOverlay('Ready — check the "Enable drawing" checkbox and press Space to start drawing.');
});
