// 1. Inicializar el mapa centrado en Costa Rica
const map = L.map('map').setView([9.7489, -83.7534], 8);

// 2. Capa base de mapa (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// Estilo para los territorios
function styleFeature(feature) {
  return {
    fillColor: '#0d9488',
    weight: 2,
    opacity: 1,
    color: '#ffffff',
    fillOpacity: 0.5
  };
}

let geojsonLayer;

// --- 3. CARGAR TERRITORIOS INDÍGENAS ---
fetch('datos/territorios.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('No se encontró datos/territorios.geojson');
    }
    return response.json();
  })
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style: styleFeature,
      onEachFeature: (feature, layer) => {
        const props = feature.properties;

        // Efectos al pasar el ratón
        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 4, color: '#f59e0b', fillOpacity: 0.8 });
          },
          mouseout: (e) => {
            geojsonLayer.resetStyle(e.target);
          },
          click: (e) => {
            // Muestra en el panel lateral
            const nombre = props.NOMBRE || props.nombre || props.TERRITORIO || props.territorio || 'Territorio Indígena';
            const area = props.AREA || props.area || props.HECTARES || '0';

            document.getElementById('info-nombre').textContent = nombre;
            document.getElementById('info-area').textContent = area;
          }
        });
      }
    }).addTo(map);

    // Ajustar vista automáticamente a los territorios
    map.fitBounds(geojsonLayer.getBounds());
  })
  .catch(err => console.error('Error cargando territorios:', err));


// --- 4. CARGAR PUNTOS GPS ---
fetch('datos/puntos.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('No se encontró datos/puntos.geojson');
    }
    return response.json();
  })
  .then(data => {
    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        let popupText = '<b>Punto GPS / Visita</b><br><hr>';

        // Recorrer atributos del punto
        for (let clave in props) {
          popupText += `<b>${clave}:</b> ${props[clave]}<br>`;
        }

        layer.bindPopup(popupText);
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error cargando puntos:', err));
