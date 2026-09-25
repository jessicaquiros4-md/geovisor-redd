// 1. Inicialización Fila y Centrada en Costa Rica
const map = L.map('map', {
  center: [9.7489, -83.7534],
  zoom: 8,
  zoomControl: true
});

// 2. Capa base OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Forzar actualización del tamaño del contenedor tras cargar la página
window.addEventListener('load', () => {
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
});

// Variable para controlar los estilos
let geojsonLayer;

// --- 3. CARGAR TERRITORIOS INDÍGENAS ---
fetch('datos/territorios.geojson')
  .then(response => {
    if (!response.ok) throw new Error('No se pudo cargar territorios.geojson');
    return response.json();
  })
  .then(data => {
    console.log('✅ Datos de Territorios recibidos:', data);

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
            if (geojsonLayer) geojsonLayer.resetStyle(e.target);
          },
          click: (e) => {
            const props = feature.properties || {};
            const nombre = props.NOMBRE || props.nombre || props.TERRITORIO || props.territorio || 'Territorio Indígena';
            const area = props.AREA || props.area || props.HECTARES || props.hectareas || 'N/D';

            document.getElementById('info-nombre').textContent = nombre;
            document.getElementById('info-area').textContent = area;
          }
        });
      }
    }).addTo(map);

    // Recalcular tamaño de pantalla para evitar distorsiones
    map.invalidateSize();
  })
  .catch(err => console.error('❌ Error en Territorios:', err));


// --- 4. CARGAR PUNTOS GPS ---
fetch('datos/puntos.geojson')
  .then(response => {
    if (!response.ok) throw new Error('No se pudo cargar puntos.geojson');
    return response.json();
  })
  .then(data => {
    console.log('✅ Datos de Puntos recibidos:', data);

    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        let popupText = '<b>Punto GPS / Visita</b><br><hr>';

        for (let clave in props) {
          popupText += `<b>${clave}:</b> ${props[clave]}<br>`;
        }

        layer.bindPopup(popupText);
      }
    }).addTo(map);
  })
  .catch(err => console.error('❌ Error en Puntos GPS:', err));
