// ======================================================
// 1. INICIALIZACIÓN DEL MAPA
// ======================================================
 
const map = L.map('map', {
  zoomControl: true
}).setView([9.25, -83.25], 8);
 
map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;
 
map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650;
 
 
// ======================================================
// 2. MAPAS BASE
// ======================================================
 
const basemaps = {
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }
  ),
 
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 20,
      attribution: '&copy; CARTO'
    }
  ),
 
  esri: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: '&copy; Esri'
    }
  )
};
 
basemaps.osm.addTo(map);
 
document.getElementById('select-basemap').addEventListener('change', e => {
  Object.values(basemaps).forEach(layer => {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  });
 
  basemaps[e.target.value].addTo(map);
});
 
 
// ======================================================
// 3. ESTILOS DE TERRITORIOS
// ======================================================
 
const estiloNormal = {
  color: '#0f766e',
  weight: 1.5,
  fillColor: '#14b8a6',
  fillOpacity: 0.30,
  pane: 'paneTerritorios'
};
 
const estiloHover = {
  color: '#0b514b',
  weight: 3,
  fillColor: '#2dd4bf',
  fillOpacity: 0.48,
  pane: 'paneTerritorios'
};
 
 
// ======================================================
// 4. COLORES POR CATEGORÍA
// ======================================================
 
const coloresCategorias = {
  'infraestructura comunitaria y social': '#2563eb',
  'infraestructura de servicios basicos': '#dc2626',
  'educacion, cultura y juventud': '#d97706',
  'turismo sostenible y emprendimientos productivos': '#16a34a',
  'seguridad, vigilancia y gestion ambiental': '#9333ea',
  'ayuda social y mejoramiento de infraestructura': '#db2777'
};
 
 
// ======================================================
// 5. ICONOS SVG PERSONALIZADOS
// ======================================================
 
const gruposSVG = {
  educacion:
    '<path d="M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6"/>',
 
  ambiental:
    '<path d="M20.5 3.5C11 3.5 5 6.5 5 13a5 5 0 0 0 5 5c6.5 0 9.5-6 10.5-14.5ZM4 21c2.5-5 6-8 11-11"/>',
 
  infraestructura:
    '<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6"/>',
 
  turismo:
    '<path d="M3 12 12 4l9 8M5 11v9h14v-9M9 20v-5h6v5"/>',
 
  general:
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'
};
 
 
// ======================================================
// 6. FUNCIONES AUXILIARES
// ======================================================
 
const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
 
const isEmpty = value =>
  value === undefined ||
  value === null ||
  String(value).trim() === '';
 
const formatNumber = value => {
  if (isEmpty(value)) return '';
 
  const n = Number(String(value).replace(/[,₡$\s]/g, ''));
 
  return Number.isFinite(n)
    ? n.toLocaleString('es-CR', { maximumFractionDigits: 2 })
    : escapeHTML(value);
};
 
const formatDate = value => {
  if (isEmpty(value)) return '';
 
  const text = String(value).trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
 
  return m ? `${m[3]}/${m[2]}/${m[1]}` : escapeHTML(text);
};
 
const getYear = value => {
  if (isEmpty(value)) return null;
 
  const text = String(value).trim();
 
  // Primero reconoce fechas ISO: YYYY-MM-DD.
  let match = text.match(/^((?:19|20)\d{2})-\d{1,2}-\d{1,2}/);
  if (match) return Number(match[1]);
 
  // También acepta fechas como DD/MM/YYYY o DD-MM-YYYY.
  match = text.match(/(?:^|[^\d])\d{1,2}[/-]\d{1,2}[/-]((?:19|20)\d{2})(?:$|[^\d])/);
  if (match) return Number(match[1]);
 
  // Para valores que solo contienen el año.
  match = text.match(/^((?:19|20)\d{2})$/);
 
  return match ? Number(match[1]) : null;
};
 
const normalizeCategory = value =>
  String(value || 'General').trim().toLocaleLowerCase('es');
 
const colorFor = category =>
  coloresCategorias[normalizeCategory(category)] || '#0f766e';
 
const iconTypeFor = category => {
  const c = normalizeCategory(category);
 
  if (
    c.includes('educacion') ||
    c.includes('cultura') ||
    c.includes('juventud')
  ) return 'educacion';
 
  if (
    c.includes('ambiental') ||
    c.includes('vigilancia') ||
    c.includes('seguridad')
  ) return 'ambiental';
 
  if (
    c.includes('infraestructura') ||
    c.includes('servicios basicos')
  ) return 'infraestructura';
 
  if (
    c.includes('turismo') ||
    c.includes('emprendimientos')
  ) return 'turismo';
 
  return 'general';
};
 
