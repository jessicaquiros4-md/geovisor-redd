// 1. Inicializar mapa centrado en Costa Rica
const map = L.map('map', {
  center: [9.7489, -83.7534],
  zoom: 8
});

// 2. Capa base OpenStreetMap
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Grupos de Capas Principales
const grupoPuntos = L.layerGroup().addTo(map);

// Control de Capas de Leaflet
const baseMaps = { "Mapa Base": osmLayer };
const overlayMaps = { "Visitas GPS": grupoPuntos };

// Crear el control de capas dinámico
const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);


// --- 3. CARGAR PUNTOS GPS ---
fetch('datos/puntos.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        let popupText = '<b>Punto GPS / Visita</b><br><hr>';
        for (let k in props) {
          popupText += `<b>${k}:</b> ${props[k]}<br>`;
        }
        layer.bindPopup(popupText);
      }
    }).addTo(grupoPuntos);
  })
  .catch(err => console.error('Error cargando puntos:', err));


// --- 4. CARGAR TERRITORIOS Y CREAR CAPA INDIVIDUAL POR CADA UNO ---
fetch('datos/territorios.geojson')
  .then(res => res.json())
  .then(data => {
    if (!data.features || data.features.length === 0) {
      console.error('El archivo territorios.geojson no contiene elementos (features).');
      return;
    }

    const capasIndividualesTerritorios = L.layerGroup().addTo(map);

    data.features.forEach((feature, index) => {
      const props = feature.properties || {};
      
      // Busca el nombre del territorio entre los nombres de columna más comunes de QGIS / FONAFIFO / SNIT
      const nombreTerritorio = props.NOMBRE || props.nombre || props.TERRITORIO || props.territorio || props.NOM_TERR || props.NOM_TERRI || `Territorio ${index + 1}`;
      const areaTerritorio = props.AREA || props.area || props.HECTARES || props.AREA_HA || props.hectareas || 'N/D';

      // Crear capa única para este territorio
      const capaTerritorio = L.geoJSON(feature, {
  style: {
    fillColor: '#0d9488',
    fillOpacity: 0.4,
    color: '#042f2e',       // Color del borde (Verde oscuro)
    weight: 3,              // Grosor de la línea
    opacity: 1              // Opacidad de la línea del borde
  },
  onEachFeature: (feat, layer) => {
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 5, color: '#f59e0b', fillOpacity: 0.7 });
      },
      mouseout: (e) => {
        capaTerritorio.resetStyle(e.target);
      },
      click: (e) => {
        document.getElementById('info-nombre').textContent = nombreTerritorio;
        document.getElementById('info-area').textContent = areaTerritorio;
      }
    });
  }
});

      // Añadir la capa al grupo en el mapa
      capaTerritorio.addTo(capasIndividualesTerritorios);

      // Añadir cada territorio con su nombre propio al selector de capas
      layerControl.addOverlay(capaTerritorio, `🏞️ ${nombreTerritorio}`);
    });

    console.log(`✅ Se cargaron ${data.features.length} territorios individualmente.`);
  })
  .catch(err => console.error('Error cargando territorios:', err));
