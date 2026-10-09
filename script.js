'use strict';
 
/* ============================================================
   GEOVISOR REDD+ — script.js
   Archivos de datos esperados:
   - datos/territorios.geojson
   - datos/puntos.geojson
   Se conservan los nombres de campos compartidos por el usuario.
   ============================================================ */
 
// 1. Inicialización del mapa y sus paneles de dibujo.
const map = L.map('map', {
    zoomControl: true,
    preferCanvas: false
}).setView([9.25, -83.25], 9);
 
map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;
 
map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650;
 
// 2. Mapas base disponibles.
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }),
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; CARTO'
    }),
    esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri'
    })
};
 
basemaps.osm.addTo(map);
 
document.getElementById('select-basemap').addEventListener('change', (event) => {
    const selectedBasemap = basemaps[event.target.value];
    if (!selectedBasemap) return;
 
    Object.values(basemaps).forEach((layer) => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    });
 
    selectedBasemap.addTo(map);
});
 
// 3. Estilos de territorios.
const estiloNormal = {
    color: '#0f766e',
    weight: 1.5,
    fillColor: '#14b8a6',
    fillOpacity: 0.30,
    pane: 'paneTerritorios'
};
 
const estiloHover = {
    color: '#0f766e',
    weight: 3,
    fillColor: '#2dd4bf',
    fillOpacity: 0.48,
    pane: 'paneTerritorios'
};
 
const estiloSeleccionado = {
    color: '#115e59',
    weight: 3,
    fillColor: '#2dd4bf',
    fillOpacity: 0.46,
    pane: 'paneTerritorios'
};
 
let territoriosLayer;
let selectedTerritoryLayer = null;
let territoryPulseTimer = null;
let layerControl = null;
let chartInstance = null;
let selectedTimelineYear = null;
 
const allLayersSearch = [];
const allProjectRecords = [];
const projectCategoryGroups = new Map();
 
let projectClusterGroup = null;
 
// 4. Categorías conocidas, sus colores y su icono SVG temático.
const categoryDefinitions = [
    {
        key: 'infraestructura comunitaria y social',
        label: 'Infraestructura comunitaria y social',
        color: '#2563eb',
        icon: 'house'
    },
    {
        key: 'infraestructura de servicios basicos',
        label: 'Infraestructura de servicios básicos',
        color: '#dc2626',
        icon: 'house'
    },
    {
        key: 'educacion, cultura y juventud',
        label: 'Educación, cultura y juventud',
        color: '#d97706',
        icon: 'school'
    },
    {
        key: 'turismo sostenible y emprendimientos productivos',
        label: 'Turismo sostenible y emprendimientos productivos',
        color: '#16a34a',
        icon: 'leaf'
    },
    {
        key: 'seguridad, vigilancia y gestion ambiental',
        label: 'Seguridad, vigilancia y gestión ambiental',
        color: '#9333ea',
        icon: 'leaf'
    },
    {
        key: 'ayuda social y mejoramiento de infraestructura',
        label: 'Ayuda social y mejoramiento de infraestructura',
        color: '#db2777',
        icon: 'house'
    },
    {
        key: 'general',
        label: 'General / sin clasificación',
        color: '#0f766e',
        icon: 'pin'
    }
];
 
const categoryDefinitionMap = new Map();
 
categoryDefinitions.forEach((definition) => {
    categoryDefinitionMap.set(normalizeText(definition.key), definition);
    categoryDefinitionMap.set(normalizeText(definition.label), definition);
});
 
// 5. Helpers para normalizar valores, fechas, números y HTML.
function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
 
function isPresent(value) {
    return value !== undefined &&
        value !== null &&
        String(value).trim() !== '';
}
 
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
 
function parseDate(value) {
    if (!isPresent(value)) return null;
 
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
 
    const raw = String(value).trim();
    let match;
 
    // Formato año-mes-día: YYYY-MM-DD o YYYY/MM/DD, con hora opcional.
    match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
 
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
 
        const date = new Date(year, month - 1, day);
 
        if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) {
            return date;
        }
 
        return null;
    }
 
    // Formato día/mes/año: DD/MM/YYYY o DD-MM-YYYY, con hora opcional.
    match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[T\s].*)?$/);
 
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
 
        const date = new Date(year, month - 1, day);
 
        if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) {
            return date;
        }
 
        return null;
    }
 
    // Respaldo para valores ISO con zona horaria u otros formatos reconocidos.
    const parsed = new Date(raw);
 
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
 
