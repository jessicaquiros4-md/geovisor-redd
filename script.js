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
  Object.values(basemaps).forEach(layer => map.removeLayer(layer));
  basemaps[e.target.value].addTo(map);
});

// Grupos y Estilos
const capaTerritoriosGroup = L.layerGroup().addTo(map);
const capaPuntosGroup = L.layerGroup().addTo(map);

const estiloNormal = { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.35 };
const estiloHover = { color: '#0f766e', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.55 };

// Colores por categoría (mapeando siglas y textos completos)
const coloresCategorias = {
  "ICS": "#2563eb", "Infraestructura Comunitaria y Social (ICS)": "#2563eb",
  "ISB": "#dc2626", "Infraestructura de Servicios Básicos (ISB)": "#dc2626",
  "ECJ": "#d97706", "Educación, Cultura y Juventud (ECJ)": "#d97706",
  "TEP": "#16a34a", "Turismo Sostenible y Emprendimientos Productivos (TEP)": "#16a34a",
  "SVA": "#9333ea", "Seguridad, Vigilancia y Gestión Ambiental (SVA)": "#9333ea",
  "ASV": "#db2777", "Ayuda Social y Mejoramiento de Infraestructura (ASV)": "#db2777"
};

let allLayersSearch = [];
let puntosLayersList = [];

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

            // Badges limpios corregidos
            const clasif = (props.CLASIF || '').toUpperCase();
            const badgeCref = document.getElementById('badge-cref');
            const badgePaft = document.getElementById('badge-paft');

            if (clasif.includes('CREF')) {
              badgeCref.textContent = 'CREF: Sí';
              badgeCref.className = 'tag-programa tag-active';
            } else {
              badgeCref.textContent = 'CREF: No';
              badgeCref.className = 'tag-programa tag-inactive';
            }

            if (clasif.includes('PAFT')) {
              badgePaft.textContent = 'PAFT: Sí';
              badgePaft.className = 'tag-programa tag-active';
            } else {
              badgePaft.textContent = 'PAFT: No';
              badgePaft.className = 'tag-programa tag-inactive';
            }

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
        const p = feature.properties || {};
        // Busca la categoría independientemente del nombre del campo en el GeoJSON
        const catRaw = p.categoria || p.CATEGORIA || p.Clasificacion || p.CLASIFICACION || p.tipo || 'ICS';
        const color = coloresCategorias[catRaw] || '#0f766e';
        
        const marker = L.circleMarker(latlng, {
          radius: 7,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.95
        });
        
        marker.categoryKey = catRaw;
        puntosLayersList.push({ marker, category: catRaw });
        return marker;
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const nombreProj = p.nombre || p.NOMBRE || p.Proyecto || 'Proyecto sin nombre';
        allLayersSearch.push({ layer, type: 'punto', name: nombreProj });

        const catFormateada = p.categoria || p.CATEGORIA || p.Clasificacion || p.CLASIFICACION || 'General';
        const desc = p.descripcion || p.DESCRIPCION || p.Detalle || 'Sin descripción detallada.';
        const territorio = p.territorio || p.TERRITORIO || 'No especificado';
        const fecha = p.fecha || p.FECHA || p.Fecha || 'N/D';
        const desembolso = p.desembolso || p.DESEMBOLSO || p.Desembolso || 'N/D';

        layer.bindPopup(`
          <div class="popup-proyecto">
            <h3>${nombreProj}</h3>
            <p><strong>Territorio:</strong> ${territorio}</p>
            <p><strong>Categoría del Proyecto:</strong> ${catFormateada}</p>
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

// 4. Filtrado interactivo por checkboxes de categorías
document.querySelectorAll('.cat-filter').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const activeCategories = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value);

    puntosLayersList.forEach(item => {
      const match = activeCategories.some(cat => item.category.includes(cat));
      if (match) {
        if (!capaPuntosGroup.hasLayer(item.marker)) capaPuntosGroup.addLayer(item.marker);
      } else {
        if (capaPuntosGroup.hasLayer(item.marker)) capaPuntosGroup.removeLayer(item.marker);
      }
    });
  });
});

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
