// script.js - Satellite + Enhance option for maximum tile quality

document.addEventListener('DOMContentLoaded', () => {
  // Create map
  const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);
  window._map = map; // expose for debugging

  // Satellite: Esri World Imagery (good high-resolution tiles)
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19
  });

  // Enhanced satellite layer (tries to request higher-res tiles where available)
  // Uses detectRetina and larger tileSize/zoomOffset hints for retina/high-res tiles
  const esriEnhanced = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 20,
    detectRetina: true,
    tileSize: 512,
    zoomOffset: -1
  });

  // Streets: OpenStreetMap (fallback)
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });

  // Start with satellite layer
  let currentBase = 'sat';
  esriSat.addTo(map);

  // Simple places
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
  const diag = document.getElementById('diag');
  let currentHighlight = null;

  function makeBtn(name, meta){
    const b = document.createElement('button');
    b.className = 'btn ' + (meta.type === 'country' ? 'country' : 'continent');
    b.textContent = name;
    b.onclick = () => {
      clearOverlay();
      if (meta.bounds){
        map.fitBounds(meta.bounds, { padding: [20,20] });
        highlightBounds(meta.bounds);
      } else if (meta.center){
        map.setView(meta.center, meta.zoom || 6, { animate: true });
        highlightCircle(meta.center);
      }
      setTimeout(()=>map.invalidateSize(), 200);
    };
    return b;
  }

  Object.entries(places).forEach(([k,v]) => controls.appendChild(makeBtn(k,v)));

  // UI toggles
  document.getElementById('satToggle').addEventListener('click', () => {
    if (currentBase === 'sat') return;
    removeBaseLayers();
    esriSat.addTo(map);
    currentBase = 'sat';
    clearOverlay();
  });

  document.getElementById('enhance').addEventListener('click', () => {
    if (currentBase === 'enhanced') return;
    removeBaseLayers();
    esriEnhanced.addTo(map);
    currentBase = 'enhanced';
    clearOverlay();
    // optionally zoom in one level to encourage higher-res tiles to load
    const z = map.getZoom();
    if (z < esriEnhanced.options.maxZoom) map.setZoom(Math.min(z+1, esriEnhanced.options.maxZoom));
  });

  document.getElementById('reset').addEventListener('click', () => {
    map.setView([20,0],2);
    if (currentHighlight){ map.removeLayer(currentHighlight); currentHighlight = null; }
    clearOverlay();
    setTimeout(()=>map.invalidateSize(),200);
  });

  function removeBaseLayers(){
    [esriSat, esriEnhanced, osm].forEach(l => { try{ if (map.hasLayer(l)) map.removeLayer(l); }catch(e){} });
  }

  function highlightCircle(center){
    if (currentHighlight) map.removeLayer(currentHighlight);
    currentHighlight = L.circle(center, { radius: 500000, color: '#ff3333', weight: 2, fill:false }).addTo(map);
  }

  function highlightBounds(bounds){
    if (currentHighlight) map.removeLayer(currentHighlight);
    currentHighlight = L.rectangle(bounds, { color: '#33cc33', weight: 2, fill:false }).addTo(map);
  }

  // overlay helpers
  function showOverlay(text){
    clearOverlay();
    const o = document.createElement('div');
    o.id = 'map-overlay';
    o.innerText = text;
    document.getElementById('map').appendChild(o);
    diag.textContent = text;
  }
  function clearOverlay(){
    const ex = document.getElementById('map-overlay'); if (ex) ex.remove(); diag.textContent = '';
  }

  // handle tile errors - try fallback if base fails
  esriEnhanced.on('tileerror', () => {
    showOverlay('Enhanced tiles failed to load. Falling back to standard satellite.');
    removeBaseLayers();
    esriSat.addTo(map);
    currentBase = 'sat';
  });

  esriSat.on('tileerror', () => {
    showOverlay('Satellite tiles failed to load. Falling back to OpenStreetMap.');
    removeBaseLayers();
    osm.addTo(map);
    currentBase = 'osm';
  });

  osm.on('tileerror', () => {
    showOverlay('Tile servers not reachable. Check network or disable blockers.');
  });

  // size fix
  setTimeout(()=>map.invalidateSize(), 200);
  window.addEventListener('resize', ()=> setTimeout(()=>map.invalidateSize(),150));

  // debug click
  map.on('click', e => console.log('Map clicked at', e.latlng));

});