function formatDateDisplay(value) {
    if (!isPresent(value)) return 'N/D';
 
    const date = parseDate(value);
 
    if (!date) return String(value).trim();
 
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
 
    return `${day}/${month}/${date.getFullYear()}`;
}
 
function getDateYear(value) {
    const date = parseDate(value);
    return date ? date.getFullYear() : null;
}
 
function parseNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
 
    if (!isPresent(value)) return null;
 
    let raw = String(value).trim().replace(/[₡$\s]/g, '');
 
    if (!raw) return null;
 
    const commaIndex = raw.lastIndexOf(',');
    const dotIndex = raw.lastIndexOf('.');
 
    if (commaIndex !== -1 && dotIndex !== -1) {
        // El último separador suele ser el decimal; el otro se toma como miles.
        if (commaIndex > dotIndex) {
            raw = raw.replace(/\./g, '').replace(',', '.');
        } else {
            raw = raw.replace(/,/g, '');
        }
    } else if (commaIndex !== -1) {
        const decimals = raw.length - commaIndex - 1;
 
        raw = decimals > 0 && decimals <= 2
            ? raw.replace(',', '.')
            : raw.replace(/,/g, '');
    } else if (
        dotIndex !== -1 &&
        raw.length - dotIndex - 1 === 3
    ) {
        raw = raw.replace(/\./g, '');
    }
 
    raw = raw.replace(/[^\d.-]/g, '');
 
    const number = Number(raw);
 
    return Number.isFinite(number) ? number : null;
}
 
function formatNumber(value, maximumFractionDigits = 0) {
    const number = parseNumber(value);
 
    if (number === null) return 'N/D';
 
    return new Intl.NumberFormat('es-CR', {
        maximumFractionDigits,
        minimumFractionDigits: 0
    }).format(number);
}
 
function displayValue(value, fallback = '—') {
    return isPresent(value) ? String(value).trim() : fallback;
}
 
function setStatus(message, isError = false) {
    const status = document.getElementById('data-status');
 
    status.textContent = message;
    status.classList.toggle('data-status-error', Boolean(isError));
    status.classList.add('data-status-visible');
 
    if (!isError) {
        window.setTimeout(() => {
            status.classList.remove('data-status-visible');
        }, 4500);
    }
}
 
async function fetchGeoJSON(path) {
    const response = await fetch(path);
 
    if (!response.ok) {
        throw new Error(`No se pudo cargar ${path} (HTTP ${response.status}).`);
    }
 
    const data = await response.json();
 
    if (!data || !Array.isArray(data.features)) {
        throw new Error(`El archivo ${path} no contiene un GeoJSON FeatureCollection válido.`);
    }
 
    return data;
}
 
// 6. Formateo de desembolsos: columnas exactas de la base de datos.
function formatearDesembolso(fecha, usd, crc) {
    const tieneFecha = isPresent(fecha);
    const montoUSD = parseNumber(usd);
    const montoCRC = parseNumber(crc);
 
    if (!tieneFecha && montoUSD === null && montoCRC === null) {
        return '<span class="desembolso-vacio">No asignado</span>';
    }
 
    let html = '';
 
    if (montoCRC !== null) {
        html += `<strong>₡${escapeHTML(formatNumber(montoCRC, 2))}</strong><br>`;
    }
 
    if (montoUSD !== null) {
        html += `<small class="monto-usd">$${escapeHTML(formatNumber(montoUSD, 2))} USD</small><br>`;
    }
 
    if (tieneFecha) {
        html += `<span class="fecha-desembolso">Fecha: ${escapeHTML(formatDateDisplay(fecha))}</span>`;
    }
 
    return html || '<span class="desembolso-vacio">No asignado</span>';
}
 
