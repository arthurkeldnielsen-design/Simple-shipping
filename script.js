// script.js - Satellite + Street layers, safe initialization

document.addEventListener('DOMContentLoaded', () => {
  // initialize map
  const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);

  // Satellite: Esri World Imagery (good high-resolution tiles; not live video)
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
    maxZoom: 19
  });

  // Streets: OpenStreetMap
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });

  // start with satellite layer
  esriSat.addTo(map);

  // layer variables for toggles
  let currentBase = 'satellite';

  // Simple places to zoom to
  const places = {
    'North America': { bounds: [[72, -168], [7, -50]], type: 'continent' },
    'South America': { bounds: [[12, -92], [-56, -34]], type: 'continent' },
    'Europe': { bounds: [[72, -25], [34, 45]], type: 'continent' },
    'Africa': { bounds: [[37, -18], [-35, 52]], type: 'continent' },
    'Asia': { bounds: [[81, 26], [1, 180]], type: 'continent' },
    'Oceania': { bounds: [[-10, 110], [-50, 180]], type: 'continent' },

    'United States': { center: [39.0, -98.5], zoom: 4, type: 'country' },
    'Brazil': { center: [-14.2, -51.9], zoom: 4, type: 'country' },
    'India': { center: [21.0, 78.0], zoom: 5, type: 'country' },
    'Australia': { center: [-25.0, 133.0], zoom: 4, type: 'country' },
    'France': { center: [46.5, 2.5], zoom: 6, type: 'country' },
    'South Africa': { center: [-30.6, 22.9], zoom: 5, type: 'country' }
  };

  const controls = document.getElementById('controls');
  let currentHighlight;

  function makeButton(name, meta){
    const btn = document.createElement('button');
    btn.className = 'button-item ' + (meta.type === 'country' ? 'country' : 'continent');
    btn.textContent = name;
    btn.onclick = () => {
      clearMapOverlay();
      if (meta.bounds){
        map.fitBounds(meta.bounds, {padding: [20,20]});
        highlightBounds(meta.bounds);
      } else if (meta.center){
        map.setView(meta.center, meta.zoom || 6, {animate:true});
        highlightCircle(meta.center);
      }
      setTimeout(()=>map.invalidateSize(), 200);
    }
    return btn;
  }

  for (const [name,meta] of Object.entries(places)){
    controls.appendChild(makeButton(name, meta));
  }

  // toggles
  document.getElementById('satToggle').addEventListener('click', ()=>{
    if (currentBase === 'satellite') return;
    map.eachLayer(layer => { if (layer === osm) map.removeLayer(layer); });
    esriSat.addTo(map);
    currentBase = 'satellite';
  });

  document.getElementById('streetToggle').addEventListener('click', ()=>{
    if (currentBase === 'street') return;
    map.eachLayer(layer => { if (layer === esriSat) map.removeLayer(layer); });
    osm.addTo(map);
    currentBase = 'street';
  });

  document.getElementById('reset').addEventListener('click', ()=>{
    map.setView([20,0],2);
    if (currentHighlight){ map.removeLayer(currentHighlight); currentHighlight = null; }
    clearMapOverlay();
    setTimeout(()=>map.invalidateSize(), 200);
  });

  function highlightCircle(center){
    if (currentHighlight) map.removeLayer(currentHighlight);
    currentHighlight = L.circle(center, {radius: 500000, color:'#ff3333', weight:2, fill:false}).addTo(map);
  }

  function highlightBounds(bounds){
    if (currentHighlight) map.removeLayer(currentHighlight);
    currentHighlight = L.rectangle(bounds, {color:'#33cc33', weight:2, fill:false}).addTo(map);
  }

  // overlay helpers
  function showMapOverlay(text){
    clearMapOverlay();
    const o = document.createElement('div');
    o.id = 'map-overlay';
    o.innerText = text;
    document.getElementById('map').appendChild(o);
  }

  function clearMapOverlay(){
    const existing = document.getElementById('map-overlay');
    if (existing) existing.remove();
  }

  // handle tile errors (network or blocked)
  esriSat.on('tileerror', ()=> showMapOverlay('Satellite tiles failed to load. Check network or try a local server.'));
  osm.on('tileerror', ()=> showMapOverlay('Street tiles failed to load.'));

  // ensure correct size
  setTimeout(()=>map.invalidateSize(), 200);
  window.addEventListener('resize', ()=> setTimeout(()=>map.invalidateSize(),150));

  // debug
  map.on('click', e=> console.log('Map clicked at', e.latlng));
  window._map = map;
});
