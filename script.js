// script.js - controls the map zoom game

const map = L.map('map', {
  worldCopyJump: true
}).setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Define a small set of continents and countries with centers/zoom or bounds
const places = {
  // Continents (use bounds where appropriate)
  'North America': { bounds: [[72, -168], [7, -50]], type: 'continent' },
  'South America': { bounds: [[12, -92], [-56, -34]], type: 'continent' },
  'Europe': { bounds: [[72, -25], [34, 45]], type: 'continent' },
  'Africa': { bounds: [[37, -18], [-35, 52]], type: 'continent' },
  'Asia': { bounds: [[81, 26], [1, 180]], type: 'continent' },
  'Oceania': { bounds: [[-10, 110], [-50, 180]], type: 'continent' },

  // Countries (center + zoom)
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
    if (meta.bounds){
      map.fitBounds(meta.bounds, {padding: [20,20]});
      highlightBounds(meta.bounds);
    } else if (meta.center){
      map.setView(meta.center, meta.zoom || 6, {animate:true});
      highlightCircle(meta.center);
    }
  }
  return btn;
}

for (const [name,meta] of Object.entries(places)){
  controls.appendChild(makeButton(name, meta));
}

// Reset view
document.getElementById('reset').addEventListener('click', ()=>{
  map.setView([20,0],2);
  if (currentHighlight){
    map.removeLayer(currentHighlight);
    currentHighlight = null;
  }
});

function highlightCircle(center){
  if (currentHighlight) map.removeLayer(currentHighlight);
  currentHighlight = L.circle(center, {radius: 500000, color:'#ff3333', weight:2, fill:false}).addTo(map);
}

function highlightBounds(bounds){
  if (currentHighlight) map.removeLayer(currentHighlight);
  currentHighlight = L.rectangle(bounds, {color:'#33cc33', weight:2, fill:false}).addTo(map);
}

// Bonus: clicking on the map will log latlng (useful later to add interactions)
map.on('click', e=>{
  console.log('Map clicked at', e.latlng);
});