// 7. Crear y destacar el polígono del territorio seleccionado.
function destacarTerritorio(layer) {
    if (
        selectedTerritoryLayer &&
        selectedTerritoryLayer !== layer &&
        territoriosLayer
    ) {
        territoriosLayer.resetStyle(selectedTerritoryLayer);
    }
 
    selectedTerritoryLayer = layer;
    layer.setStyle(estiloSeleccionado);
 
    const element = typeof layer.getElement === 'function'
        ? layer.getElement()
        : null;
 
    if (element) {
        element.classList.remove('territory-highlight');
 
        // Reiniciar la animación si se vuelve a seleccionar el mismo territorio.
        void element.getBoundingClientRect();
 
        element.classList.add('territory-highlight');
    }
 
    if (territoryPulseTimer) {
        window.clearTimeout(territoryPulseTimer);
    }
 
    territoryPulseTimer = window.setTimeout(() => {
        const currentElement =
            selectedTerritoryLayer &&
            typeof selectedTerritoryLayer.getElement === 'function'
                ? selectedTerritoryLayer.getElement()
                : null;
 
        if (currentElement) {
            currentElement.classList.remove('territory-highlight');
        }
    }, 2400);
}
 
function seleccionarTerritorio(feature, layer, moverMapa = true) {
    const props = feature && feature.properties
        ? feature.properties
        : {};
 
    const nombreTerritorio = props.TERRITORIO || 'Territorio indígena';
 
    if (moverMapa) {
        const bounds = layer.getBounds();
 
        if (bounds && bounds.isValid()) {
            map.flyToBounds(bounds, {
                padding: [40, 40],
                duration: 1.1,
                maxZoom: 13
            });
        }
    }
 
    document.getElementById('info-nombre').textContent = nombreTerritorio;
 
    const clasif = normalizeText(props.CLASIF || '');
    const badgeCref = document.getElementById('badge-cref');
    const badgePaft = document.getElementById('badge-paft');
 
    if (clasif.includes('cref')) {
        badgeCref.textContent = 'CREF: Sí';
        badgeCref.className = 'tag-programa tag-active';
    } else {
        badgeCref.textContent = 'CREF: No';
        badgeCref.className = 'tag-programa tag-inactive';
    }
 
    if (clasif.includes('paft')) {
        badgePaft.textContent = 'PAFT: Sí';
        badgePaft.className = 'tag-programa tag-active';
    } else {
        badgePaft.textContent = 'PAFT: No';
        badgePaft.className = 'tag-programa tag-inactive';
    }
 
    document.getElementById('info-decreto').textContent = isPresent(props.DECRETO)
        ? `Decreto ${props.DECRETO}${isPresent(props.AÑO) ? ` (${props.AÑO})` : ''}`
        : 'No especificado';
 
    document.getElementById('info-bloque').textContent = displayValue(props.BLOQUE, 'N/D');
 
    // Nombres exactos solicitados para fechas y montos de los dos desembolsos.
    document.getElementById('info-des1').innerHTML = formatearDesembolso(
        props['fec_desemb_1'],
        props['monto_desemb_1_usd'],
        props['monto_desemb_1_crc']
    );
 
    document.getElementById('info-des2').innerHTML = formatearDesembolso(
        props['fec_desemb_2'],
        props['monto_desemb_2_usd'],
        props['monto_desemb_2_crc']
    );
 
    [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].forEach((year) => {
        const cell = document.getElementById(`ae-${year}`);
        const value = props[`AE_${year}`];
 
        cell.textContent = isPresent(value) ? value : '—';
    });
 
    destacarTerritorio(layer);
}
 
// Crear el GeoJSON vacío antes de cargar los datos, para mantener una referencia estable.
territoriosLayer = L.geoJSON(null, {
    pane: 'paneTerritorios',
    style: estiloNormal,
 
    onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const nombreTerritorio = props.TERRITORIO || 'Territorio indígena';
 
        allLayersSearch.push({
            type: 'territorio',
            name: String(nombreTerritorio),
            layer,
            feature
        });
 
        layer.on({
            mouseover: (event) => {
                event.target.setStyle(estiloHover);
 
                if (typeof event.target.bringToFront === 'function') {
                    event.target.bringToFront();
                }
            },
 
            mouseout: (event) => {
                territoriosLayer.resetStyle(event.target);
 
                if (event.target === selectedTerritoryLayer) {
                    event.target.setStyle(estiloSeleccionado);
                }
            },
 
            click: (event) => {
                seleccionarTerritorio(feature, event.target, true);
            }
        });
    }
}).addTo(map);
 
// 8. SVG temáticos para las categorías de proyectos.
function svgGlyph(iconType) {
    const glyphs = {
        school: '<path d="M5 12 L16 5 L27 12 M8 13 V25 H24 V13 M13 25 V18 H19 V25 M11 15 H12 M20 15 H21" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 
        house: '<path d="M5 14 L16 5 L27 14 M8 13 V25 H24 V13 M13 25 V18 H19 V25" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 
        leaf: '<path d="M26 6 C15 6 7 10 7 19 C7 24 11 27 15 25 C22 22 25 14 26 6 Z M8 27 C12 20 17 16 23 12" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 
        pin: '<circle cx="16" cy="15" r="7" fill="none" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="15" r="2" fill="#ffffff"/>'
    };
 
    return glyphs[iconType] || glyphs.pin;
}
 
