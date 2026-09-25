// 1. Inicializar el mapa centrado en Costa Rica
const map = L.map('map', {
  center: [9.7489, -83.7534],
  zoom: 8
});

// 2. Capa base OpenStreetMap
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Grupos de capas para encender/apagar
const capaTerritorios = L.layerGroup().addTo(map);
const capaPuntos = L.layerGroup().addTo(map);

// 3. Añadir el selector de capas arriba a la derecha
const baseMaps = {
  "Mapa Base (OpenStreetMap)": osmLayer
};

const overlayMaps = {
  "Territorios Indígenas": capaTerritorios,
  "Puntos GPS / Visitas": capaPuntos
};

L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);


// --- 4. CARGAR TERRITORIOS INDÍGENAS ---
fetch('datos/territorios.geojson')
  .then(response => {
    if (!response.ok) throw new Error('No se encontró territorios.geojson');
    return response.json();
  })
  .then(data => {
    const territoriosGeoJSON = L.geoJSON(data, {
      style: {
        fillColor: '#0d9488',
        weight: 2,
        color: '#042f2e',
        fillOpacity: 0.5
      },
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 4, color: '#f59e0b', fillOpacity: 0.8 });
          },
          mouseout: (e) => {
            territoriosGeoJSON.resetStyle(e.target);
          },
          click: (e) => {
            const props = feature.properties || {};
            // Intenta leer diferentes posibles nombres de columna
            const nombre = props.NOMBRE || props.nombre || props.TERRITORIO || props.territorio || props.NOM_TERR || 'Territorio Indígena';
            const area = props.AREA || props.area || props.HECTARES || props.hectareas || props.AREA_HA || 'N/D';

            document.getElementById('info-nombre').textContent = nombre;
            document.getElementById('info-area').textContent = area;
          }
        });
      }
    });

    // Agregar al grupo de capas
    capaTerritorios.addLayer(territoriosGeoJSON);
  })
  .catch(err => console.error('Error al cargar Territorios:', err));


// --- 5. CARGAR PUNTOS GPS ---
fetch('datos/puntos.geojson')
  .then(response => {
    if (!response.ok) throw new Error('No se encontró puntos.geojson');
    return response.json();
  })
  .then(data => {
    const puntosGeoJSON = L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        let popupText = '<b>Punto GPS / Visita</b><br><hr>';

        for (let clave in props) {
          popupText += `<b>${clave}:</b> ${props[clave]}<br>`;
        }

        layer.bindPopup(popupText);
      }
    });

    // Agregar al grupo de capas
    capaPuntos.addLayer(puntosGeoJSON);
  })
  .catch(err => console.error('Error al cargar Puntos:', err));