const svgIcon = category => {
  const color = colorFor(category);
  const path = gruposSVG[iconTypeFor(category)];
 
  return L.divIcon({
    className: 'project-svg-icon',
    iconSize: [30, 36],
    iconAnchor: [15, 31],
    popupAnchor: [0, -28],
 
    html: `
<svg width="30" height="36" viewBox="0 0 30 36"
           aria-hidden="true">
<path
          d="M15 2C7.8 2 2.5 7.4 2.5 14.2
             c0 9.1 12.5 20 12.5 20
             s12.5-10.9 12.5-20
             C27.5 7.4 22.2 2 15 2Z"
          fill="${color}"
          stroke="#fff"
          stroke-width="1.6"
        />
<g
          transform="translate(4 3)"
          fill="none"
          stroke="#fff"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
>${path}</g>
</svg>
    `
  });
};
 
 
// ======================================================
// 7. VARIABLES Y GRUPOS DE CAPAS
// ======================================================
 
const allLayersSearch = [];
 
const territoryLayers = L.layerGroup().addTo(map);
 
const categoryClusters = {};
const categoryCounts = {};
 
let chartInstance = null;
let projectFeatures = [];
let projectRecords = [];
let selectedTerritoryLayer = null;
let geoTerritoriesLayer = null;
let currentYear = 'all';
let groupedControl = null;
 
 
// ======================================================
// 8. CONTROL DE CAPAS AGRUPADAS
// ======================================================
 
function createLayerControl() {
  const grouped = {
    'Territorios Indígenas': {
      'Todos los territorios': territoryLayers
    },
 
    'Proyectos Visitados': {}
  };
 
  Object.keys(categoryClusters)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .forEach(name => {
      grouped['Proyectos Visitados'][
        `${name} (${categoryCounts[name] || 0})`
      ] = categoryClusters[name];
    });
 
  if (groupedControl) {
    map.removeControl(groupedControl);
  }
 
  if (L.control.groupedLayers) {
    groupedControl = L.control.groupedLayers(
      null,
      grouped,
      {
        collapsed: false,
        groupCheckboxes: true
      }
    ).addTo(map);
  } else {
    // Respaldo si el complemento de grupos no carga.
    const overlays = {
      'Territorios Indígenas': territoryLayers
    };
 
    Object.entries(categoryClusters).forEach(([name, layer]) => {
      overlays[`Proyecto: ${name}`] = layer;
    });
 
    groupedControl = L.control.layers(
      null,
      overlays,
      { collapsed: false }
    ).addTo(map);
  }
}
 
 
// ======================================================
// 9. ACTUALIZACIÓN DE LA FICHA TERRITORIAL
// ======================================================
 
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
 
function setBadge(id, label, active) {
  const el = document.getElementById(id);
 
  el.textContent = `${label}: ${active ? 'Sí' : 'No'}`;
  el.className = `tag-programa ${
    active ? 'tag-active' : 'tag-inactive'
  }`;
}
 
function renderDisbursement(date, usd, crc) {
  if (isEmpty(date) && isEmpty(usd) && isEmpty(crc)) {
    return '<span class="muted">No asignado</span>';
  }
 
  const pieces = [];
 
  if (!isEmpty(crc)) {
    pieces.push(`<strong>₡${formatNumber(crc)}</strong>`);
  }
 
  if (!isEmpty(usd)) {
    pieces.push(`<small>US$ ${formatNumber(usd)}</small>`);
  }
 
  if (!isEmpty(date)) {
    pieces.push(
      `<span class="disbursement-date">Fecha: ${formatDate(date)}</span>`
    );
  }
 
  return pieces.join('<br>');
}
 
function clearTerritoryInfo() {
  setText('info-nombre', 'Haz clic en un territorio');
  setText('info-decreto', '—');
  setText('info-bloque', '—');
 
  document.getElementById('info-des1').textContent = '—';
  document.getElementById('info-des2').textContent = '—';
 
  for (let year = 2017; year <= 2024; year++) {
    setText(`ae-${year}`, '—');
  }
 
  document.getElementById('badge-cref').textContent = 'CREF';
  document.getElementById('badge-cref').className =
    'tag-programa tag-inactive';
 
  document.getElementById('badge-paft').textContent = 'PAFT';
  document.getElementById('badge-paft').className =
    'tag-programa tag-inactive';
}
 