function createProjectIcon(category) {
    const svg = `
<svg class="project-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 42" aria-hidden="true" focusable="false">
<path d="M18 1.5 C9.3 1.5 3 7.9 3 16.1 C3 25.1 18 40.5 18 40.5 C18 40.5 33 25.1 33 16.1 C33 7.9 26.7 1.5 18 1.5 Z" fill="${category.color}" stroke="#ffffff" stroke-width="2"/>
<g transform="translate(2 1)">${svgGlyph(category.icon)}</g>
</svg>`;
 
    return L.divIcon({
        className: 'project-div-icon',
        html: svg,
        iconSize: [36, 42],
        iconAnchor: [18, 40],
        popupAnchor: [0, -37]
    });
}
 
function inferCategoryDefinition(categoryName) {
    const key = normalizeText(categoryName || 'General') || 'general';
    const known = categoryDefinitionMap.get(key);
 
    if (known) return known;
 
    let icon = 'pin';
 
    if (
        key.includes('educacion') ||
        key.includes('cultura') ||
        key.includes('juventud')
    ) {
        icon = 'school';
    } else if (
        key.includes('ambient') ||
        key.includes('turismo') ||
        key.includes('bosque') ||
        key.includes('conserv')
    ) {
        icon = 'leaf';
    } else if (
        key.includes('infraestructura') ||
        key.includes('comunidad') ||
        key.includes('servicio')
    ) {
        icon = 'house';
    }
 
    return {
        key,
        label: String(categoryName || 'General').trim() || 'General',
        color: '#0f766e',
        icon
    };
}
 
function createProjectClusterGroup() {
    return L.markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
 
        iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
 
            return L.divIcon({
                html: `<div class="custom-cluster" style="--cluster-color:#0f766e"><span>${count}</span></div>`,
                className: 'custom-cluster-wrapper',
                iconSize: [42, 42]
            });
        }
    }).addTo(map);
}
 
function ensureCategoryGroup(categoryName) {
    const definition = inferCategoryDefinition(categoryName);
 
    if (!projectCategoryGroups.has(definition.key)) {
        // Este grupo funciona como interruptor del control de capas.
        // Los marcadores se representan en un único MarkerClusterGroup
        // para agrupar todas las categorías que estén visibles.
        projectCategoryGroups.set(definition.key, {
            definition,
            layer: L.layerGroup().addTo(map)
        });
    }
 
    return projectCategoryGroups.get(definition.key);
}
 
projectClusterGroup = createProjectClusterGroup();
 
// Inicializar las categorías conocidas para que estén disponibles por separado.
categoryDefinitions.forEach((category) => {
    ensureCategoryGroup(category.label);
});
 
