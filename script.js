// 1. Inicializar mapa y Panes para garantizar orden de capas (Z-Index estricto)
const map = L.map('map').setView([9.7489, -83.7534], 8);

map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;

map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650; // ¡Garantiza que los puntos queden siempre arriba y clickeables!

// Mapas base
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

// Grupos principales para el control de capas de Leaflet
const capaTerritoriosGroup = L.layerGroup().addTo(map);
const capaPuntosGroup = L.layerGroup().addTo(map);

const estiloNormal = { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.35, pane: 'paneTerritorios' };
const estiloHover = { color: '#0f766e', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.55, pane: 'paneTerritorios' };

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
let chartInstance = null;

// 2. Cargar Territorios Indígenas
fetch('datos/territorios.geojson')
  .then(res => res.json())
  .then(data => {
    document.getElementById('kpi-territorios').textContent = data.features.length;

    const geoLayer = L.geoJSON(data, {
      style: estiloNormal,
      pane: 'paneTerritorios',
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const nombreTerritorio = props.TERRITORIO || props.territorio || props.NOMBRE || 'Territorio Indígena';
        
        allLayersSearch.push({ layer, type: 'territorio', name: nombreTerritorio });

        layer.on({
          mouseover: (e) => { e.target.setStyle(estiloHover); e.target.bringToFront(); },
          mouseout: (e) => { geoLayer.resetStyle(e.target); },
          click: (e) => {
            map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
            document.getElementById('info-nombre').textContent = nombreTerritorio;

            const clasif = (props.CLASIF || props.clasificacion || '').toUpperCase();
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

            document.getElementById('info-decreto').textContent = props.DECRETO || props.decreto || 'No especificado';
            document.getElementById('info-bloque').textContent = props.BLOQUE || props.bloque || 'N/D';
            document.getElementById('info-clasif').textContent = props.CLASIF || props.clasificacion || 'N/D';

            document.getElementById('info-des1').textContent = props['PRIMER DESEMBOLS'] ?? props['PRIMER DESEMBOLSO'] ?? props['desembolso_1'] ?? 'N/D';
            document.getElementById('info-des2').textContent = props['GUNDO DESEMBOLS'] ?? props['SEGUNDO DESEMBOLSO'] ?? props['desembolso_2'] ?? 'N/D';

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

    // Procesar gráfico de visitas por mes basado en fechas reales
    const mesesConteo = {};
    data.features.forEach(f => {
      const p = f.properties || {};
      const fechaStr = p.fecha || p.FECHA || p.Fecha || p.date || '';
      if (fechaStr) {
        const mesAnio = fechaStr.substring(0, 7);
        if (mesAnio.length >= 7) {
          mesesConteo[mesAnio] = (mesesConteo[mesAnio] || 0) + 1;
        }
      }
    });

    const mesesOrdenados = Object.keys(mesesConteo).sort();
    const valoresVisitas = mesesOrdenados.map(m => mesesConteo[m]);

    const ctx = document.getElementById('visitasChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: mesesOrdenados.length ? mesesOrdenados : ['Sin fechas válidas'],
        datasets: [{
          label: 'Visitas',
          data: valoresVisitas.length ? valoresVisitas : [0],
          backgroundColor: '#0f766e',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });

    const puntosLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const p = feature.properties || {};
        const catRaw = p.categoria || p.CATEGORIA || p.Clasificacion || p.CLASIFICACION || p.tipo || 'ICS';
        const color = coloresCategorias[catRaw] || '#0f766e';
        
        const marker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.95,
          pane: 'panePuntos' // Asignado al pane superior
        });
        
        marker.categoryKey = catRaw;
        puntosLayersList.push({ marker, category: catRaw });
        return marker;
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        
        // Mapeo seguro de propiedades (evita textos vacíos)
        const nombreProj = p.nombre || p.NOMBRE || p.Proyecto || p.proyecto || 'Proyecto sin nombre';
        const territorio = p.territorio || p.TERRITORIO || 'No especificado';
        const catFormateada = p.categoria || p.CATEGORIA || p.Clasificacion || p.CLASIFICACION || 'General';
        const desc = p.descripcion || p.DESCRIPCION || p.Detalle || p.detalle || 'Sin descripción detallada.';
        const fecha = p.fecha || p.FECHA || p.Fecha || 'N/D';
        const desembolso = p.desembolso || p.DESEMBOLSO || p.Desembolso || 'N/D';

        // Registrar en el buscador general
        allLayersSearch.push({ layer, type: 'punto', name: nombreProj });

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

// 4. Control de capas estándar de Leaflet (para encender/apagar grupos globales)
L.control.layers(null, {
  "Territorios Indígenas": capaTerritoriosGroup,
  "Proyectos / Visitas": capaPuntosGroup
}, { collapsed: false }).addTo(map);

// 5. Filtrado por Checkboxes de Categorías
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

// 6. Buscador Rápido Global corregido
document.getElementById('buscador').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
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