function showTerritory(feature, layer, animate = true) {
  const props = feature.properties || {};
  const name = props.TERRITORIO || 'Territorio indígena';
 
  if (
    selectedTerritoryLayer &&
    selectedTerritoryLayer !== layer
  ) {
    selectedTerritoryLayer.setStyle(estiloNormal);
 
    selectedTerritoryLayer
      .getElement()
      ?.classList.remove('territorio-highlight');
  }
 
  selectedTerritoryLayer = layer;
 
  layer.setStyle({ ...estiloHover, weight: 3 });
 
  if (layer.getElement()) {
    layer.getElement().classList.remove('territorio-highlight');
 
    // Reinicia la animación si se selecciona el mismo polígono.
    void layer.getElement().offsetWidth;
 
    layer.getElement().classList.add('territorio-highlight');
  }
 
  setText('info-nombre', name);
 
  const clasif = String(props.CLASIF || '').toUpperCase();
 
  setBadge('badge-cref', 'CREF', clasif.includes('CREF'));
  setBadge('badge-paft', 'PAFT', clasif.includes('PAFT'));
 
  setText(
    'info-decreto',
    !isEmpty(props.DECRETO)
      ? `Decreto ${props.DECRETO}${
          !isEmpty(props.AÑO) ? ` (${props.AÑO})` : ''
        }`
      : 'No especificado'
  );
 
  setText('info-bloque', props.BLOQUE || 'No disponible');
 
  // Columnas exactas de territorios.geojson.
  document.getElementById('info-des1').innerHTML =
    renderDisbursement(
      props.fec_desemb_1,
      props.monto_desemb_1_usd,
      props.monto_desemb_1_crc
    );
 
  document.getElementById('info-des2').innerHTML =
    renderDisbursement(
      props.fec_desemb_2,
      props.monto_desemb_2_usd,
      props.monto_desemb_2_crc
    );
 
  // Áreas efectivas aprobadas por año.
  for (let year = 2017; year <= 2024; year++) {
    const raw = props[`AE_${year}`];
 
    setText(
      `ae-${year}`,
      isEmpty(raw) ? '—' : formatNumber(raw)
    );
  }
 
  if (animate) {
    const bounds = layer.getBounds();
 
    if (bounds.isValid()) {
      map.flyToBounds(bounds, {
        padding: [45, 45],
        duration: 1.15,
        maxZoom: 12
      });
    }
 
    setTimeout(() => {
      if (layer.getElement()) {
        layer.getElement().classList.remove('territorio-highlight');
      }
    }, 2800);
  }
}
 
 
// ======================================================
// 10. CARGA DE TERRITORIOS INDÍGENAS
// ======================================================
 
async function loadTerritories() {
  const response = await fetch('datos/territorios.geojson');
 
  if (!response.ok) {
    throw new Error(
      `No se pudo cargar datos/territorios.geojson (${response.status})`
    );
  }
 
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
 
  setText(
    'kpi-territorios',
    features.length.toLocaleString('es-CR')
  );
 
  geoTerritoriesLayer = L.geoJSON(data, {
    pane: 'paneTerritorios',
    style: () => estiloNormal,
 
    onEachFeature: (feature, layer) => {
      const name =
        (feature.properties || {}).TERRITORIO ||
        'Territorio indígena';
 
      allLayersSearch.push({
        type: 'territorio',
        name: String(name),
        layer,
        feature
      });
 
      layer.on({
        mouseover: e => {
          if (e.target !== selectedTerritoryLayer) {
            e.target.setStyle(estiloHover);
          }
        },
 
        mouseout: e => {
          if (e.target !== selectedTerritoryLayer) {
            geoTerritoriesLayer.resetStyle(e.target);
          }
        },
 
        click: e => showTerritory(feature, e.target, true)
      });
    }
  });
 
  territoryLayers.addLayer(geoTerritoriesLayer);
 
  if (features.length && map.getZoom() <= 8) {
    const bounds = geoTerritoriesLayer.getBounds();
 
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 9
      });
    }
  }
}
 
 
// ======================================================
// 11. POPUPS DE LOS PROYECTOS
// ======================================================
 