// 9. Construcción del popup de cada proyecto, sin mostrar al colaborador.
function construirPopupProyecto(properties) {
    const p = properties || {};
 
    const nombreProyecto = p['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
    const territorio = p['1_Territorio_Indgena'] || 'No especificado';
    const comunidad = p['6_Comunidad_TI'] || 'N/D';
    const clasificacion = p.Clasificacion || 'General';
    const descripcion = p['4_Descripcin_de_proy'] || 'Sin descripción detallada.';
 
    const inversionValue = p['5_Inversin_CREF'];
    const inversionNumber = parseNumber(inversionValue);
 
    const inversion = inversionNumber !== null
        ? `₡${formatNumber(inversionNumber, 2)} (aprox. $${formatNumber(inversionNumber / 520, 2)} USD)`
        : (isPresent(inversionValue) ? String(inversionValue) : 'N/D');
 
    const fecha = formatDateDisplay(p['11_Fecha_de_visita']);
 
    const desembolso = isPresent(p['8_Desembolso_CREF'])
        ? p['8_Desembolso_CREF']
        : 'N/D';
 
    const fotografia = p['13_Fotografa'] || 'N/D';
 
    return `
<div class="popup-proyecto">
<h3>${escapeHTML(nombreProyecto)}</h3>
<p><strong>Territorio:</strong> ${escapeHTML(territorio)}</p>
<p><strong>Comunidad:</strong> ${escapeHTML(comunidad)}</p>
<p><strong>Clasificación:</strong> ${escapeHTML(clasificacion)}</p>
<p><strong>Descripción:</strong> ${escapeHTML(descripcion).replace(/\r?\n/g, '<br>')}</p>
<p><strong>Inversión CREF:</strong> ${escapeHTML(inversion)}</p>
<p><strong>Desembolso:</strong> ${escapeHTML(desembolso)}</p>
<p><strong>Fecha de visita:</strong> ${escapeHTML(fecha)}</p>
<div class="popup-img-preview">📸 Fotografía: ${escapeHTML(fotografia)}</div>
</div>`;
}
 
// 10. Gráfico de visitas ordenado por fecha real, no por texto.
function construirGraficoVisitas(features) {
    const conteo = new Map();
 
    features.forEach((feature) => {
        const properties = feature.properties || {};
        const rawDate = properties['11_Fecha_de_visita'];
        const parsedDate = parseDate(rawDate);
 
        if (!parsedDate) return;
 
        const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
 
        if (!conteo.has(key)) {
            conteo.set(key, {
                date: parsedDate,
                label: formatDateDisplay(rawDate),
                count: 0
            });
        }
 
        conteo.get(key).count += 1;
    });
 
    const sortedEntries = Array.from(conteo.values())
        .sort((a, b) => a.date - b.date);
 
    const labels = sortedEntries.length
        ? sortedEntries.map((entry) => entry.label)
        : ['Sin fechas válidas'];
 
    const values = sortedEntries.length
        ? sortedEntries.map((entry) => entry.count)
        : [0];
 
    const canvas = document.getElementById('visitasChart');
 
    if (!canvas || typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible; se omitió el gráfico de visitas.');
        return;
    }
 
    if (chartInstance) chartInstance.destroy();
 
    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
 
        data: {
            labels,
            datasets: [{
                label: 'Visitas',
                data: values,
                backgroundColor: '#0f766e',
                borderRadius: 4,
                maxBarThickness: 24
            }]
        },
 
        options: {
            responsive: true,
            maintainAspectRatio: false,
 
            plugins: {
                legend: { display: false },
                tooltip: { intersect: false }
            },
 
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        font: { size: 10 }
                    }
                },
 
                x: {
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 9 }
                    }
                }
            }
        }
    });
}
 
// 11. Carga de territorios y proyectos.
function cargarTerritorios(data) {
    territoriosLayer.addData(data);
 
    document.getElementById('kpi-territorios').textContent =
        data.features.length;
}
 
