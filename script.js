// 1. Inicializar el mapa centrado exactamente en Costa Rica (Coordenadas [9.7489, -83.7534], Zoom 8)
const map = L.map('map').setView([9.7489, -83.7534], 8);

// 2. Cargar capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Forzar a Leaflet a recalcular el tamaño del contenedor del mapa
setTimeout(() => {
  map.invalidateSize();
}, 500);

let geojsonLayer;

// --- 3. CARGAR TERRITORIOS INDÍGENAS ---
fetch('datos/territorios.geojson')
  .then(response => response.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style: {
        fillColor: '#0d9488',
        weight: 2,
        color: '#ffffff',
        fillOpacity: 0.6
      },
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 4, color: '#f59e0b', fillOpacity: 0.8 });
          },
          mouseout: (e) => {
            geojsonLayer.resetStyle(e.target);
          },
          click: (e) => {
            const props = feature.properties;
            const nombre = props.NOMBRE || props.nombre || props.TERRITORIO || props.territorio || 'Territorio Indígena';
            const area = props.AREA || props.area || props.HECTARES || '0';

            document.getElementById('info-nombre').textContent = nombre;
            document.getElementById('info-area').textContent = area;
          }
        });
      }
    }).addTo(map);

    // Encuadrar automáticamente el zoom sobre los territorios
    if (geojsonLayer.getBounds().isValid()) {
      map.fitBounds(geojsonLayer.getBounds());
    }
  })
  .catch(err => console.error('Error cargando territorios:', err));


// --- 4. CARGAR PUNTOS GPS ---
fetch('datos/puntos.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        let popupText = '<b>Punto GPS / Visita</b><br><hr>';

        for (let clave in props) {
          popupText += `<b>${clave}:</b> ${props[clave]}<br>`;
        }

        layer.bindPopup(popupText);
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error cargando puntos:', err));