function createProjectPopup(p) {
  const nombre =
    p['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
 
  const territorio =
    p['1_Territorio_Indgena'] || 'No especificado';
 
  const comunidad =
    p['6_Comunidad_TI'] || 'No disponible';
 
  const categoria =
    p.Clasificacion || 'General';
 
  const descripcion = String(
    p['4_Descripcin_de_proy'] || 'Sin descripción detallada.'
  );
 
  const inversionVal = p['5_Inversin_CREF'];
 
  const inversion = isEmpty(inversionVal)
    ? 'No disponible'
    : `₡${formatNumber(inversionVal)}`;
 
  const fecha =
    formatDate(p['11_Fecha_de_visita']) || 'No disponible';
 
  const desembolso =
    p['8_Desembolso_CREF'] || 'No disponible';
 
  // El colaborador no se incluye en el popup.
  return `
<div class="popup-proyecto">
<h3>${escapeHTML(nombre)}</h3>
 
      <p><strong>Territorio:</strong>
        ${escapeHTML(territorio)}</p>
 
      <p><strong>Comunidad:</strong>
        ${escapeHTML(comunidad)}</p>
 
      <p><strong>Clasificación:</strong>
        ${escapeHTML(categoria)}</p>
 
      <p><strong>Descripción:</strong>
        ${escapeHTML(descripcion).replace(/\r?\n/g, '<br>')}</p>
 
      <p><strong>Inversión CREF:</strong>
        ${inversion}</p>
 
      <p><strong>Desembolso:</strong>
        ${escapeHTML(desembolso)}</p>
 
      <p><strong>Fecha de visita:</strong>
        ${fecha}</p>
 
      <div class="popup-img-preview">
        Fotografía:
        ${escapeHTML(p['13_Fotografa'] || 'No disponible')}
</div>
</div>
  `;
}
 
 
// ======================================================
// 12. GRÁFICO DE VISITAS
// ======================================================
 
function buildChart(features) {
  const counts = {};
 
  features.forEach(feature => {
    const p = feature.properties || {};
    const date = p['11_Fecha_de_visita'];
 
    if (!isEmpty(date)) {
      const label = formatDate(date);
      counts[label] = (counts[label] || 0) + 1;
    }
  });
 
  const labels = Object.keys(counts).sort((a, b) => {
    const yearA = getYear(a);
    const yearB = getYear(b);
 
    if (
      yearA !== null &&
      yearB !== null &&
      yearA !== yearB
    ) {
      return yearA - yearB;
    }
 
    return a.localeCompare(b, 'es');
  });
 
  const canvas = document.getElementById('visitasChart');
 
  if (chartInstance) chartInstance.destroy();
 
  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
 
    data: {
      labels: labels.length ? labels : ['Sin fechas'],
 
      datasets: [{
        label: 'Visitas',
        data: labels.map(label => counts[label]),
        backgroundColor: '#0f766e',
        borderRadius: 5,
        maxBarThickness: 28
      }]
    },
 
    options: {
      responsive: true,
      maintainAspectRatio: false,
 
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false }
      },
 
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { size: 10 }
          },
          grid: { color: '#edf2ef' }
        },
 
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: 50,
            minRotation: 35
          },
          grid: { display: false }
        }
      }
    }
  });
}
 
 
// ======================================================
// 13. FILTRO TEMPORAL POR AÑO
// ======================================================
 
function setupYearFilter(features) {
  const years = [
    ...new Set(
      features
        .map(feature =>
          getYear(
            (feature.properties || {})['11_Fecha_de_visita']
          )
        )
        .filter(year => year !== null)
    )
  ].sort((a, b) => a - b);
 
  const slider = document.getElementById('year-slider');
 
  // Posición 0 = mostrar todos los años.
  slider.min = '0';
  slider.max = String(years.length);
  slider.step = '1';
  slider.value = '0';
 
  setText(
    'year-min-label',
    years.length ? String(years[0]) : 'Todos'
  );
 
  setText(
    'year-max-label',
    years.length ? String(years[years.length - 1]) : '—'
  );
 
  slider.addEventListener('input', () => {
    const index = Number(slider.value);
 
    currentYear = index === 0 ? 'all' : years[index - 1];
 
    applyYearFilter();
  });
 
  document.getElementById('reset-year').addEventListener('click', () => {
    slider.value = '0';
    currentYear = 'all';
    applyYearFilter();
  });
}
 
function applyYearFilter() {
  let visible = 0;
 
  projectRecords.forEach(record => {
    const matches =
      currentYear === 'all' ||
      record.year === currentYear;
 
    if (matches) visible++;
 
    if (matches) {
      record.cluster.addLayer(record.marker);
    } else {
      record.cluster.removeLayer(record.marker);
    }
  });
 
  setText(
    'year-label',
    currentYear === 'all'
      ? 'Todos los años'
      : String(currentYear)
  );
 
  setText(
    'year-count',
    `${visible.toLocaleString('es-CR')} de ${
      projectRecords.length.toLocaleString('es-CR')
    } proyectos`
  );
}
 
 
// ======================================================
// 14. CARGA DE PROYECTOS Y AGRUPACIÓN DE PUNTOS
// ======================================================
 