function cargarProyectos(data) {
    document.getElementById('kpi-visitas').textContent =
        data.features.length;
 
    construirGraficoVisitas(data.features);
 
    data.features.forEach((feature, index) => {
        const properties = feature.properties || {};
 
        const categoryName = isPresent(properties.Clasificacion)
            ? String(properties.Clasificacion).trim()
            : 'General';
 
        const categoryGroup = ensureCategoryGroup(categoryName);
        const geometry = feature.geometry;
 
        if (
            !geometry ||
            geometry.type !== 'Point' ||
            !Array.isArray(geometry.coordinates) ||
            geometry.coordinates.length < 2
        ) {
            console.warn(
                `El proyecto ${index + 1} no tiene una geometría Point válida y se omitió del mapa.`
            );
            return;
        }
 
        const longitude = Number(geometry.coordinates[0]);
        const latitude = Number(geometry.coordinates[1]);
 
        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return;
        }
 
        const marker = L.marker([latitude, longitude], {
            pane: 'panePuntos',
            icon: createProjectIcon(categoryGroup.definition),
            keyboard: true,
            title: String(
                properties['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre'
            ),
            riseOnHover: true
        });
 
        marker.bindPopup(
            construirPopupProyecto(properties),
            {
                maxWidth: 340,
                minWidth: 230
            }
        );
 
        const record = {
            feature,
            properties,
            marker,
            categoryKey: categoryGroup.definition.key,
            categoryToggleLayer: categoryGroup.layer,
            year: getDateYear(properties['11_Fecha_de_visita']),
            name: String(
                properties['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre'
            ),
            territory: String(
                properties['1_Territorio_Indgena'] || ''
            )
        };
 
        allProjectRecords.push(record);
 
        allLayersSearch.push({
            type: 'punto',
            name: `${record.name} ${record.territory} ${categoryName}`,
            layer: marker,
            record,
            categoryGroup: categoryGroup.layer
        });
    });
 
    configurarFiltroTemporal();
    aplicarFiltroTemporal();
}
 
// 12. Agrupación jerárquica del control de capas.
function construirControlCapas() {
    if (layerControl) {
        map.removeControl(layerControl);
    }
 
    const territoryOverlays = {
        'Todos los territorios': territoriosLayer
    };
 
    const projectOverlays = {};
 
    const groups = Array.from(projectCategoryGroups.values());
 
    groups.sort((a, b) => {
        const indexA = categoryDefinitions.findIndex(
            (category) => category.key === a.definition.key
        );
 
        const indexB = categoryDefinitions.findIndex(
            (category) => category.key === b.definition.key
        );
 
        if (indexA !== -1 || indexB !== -1) {
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        }
 
        return a.definition.label.localeCompare(b.definition.label, 'es');
    });
 
    groups.forEach((categoryGroup) => {
        projectOverlays[categoryGroup.definition.label] =
            categoryGroup.layer;
    });
 
    const groupedOverlays = {
        'Territorios Indígenas': territoryOverlays,
        'Proyectos Visitados': projectOverlays
    };
 
    if (typeof L.control.groupedLayers === 'function') {
        layerControl = L.control.groupedLayers(
            null,
            groupedOverlays,
            {
                collapsed: window.innerWidth < 760,
                groupCheckboxes: true
            }
        ).addTo(map);
    } else {
        // Respaldo si el complemento no carga.
        console.error(
            'No se pudo cargar leaflet-groupedlayercontrol. Se usará el control estándar.'
        );
 
        const simpleOverlays = {
            'Territorios Indígenas': territoriosLayer,
            ...projectOverlays
        };
 
        layerControl = L.control.layers(
            null,
            simpleOverlays,
            {
                collapsed: window.innerWidth < 760
            }
        ).addTo(map);
    }
}
 
// 13. Filtro temporal acumulativo:
// muestra proyectos visitados hasta el año escogido.
function configurarFiltroTemporal() {
    const slider = document.getElementById('timeline-range');
    const resetButton = document.getElementById('timeline-reset');
    const yearLabel = document.getElementById('timeline-year-label');
    const minLabel = document.getElementById('timeline-min-label');
    const maxLabel = document.getElementById('timeline-max-label');
 
    resetButton.addEventListener('click', () => {
        selectedTimelineYear = null;
 
        if (slider.max) {
            slider.value = slider.max;
        }
 
        yearLabel.textContent = 'Todos los años';
 
        aplicarFiltroTemporal();
    });
 
    const validYears = allProjectRecords
        .map((record) => record.year)
        .filter((year) => Number.isInteger(year));
 
    if (!validYears.length) {
        slider.min = '0';
        slider.max = '0';
        slider.value = '0';
        slider.disabled = true;
 
        resetButton.disabled = false;
 
        yearLabel.textContent = 'Sin fechas válidas';
        minLabel.textContent = '—';
        maxLabel.textContent = '—';
 
        return;
    }
 
    const minYear = Math.min(...validYears);
    const maxYear = Math.max(...validYears);
 
    slider.min = String(minYear);
    slider.max = String(maxYear);
    slider.value = String(maxYear);
    slider.disabled = minYear === maxYear;
 
    minLabel.textContent = String(minYear);
    maxLabel.textContent = String(maxYear);
 
    yearLabel.textContent = 'Todos los años';
 
    slider.addEventListener('input', () => {
        selectedTimelineYear = Number(slider.value);
 
        yearLabel.textContent = `Hasta ${selectedTimelineYear}`;
 
        aplicarFiltroTemporal();
    });
}
 
function aplicarFiltroTemporal() {
    let visibleCount = 0;
 
    if (projectClusterGroup) {
        projectClusterGroup.clearLayers();
    }
 
    allProjectRecords.forEach((record) => {
        const matchesYear =
            selectedTimelineYear === null ||
            (
                record.year !== null &&
                record.year <= selectedTimelineYear
            );
 
        const categoryIsEnabled = map.hasLayer(
            record.categoryToggleLayer
        );
 
        if (
            matchesYear &&
            categoryIsEnabled &&
            projectClusterGroup
        ) {
            projectClusterGroup.addLayer(record.marker);
            visibleCount += 1;
        }
    });
 
    const countLabel = document.getElementById('timeline-count');
 
    if (selectedTimelineYear === null) {
        countLabel.textContent =
            `${visibleCount} proyectos visibles · todos los años`;
    } else {
        countLabel.textContent =
            `${visibleCount} proyectos visibles hasta ${selectedTimelineYear}`;
    }
}
 
// Al encender o apagar una categoría, reconstruir los marcadores visibles.
map.on('overlayadd', (event) => {
    const isProjectCategory = Array.from(
        projectCategoryGroups.values()
    ).some((categoryGroup) => {
        return categoryGroup.layer === event.layer;
    });
 
    if (isProjectCategory) {
        aplicarFiltroTemporal();
    }
});
 
map.on('overlayremove', (event) => {
    const isProjectCategory = Array.from(
        projectCategoryGroups.values()
    ).some((categoryGroup) => {
        return categoryGroup.layer === event.layer;
    });
 
    if (isProjectCategory) {
        aplicarFiltroTemporal();
    }
});
 
function mostrarTodosLosAnios() {
    selectedTimelineYear = null;
 
    const slider = document.getElementById('timeline-range');
    const yearLabel = document.getElementById('timeline-year-label');
 
    if (slider && slider.max) {
        slider.value = slider.max;
    }
 
    if (yearLabel) {
        yearLabel.textContent = 'Todos los años';
    }
 
    aplicarFiltroTemporal();
}
 
// 14. Buscador global:
// respeta el agrupamiento de marcadores y la selección temporal.
document.getElementById('buscador').addEventListener('input', (event) => {
    const query = normalizeText(event.target.value);
 
    if (query.length < 2) return;
 
    const match = allLayersSearch.find((item) => {
        return normalizeText(item.name).includes(query);
    });
 
    if (!match) return;
 
    if (match.type === 'territorio') {
        if (!map.hasLayer(territoriosLayer)) {
            territoriosLayer.addTo(map);
        }
 
        seleccionarTerritorio(match.feature, match.layer, true);
 
        return;
    }
 
    const record = match.record;
 
    if (!record) return;
 
    // Si el año seleccionado oculta el proyecto, mostrar todos los años.
    if (
        selectedTimelineYear !== null &&
        (record.year === null || record.year > selectedTimelineYear)
    ) {
        mostrarTodosLosAnios();
    }
 
    // Activar la categoría si estaba apagada.
    if (!map.hasLayer(match.categoryGroup)) {
        match.categoryGroup.addTo(map);
    }
 
    aplicarFiltroTemporal();
 
    const openPopup = () => {
        map.panTo(
            record.marker.getLatLng(),
            {
                animate: true,
                duration: 0.7
            }
        );
 
        record.marker.openPopup();
    };
 
    if (
        projectClusterGroup &&
        typeof projectClusterGroup.zoomToShowLayer === 'function'
    ) {
        projectClusterGroup.zoomToShowLayer(
            record.marker,
            openPopup
        );
    } else {
        map.setView(record.marker.getLatLng(), 15);
        openPopup();
    }
});
 
// 15. Carga independiente:
// un archivo ausente no impide intentar cargar el otro.
Promise.allSettled([
    fetchGeoJSON('datos/territorios.geojson'),
    fetchGeoJSON('datos/puntos.geojson')
]).then((results) => {
    const territoryResult = results[0];
    const projectsResult = results[1];
 
    const errors = [];
 
    if (territoryResult.status === 'fulfilled') {
        cargarTerritorios(territoryResult.value);
    } else {
        console.error(territoryResult.reason);
        errors.push('territorios.geojson');
    }
 
    if (projectsResult.status === 'fulfilled') {
        cargarProyectos(projectsResult.value);
    } else {
        console.error(projectsResult.reason);
        errors.push('puntos.geojson');
 
        document.getElementById('timeline-count').textContent =
            'No se pudieron cargar los proyectos.';
 
        configurarFiltroTemporal();
    }
 
    construirControlCapas();
 
    if (errors.length) {
        setStatus(
            `No se pudieron cargar: ${errors.join(' y ')}. Revise la carpeta datos/ y los nombres de los archivos.`,
            true
        );
    } else {
        setStatus(
            `Datos cargados: ${document.getElementById('kpi-territorios').textContent} territorios y ${document.getElementById('kpi-visitas').textContent} proyectos.`
        );
    }
});
