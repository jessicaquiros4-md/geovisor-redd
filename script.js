// 1. Inicializar mapa (centrado en Costa Rica)
const map = L.map('map').setView([9.7489, -83.7534], 8);

// 2. Mapa Base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

let geojsonLayer;

// 3. Estilo de los polígonos
function styleFeature(feature) {
  return {
    fillColor: '#0d9488',
    weight: 2,
    opacity: 1,
    color: 'white',
    fillOpacity: 0.6
  };
}

// 4. Interacción con el usuario
function onEachFeature(feature, layer) {
  const props = feature.properties;
  
  layer.on({
    mouseover: (e) => {
      e.target.setStyle({ weight: 4, color: '#f59e0b', fillOpacity: 0.8 });
    },
    mouseout: (e) => {
      geojsonLayer.resetStyle(e.target);
    },
    click: (e) => {
      document.getElementById('info-nombre').textContent = props.nombre || props.TERRITORIO || 'Territorio';
      document.getElementById('info-area').textContent = props.area || props.AREA || '0';
    }
  });
}

// 5. Cargar datos del archivo GeoJSON
fetch('datos/territorios.geojson')
  .then(response => response.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style: styleFeature,
      onEachFeature: onEachFeature
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());
  })
  .catch(err => console.error('Error al cargar GeoJSON:', err));