// 1. Inicializar mapa
const map = L.map('map').setView([9.7489, -83.7534], 8);

// Capas base dinámicas
const basemaps = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
  carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; CARTO' }),
  esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '&copy; Esri' })
};

basemaps.osm.addTo(map);

document.getElementById('select-basemap').addEventListener('change', (e) => {
  Object.values(basemaps.toLayers ? basemaps.toLayers() : basemaps).forEach(layer => map.removeLayer(layer));
  basemaps[e.target.value].addTo(map);
});

// Grupos de capas para control independiente
const capaTerritoriosGroup = L.layerGroup().addTo(map);
const capaPuntosGroup = L.layerGroup().addTo(map);

// Estilos de Territorios
const estiloNormal = { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.35 };
const estiloHover = { color: '#0f766e', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.55 };

// Diccionario de colores para las 6 Categorías de Proyectos
const coloresCategorias = {
  "Infraestructura Comunitaria y Social (ICS)": "#2563eb",       // Azul
  "Infraestructura de Servicios Básicos (ISB)": "#dc2626",      // Rojo
  "Educación, Cultura y Juventud (ECJ)": "#d97706",             // Naranja
  "Turismo Sostenible y Emprendimientos Productivos (TEP)": "#16a34a", // Verde
  "Seguridad, Vigilancia y Gestión Ambiental (SVA)": "#9333ea",   // Morado
  "Ayuda Social y Mejoramiento de Infraestructura (ASV)": "#db2777" // Rosado
};

let allLayersSearch = [];

// 2. Cargar Territorios Indígenas
fetch('datos/territorios.geojson')
  .then(res => res.json())
  .then(data => {
    document.getElementById('kpi-territorios').textContent = data.features.length;

    const geoLayer = L.geoJSON(data, {
      style: estiloNormal,
      onEachFeature: (feature, layer) => {
        allLayersSearch.push({ layer, type: 'territorio', name: feature.properties.TERRITORIO });
        layer.on({
          mouseover: (e) => { e.target.setStyle(estiloHover); e.target.bringToFront(); },
          mouseout: (e) => { geoLayer.resetStyle(e.target); },
          click: (e) => {
            map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
            const props = feature.properties || {};

            document.getElementById('info-nombre').textContent = props.TERRITORIO || 'Territorio Indígena';

            // Badges limpios (sin repetir texto)
            const clasif = (props.CLASIF || '').toUpperCase();
            const badgeCref = document.getElementById('badge-cref');
            const badgePaft = document.getElementById('badge-paft');

            if (clasif.includes('CREF')) { badgeCref.textContent = 'CREF'; badgeCref.className = 'tag-programa tag-active'; }
            else { badgeCref.textContent = 'CREF'; badgeCref.className = 'tag-programa tag-inactive'; }

            if (clasif.includes('PAFT')) { badgePaft.textContent = 'PAFT'; badgePaft.className = 'tag-programa tag-active'; }
            else { badgePaft.textContent = 'PAFT'; badgePaft.className = 'tag-programa tag-inactive'; }

            document.getElementById('info-decreto').textContent = props.DECRETO || 'No especificado';
            document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';
            document.getElementById('info-clasif').textContent = props.CLASIF || 'N/D';

            document.getElementById('info-des1').textContent = props['PRIMER DESEMBOLS'] ?? props['PRIMER DESEMBOLSO'] ?? 'N/D';
            document.getElementById('info-des2').textContent = props['GUNDO DESEMBOLS'] ?? props['SEGUNDO DESEMBOLSO'] ?? 'N/D';

            document.getElementById('ae-2018').textContent = props.AE_2018 ?? '-';
            document.getElementById('ae-2019').textContent = props.AE_2019 ?? '-';
            document.getElementById('ae-2020').textContent = props.AE_2020 ?? '-';
            document.getElementById('ae-2021').textContent = props.AE_2021 ?? '-';
            document.getElementById('ae-2022').textContent = props.AE_2022 ?? '-';
            document.getElementById('ae-2023').textContent = props.AE_2023 ?? '-';
            document.getElementById('ae-2024').textContent = props.AE_2024 ?? '-';
          }
        });
      }
    });
    capaTerritoriosGroup.addLayer(geoLayer);
  });

// 3. Cargar Puntos de Proyectos
fetch('datos/puntos.geojson')
  .then(res => res.json())
  .then(data => {
    document.getElementById('kpi-visitas').textContent = data.features.length;

    const puntosLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const cat = feature.properties.categoria || feature.properties.CATEGORIA || 'General';
        const color = coloresCategorias[cat] || '#0f766e';
        return L.circleMarker(latlng, {
          radius: 7,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.95
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const nombreProj = p.nombre || p.NOMBRE || 'Proyecto sin nombre';
        allLayersSearch.push({ layer, type: 'punto', name: nombreProj });

        const catFormateada = p.categoria || p.CATEGORIA || 'Sin clasificación';
        const desc = p.descripcion || p.DESCRIPCION || 'Sin descripción detallada.';
        const territorio = p.territorio || p.TERRITORIO || 'No especificado';
        const fecha = p.fecha || p.FECHA || 'N/D';
        const desembolso = p.desembolso || p.DESEMBOLSO || 'N/D';

        layer.bindPopup(`
          <div class="popup-proyecto">
            <h3>${nombreProj}</h3>
            <p><strong>Territorio:</strong> ${territorio}</p>
            <p><strong>Categoría:</strong> ${catFormateada}</p>
            <p><strong>Descripción:</strong> ${desc}</p>
            <p><strong>Fecha de Visita:</strong> ${fecha}</p>
            <p><strong>Desembolso:</strong> ${desembolso}</p>
            <div class="popup-img-preview">📸 Fotografía no disponible</div>
          </div>
        `);
      }
    });
    capaPuntosGroup.addLayer(puntosLayer);
  });

// 4. Control de Capas Leaflet (Layer Control independiente)
L.control.layers(null, {
  "Territorios Indígenas": capaTerritoriosGroup,
  "Proyectos / Visitas": capaPuntosGroup
}, { collapsed: false }).addTo(map);

// 5. Buscador Rápido
document.getElementById('buscador').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  if (query.length < 2) return;

  const match = allLayersSearch.find(item => item.name && item.name.toLowerCase().includes(query));
  if (match) {
    if (match.type === 'territorio') {
      map.fitBounds(match.layer.getBounds(), { padding: [50, 50] });
      match.layer.fire('click');
    } else {
      map.setView(match.layer.getLatLng(), 15);
      match.layer.openPopup();
    }
  }
});