async function loadProjects() {
  const response = await fetch('datos/puntos.geojson');
 
  if (!response.ok) {
    throw new Error(
      `No se pudo cargar datos/puntos.geojson (${response.status})`
    );
  }
 
  const data = await response.json();
 
  projectFeatures = Array.isArray(data.features)
    ? data.features
    : [];
 
  setText(
    'kpi-visitas',
    projectFeatures.length.toLocaleString('es-CR')
  );
 
  buildChart(projectFeatures);
 
  projectFeatures.forEach(feature => {
    const p = feature.properties || {};
 
    const category =
      String(p.Clasificacion || 'General').trim() || 'General';
 
    if (!categoryClusters[category]) {
      categoryClusters[category] = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 48,
        disableClusteringAtZoom: 15,
 
        iconCreateFunction: cluster => {
          const count = cluster.getChildCount();
 
          const size =
            count < 10 ? 'small' :
            count < 100 ? 'medium' :
            'large';
 
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(40, 40)
          });
        }
      });
 
      categoryCounts[category] = 0;
    }
 
    categoryCounts[category]++;
 
    // El archivo GeoJSON debe contener geometrías Point.
    const geometry = feature.geometry;
 
    const latlng =
      geometry && geometry.type === 'Point'
        ? L.latLng(
            geometry.coordinates[1],
            geometry.coordinates[0]
          )
        : null;
 
    if (
      !latlng ||
      !Number.isFinite(latlng.lat) ||
      !Number.isFinite(latlng.lng)
    ) {
      return;
    }
 
    const marker = L.marker(latlng, {
      icon: svgIcon(category),
      title: p['3_Nombre_de_Proyecto'] || category
    });
 
    marker.bindPopup(
      createProjectPopup(p),
      {
        maxWidth: 330,
        minWidth: 210
      }
    );
 
    const year = getYear(p['11_Fecha_de_visita']);
 
    const record = {
      marker,
      cluster: categoryClusters[category],
      year,
      name: String(
        p['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre'
      ),
      category
    };
 
    projectRecords.push(record);
    categoryClusters[category].addLayer(marker);
 
    allLayersSearch.push({
      type: 'punto',
      name: record.name,
      layer: marker,
      record
    });
  });
 
  createLayerControl();
  setupYearFilter(projectFeatures);
  applyYearFilter();
}
 
 
// ======================================================
// 15. BUSCADOR GLOBAL
// ======================================================
 
let searchTimer = null;
 
document.getElementById('buscador').addEventListener('input', e => {
  clearTimeout(searchTimer);
 
  const query = e.target.value.toLocaleLowerCase('es').trim();
 
  if (query.length < 2) return;
 
  searchTimer = setTimeout(() => {
    const match = allLayersSearch.find(item =>
      item.name.toLocaleLowerCase('es').includes(query)
    );
 
    if (!match) return;
 
    if (match.type === 'territorio') {
      if (!map.hasLayer(territoryLayers)) {
        territoryLayers.addTo(map);
      }
 
      showTerritory(match.feature, match.layer, true);
 
    } else {
      const record = match.record;
 
      // Si el proyecto está fuera del año seleccionado,
      // se restablece el filtro para poder localizarlo.
      if (
        currentYear !== 'all' &&
        record.year !== currentYear
      ) {
        currentYear = 'all';
        document.getElementById('year-slider').value = '0';
        applyYearFilter();
      }
 
      if (!map.hasLayer(record.cluster)) {
        record.cluster.addTo(map);
      }
 
      map.flyTo(
        record.marker.getLatLng(),
        15,
        { duration: 1.1 }
      );
 
      record.cluster.zoomToShowLayer(
        record.marker,
        () => record.marker.openPopup()
      );
    }
  }, 180);
});
 
 
// ======================================================
// 16. CARGA INICIAL Y MANEJO DE ERRORES
// ======================================================
 
Promise.all([
  loadTerritories(),
  loadProjects()
]).catch(error => {
  console.error('Error al cargar el geovisor:', error);
 
  const message = document.createElement('div');
  message.className = 'load-error';
 
  message.textContent =
    'No se pudieron cargar los datos. Verifica que existan ' +
    'datos/territorios.geojson y datos/puntos.geojson y que estén ' +
    'publicados en GitHub Pages. Detalle: ' + error.message;
 
  document.body.appendChild(message);
});
