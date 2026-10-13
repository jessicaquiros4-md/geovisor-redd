'use strict';
 
/* ============================================================
   GEOVISOR REDD+ — script.js
   Rutas esperadas:
   datos/territorios.geojson
   datos/puntos.geojson
   ============================================================ */
 
const map = L.map('map', {
    zoomControl: false,
    preferCanvas: false
}).setView([9.25, -83.25], 9);
 
L.control.zoom({ position: 'bottomright' }).addTo(map);
 
map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;
 
map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650;
 
// Mapas base
const basemaps = {
    osm: L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
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
 
document.getElementById('select-basemap').addEventListener('change', (event) => {
    const selected = basemaps[event.target.value];
 
    if (!selected) return;
 
    Object.values(basemaps).forEach((layer) => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
 
    selected.addTo(map);
});
 
const estiloHover = {
    color: '#134e4a',
    weight: 3,
    fillOpacity: 0.75
};
 
const estiloSeleccionado = {
    color: '#0f766e',
    weight: 3.5,
    fillOpacity: 0.8
};
 
let selectedTerritoryLayer = null;
let chartInstance = null;
 
const allLayersSearch = [];
const territoryItems = [];
const projectCategories = new Map();
const projectMarkers = [];
 
const categoriasConfig = {
    'infraestructura comunitaria y social': {
        color: '#2563eb',
        simbolo: '🏘️'
    },
    'infraestructura de servicios basicos': {
        color: '#dc2626',
        simbolo: '💧'
    },
    'educacion, cultura y juventud': {
        color: '#d97706',
        simbolo: '🎓'
    },
    'turismo sostenible y emprendimientos productivos': {
        color: '#16a34a',
        simbolo: '🌿'
    },
    'seguridad, vigilancia y gestion ambiental': {
        color: '#9333ea',
        simbolo: '🛡️'
    },
    'ayuda social y mejoramiento de infraestructura': {
        color: '#db2777',
        simbolo: '🤝'
    }
};
 
const categoriaPorDefecto = {
    color: '#0f766e',
    simbolo: '📍'
};
 
// Normalización de textos
function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
 
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
 
function getProp(props, ...names) {
    const keys = Object.keys(props || {});
 
    for (const name of names) {
        const target = normalizeText(name);
 
        const key = keys.find(
            (candidate) => normalizeText(candidate) === target
        );
 
        if (
            key !== undefined &&
            props[key] !== null &&
            String(props[key]).trim() !== ''
        ) {
            return props[key];
        }
    }
 
    return undefined;
}
 
function isPresent(value) {
    return value !== undefined &&
        value !== null &&
        String(value).trim() !== '';
}
 
// Conversión de números, incluidos formatos con separadores de miles
function parseNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
 
    if (!isPresent(value)) return null;
 
    let raw = String(value)
        .trim()
        .replace(/CRC|USD|₡|\$|\s/gi, '');
 
    if (!raw) return null;
 
    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
 
    if (hasComma && hasDot) {
        if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
            raw = raw.replace(/\./g, '').replace(',', '.');
        } else {
            raw = raw.replace(/,/g, '');
        }
    } else if (hasComma) {
        raw = /^-?\d{1,3}(,\d{3})+$/.test(raw)
            ? raw.replace(/,/g, '')
            : raw.replace(',', '.');
    } else if (
        hasDot &&
        /^-?\d{1,3}(\.\d{3}){2,}$/.test(raw)
    ) {
        raw = raw.replace(/\./g, '');
    } else if (
        hasDot &&
        /^-?\d{1,3}\.\d{3}$/.test(raw)
    ) {
        raw = raw.replace('.', '');
    }
 
    const parsed = Number(raw);
 
    return Number.isFinite(parsed) ? parsed : null;
}
 
function formatNumber(value, decimals = 2) {
    const number = parseNumber(value);
 
    if (number === null) return null;
 
    return new Intl.NumberFormat('es-CR', {
        maximumFractionDigits: decimals
    }).format(number);
}
 
// Admite fechas ISO y fechas en formato DD/MM/AAAA
function parseDate(value) {
    if (!isPresent(value)) return null;
 
    if (
        value instanceof Date &&
        !Number.isNaN(value.getTime())
    ) {
        return value;
    }
 
    const raw = String(value).trim();
 
    let match = raw.match(
        /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/
    );
 
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
 
    match = raw.match(
        /^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})(?:[T\s].*)?$/
    );
 
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
 
    const parsed = new Date(raw);
 
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
 
function formatDate(value) {
    if (!isPresent(value)) return null;
 
    const date = parseDate(value);
 
    return date
        ? date.toLocaleDateString('es-CR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : String(value).trim();
}
 
function setStatus(message, isError = false) {
    const element = document.getElementById('data-status');
 
    element.textContent = message;
    element.classList.toggle('data-status-error', isError);
    element.classList.add('data-status-visible');
 
    if (!isError) {
        window.setTimeout(() => {
            element.classList.remove('data-status-visible');
        }, 4500);
    }
}
 
async function fetchGeoJSON(path) {
    const response = await fetch(path);
 
    if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status}`);
    }
 
    const data = await response.json();
 
    if (!data || !Array.isArray(data.features)) {
        throw new Error(
            `${path} no contiene un FeatureCollection GeoJSON válido.`
        );
    }
 
    return data;
}
 
/* ============================================================
   1. COLORES PASTEL PARA LOS TERRITORIOS
   ============================================================ */
 
function territoryColor(index) {
    const hue = (index * 137.508 + 18) % 360;
    return `hsl(${hue.toFixed(1)}, 58%, 79%)`;
}
 
function territoryBorderColor(index) {
    const hue = (index * 137.508 + 18) % 360;
    return `hsl(${hue.toFixed(1)}, 42%, 38%)`;
}
 
function setTerritoryStyle(layer, style) {
    if (layer && typeof layer.setStyle === 'function') {
        layer.setStyle(style);
    }
}
 
function restoreTerritoryStyle(item) {
    item.layer.setStyle({
        color: item.border,
        weight: 1.5,
        fillColor: item.fill,
        fillOpacity: 0.64
    });
}
 
function showTerritoryInfo(item, zoomTo = true) {
    if (
        selectedTerritoryLayer &&
        selectedTerritoryLayer !== item
    ) {
        restoreTerritoryStyle(selectedTerritoryLayer);
    }
 
    selectedTerritoryLayer = item;
 
    setTerritoryStyle(item.layer, {
        ...estiloSeleccionado,
        fillColor: item.fill
    });
 
    if (zoomTo) {
        const bounds = item.layer.getBounds();
 
        if (bounds && bounds.isValid()) {
            map.flyToBounds(bounds, {
                padding: [38, 38],
                duration: 1.1,
                maxZoom: 13
            });
        }
    }
 
    const props = item.feature.properties || {};
 
    document.getElementById('info-nombre').textContent =
        props.TERRITORIO || 'Territorio indígena';
 
    const classification = normalizeText(props.CLASIF || '');
 
    const badgeCref = document.getElementById('badge-cref');
    const badgePaft = document.getElementById('badge-paft');
 
    badgeCref.textContent =
        `CREF: ${classification.includes('cref') ? 'Sí' : 'No'}`;
 
    badgeCref.className =
        `tag-programa ${classification.includes('cref') ? 'tag-active' : 'tag-inactive'}`;
 
    badgePaft.textContent =
        `PAFT: ${classification.includes('paft') ? 'Sí' : 'No'}`;
 
    badgePaft.className =
        `tag-programa ${classification.includes('paft') ? 'tag-active' : 'tag-inactive'}`;
 
    document.getElementById('info-decreto').textContent =
        isPresent(props.DECRETO)
            ? `Decreto ${props.DECRETO}${isPresent(props.AÑO) ? ` (${props.AÑO})` : ''}`
            : 'No especificado';
 
    document.getElementById('info-bloque').textContent =
        isPresent(props.BLOQUE) ? props.BLOQUE : 'N/D';
 
    // Primer desembolso: fecha, monto USD y monto CRC.
    document.getElementById('info-des1').innerHTML =
        formatDisbursement(
            getProp(props, 'fec_desemb_1'),
            getProp(props, 'monto_desemb_1_usd'),
            getProp(props, 'monto_desemb_1_crc')
        );
 
    // Segundo desembolso: fecha, monto USD y monto CRC.
    document.getElementById('info-des2').innerHTML =
        formatDisbursement(
            getProp(props, 'fec_desemb_2'),
            getProp(props, 'monto_desemb_2_usd'),
            getProp(props, 'monto_desemb_2_crc')
        );
 
    [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
        .forEach((year) => {
            const value = getProp(props, `AE_${year}`);
 
            document.getElementById(`ae-${year}`).textContent =
                isPresent(value) ? value : '—';
        });
}
 
function formatDisbursement(dateValue, usdValue, crcValue) {
    const usd = parseNumber(usdValue);
    const crc = parseNumber(crcValue);
    const dateText = formatDate(dateValue);
 
    if (usd === null && crc === null && !dateText) {
        return '<span class="desembolso-vacio">No asignado</span>';
    }
 
    let html = '';
 
    if (crc !== null) {
        html += `<strong>₡${escapeHTML(formatNumber(crc, 2))}</strong><br>`;
    }
 
    if (usd !== null) {
        html += `<small class="monto-usd">$${escapeHTML(formatNumber(usd, 2))} USD</small><br>`;
    }
 
    if (dateText) {
        html += `<span class="fecha-desembolso">${escapeHTML(dateText)}</span>`;
    }
 
    return html;
}
 
/* ============================================================
   2. CONTROL DE CAPAS Y SIMBOLOGÍA
   ============================================================ */
 
const layerControl = L.control({ position: 'topright' });
 
layerControl.groups = [
    { id: 'territorios', title: 'Territorios indígenas', items: [] },
    { id: 'proyectos', title: 'Proyectos visitados', items: [] }
];
 
const checkboxByLayerId = new Map();
 
layerControl.onAdd = function () {
    this.container = L.DomUtil.create(
        'div',
        'leaflet-control capas-agrupadas'
    );
 
    L.DomEvent.disableClickPropagation(this.container);
    L.DomEvent.disableScrollPropagation(this.container);
 
    this.render();
 
    return this.container;
};
 
layerControl.addItem = function (groupId, item) {
    const group = this.groups.find(
        (entry) => entry.id === groupId
    );
 
    if (group) group.items.push(item);
};
 
layerControl.render = function () {
    if (!this.container) return;
 
    this.container.innerHTML = '';
    checkboxByLayerId.clear();
 
    this.groups.forEach((group) => {
        const details = L.DomUtil.create(
            'details',
            'capas-grupo',
            this.container
        );
 
        details.open = true;
 
        const summary = L.DomUtil.create(
            'summary',
            'capas-grupo-titulo',
            details
        );
 
        summary.textContent = group.title;
 
        const actions = L.DomUtil.create(
            'div',
            'capas-acciones',
            details
        );
 
        const showAll = L.DomUtil.create('button', '', actions);
        showAll.type = 'button';
        showAll.textContent = 'Activar todos';
 
        showAll.addEventListener('click', () => {
            group.items.forEach((item) => {
                if (!map.hasLayer(item.layer)) {
                    map.addLayer(item.layer);
                }
            });
        });
 
        const hideAll = L.DomUtil.create('button', '', actions);
        hideAll.type = 'button';
        hideAll.textContent = 'Desactivar todos';
 
        hideAll.addEventListener('click', () => {
            group.items.forEach((item) => {
                if (map.hasLayer(item.layer)) {
                    map.removeLayer(item.layer);
                }
            });
        });
 
        const list = L.DomUtil.create('div', 'capas-lista', details);
 
        if (!group.items.length) {
            L.DomUtil.create('div', 'capas-vacio', list)
                .textContent = 'No hay capas cargadas.';
            return;
        }
 
        group.items.slice()
            .sort((a, b) => a.label.localeCompare(b.label, 'es'))
            .forEach((item) => {
                const label = L.DomUtil.create(
                    'label',
                    'capas-item',
                    list
                );
 
                const checkbox = L.DomUtil.create('', '', label);
                checkbox.type = 'checkbox';
                checkbox.checked = map.hasLayer(item.layer);
 
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        map.addLayer(item.layer);
                    } else {
                        map.removeLayer(item.layer);
                    }
                });
 
                const swatch = L.DomUtil.create(
                    'span',
                    'capas-simbolo',
                    label
                );
 
                swatch.innerHTML = item.swatchHTML;
 
                const text = L.DomUtil.create(
                    'span',
                    'capas-texto',
                    label
                );
 
                text.textContent = item.label;
 
                if (item.count !== undefined) {
                    const count = L.DomUtil.create(
                        'span',
                        'capas-conteo',
                        label
                    );
 
                    count.textContent = String(item.count);
                }
 
                checkboxByLayerId.set(L.stamp(item.layer), checkbox);
            });
    });
};
 
layerControl.addTo(map);
 
map.on('layeradd layerremove', (event) => {
    const checkbox = checkboxByLayerId.get(L.stamp(event.layer));
 
    if (checkbox) {
        checkbox.checked = event.type === 'layeradd';
    }
});
 
/* ============================================================
   3. CARGA DE TERRITORIOS INDÍGENAS
   ============================================================ */
 
async function loadTerritories() {
    const data = await fetchGeoJSON('datos/territorios.geojson');
    const features = data.features || [];
 
    document.getElementById('kpi-territorios').textContent =
        String(features.length);
 
    features.forEach((feature, index) => {
        const props = feature.properties || {};
        const name = String(
            props.TERRITORIO || `Territorio ${index + 1}`
        );
 
        const fill = territoryColor(index);
        const border = territoryBorderColor(index);
 
        const layer = L.geoJSON(feature, {
            pane: 'paneTerritorios',
            style: {
                color: border,
                weight: 1.5,
                fillColor: fill,
                fillOpacity: 0.64
            }
        });
 
        const item = { name, feature, layer, fill, border };
 
        layer.eachLayer((polygon) => {
            polygon.on({
                mouseover: (event) => {
                    event.target.setStyle({
                        color: '#134e4a',
                        weight: 3,
                        fillOpacity: 0.76
                    });
                },
 
                mouseout: (event) => {
                    if (selectedTerritoryLayer === item) {
                        event.target.setStyle({
                            color: '#0f766e',
                            weight: 3.5,
                            fillColor: fill,
                            fillOpacity: 0.8
                        });
                    } else {
                        event.target.setStyle({
                            color: border,
                            weight: 1.5,
                            fillColor: fill,
                            fillOpacity: 0.64
                        });
                    }
                },
 
                click: () => showTerritoryInfo(item, true)
            });
        });
 
        layer.addTo(map);
        territoryItems.push(item);
 
        allLayersSearch.push({
            type: 'territorio',
            name,
            item,
            layer
        });
 
        // El color de la leyenda coincide con el color del polígono.
        layerControl.addItem('territorios', {
            label: name,
            layer,
            swatchHTML:
                `<span class="swatch-territorio" style="background:${fill};border-color:${border}"></span>`
        });
    });
 
    layerControl.render();
 
    if (features.length) {
        const allTerritories = L.featureGroup(
            territoryItems.map((item) => item.layer)
        );
 
        map.fitBounds(allTerritories.getBounds(), {
            padding: [25, 25],
            maxZoom: 10
        });
    }
}
 
/* ============================================================
   4. PROYECTOS: COLORES, ICONOS Y AGRUPAMIENTO
   ============================================================ */
 
function getCategoryConfig(name) {
    return categoriasConfig[normalizeText(name)] ||
        categoriaPorDefecto;
}
 
function createProjectIcon(config, useSymbol) {
    const html = useSymbol
        ? `<div class="marcador-simbolo" style="background:${config.color}">${config.simbolo}</div>`
        : `<div class="marcador-punto" style="background:${config.color}"></div>`;
 
    const size = useSymbol ? 34 : 16;
 
    return L.divIcon({
        className: 'marcador-wrap',
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}
 
let symbolMode = null;
 
function refreshProjectIcons() {
    const useSymbol = map.getZoom() >= 12;
 
    if (symbolMode === useSymbol) return;
 
    symbolMode = useSymbol;
 
    projectMarkers.forEach(({ marker, config }) => {
        marker.setIcon(createProjectIcon(config, useSymbol));
    });
}
 
map.on('zoomend', refreshProjectIcons);
 
/* ============================================================
   5. ENLACES A FOTOGRAFÍAS
   ============================================================ */
 
// Si la celda ya contiene un enlace web, lo conservamos.
// Las carpetas de Drive/Dropbox se abren con su dirección original.
function makePhotoLinks(value) {
    if (!isPresent(value)) {
        return '<span class="foto-no-disponible">Fotografía no disponible</span>';
    }
 
    const values = String(value)
        .split(/[;\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
 
    return values.map((raw) => {
        let url = raw;
 
        if (!/^https?:\/\//i.test(url)) {
            if (/^(\.\.\/|\.\/|fotos\/)/i.test(url)) {
                // La ruta ya contiene una carpeta.
            } else if (/\.(jpe?g|png|gif|webp|pdf)$/i.test(url)) {
                url = `fotos/${encodeURI(url)}`;
            } else {
                return `<span class="foto-no-disponible">${escapeHTML(raw)}</span>`;
            }
        }
 
        const safeURL = escapeHTML(url);
        const isImage = /\.(jpe?g|png|gif|webp)(?:[?#].*)?$/i.test(url);
 
        const preview = isImage
            ? `<img class="popup-foto" src="${safeURL}" alt="Fotografía del proyecto" loading="lazy" onerror="this.style.display='none'">`
            : '';
 
        return `
<a class="foto-link"
               href="${safeURL}"
               target="_blank"
               rel="noopener noreferrer">
                ${preview}
<span>📷 Abrir fotografía o carpeta</span>
</a>`;
    }).join('');
}
 
function projectPopup(props, categoryName) {
    const name =
        getProp(props, '3_Nombre_de_Proyecto') ||
        'Proyecto sin nombre';
 
    const territory =
        getProp(
            props,
            '1_Territorio_Indgena',
            '1_Territorio_Indígena'
        ) || 'No especificado';
 
    const community =
        getProp(props, '6_Comunidad_TI') || 'N/D';
 
    const description =
        getProp(
            props,
            '4_Descripcin_de_proy',
            '4_Descripción_de_proy'
        ) || 'Sin descripción.';
 
    const investmentRaw =
        getProp(
            props,
            '5_Inversin_CREF',
            '5_Inversión_CREF'
        );
 
    const investmentNumber = parseNumber(investmentRaw);
 
    const investment = investmentNumber !== null
        ? `₡${formatNumber(investmentNumber, 2)} (aprox. $${formatNumber(investmentNumber / 520, 2)} USD)`
        : (isPresent(investmentRaw) ? String(investmentRaw) : 'N/D');
 
    const visitDate =
        formatDate(getProp(props, '11_Fecha_de_visita')) || 'N/D';
 
    const disbursement =
        getProp(props, '8_Desembolso_CREF') || 'N/D';
 
    const photoValue = getProp(
        props,
        '13_Fotografa',
        '13_Fotografía',
        'Fotografia',
        'Fotografía',
        'foto',
        'link_fotografia',
        'enlace_fotografia',
        'url_fotografia'
    );
 
    return `
<div class="popup-proyecto">
<h3>${escapeHTML(name)}</h3>
<p><strong>Territorio:</strong> ${escapeHTML(territory)}</p>
<p><strong>Comunidad:</strong> ${escapeHTML(community)}</p>
<p><strong>Clasificación:</strong> ${escapeHTML(categoryName)}</p>
<p><strong>Descripción:</strong> ${escapeHTML(description).replace(/\r?\n/g, '<br>')}</p>
<p><strong>Inversión CREF:</strong> ${escapeHTML(investment)}</p>
<p><strong>Desembolso:</strong> ${escapeHTML(disbursement)}</p>
<p><strong>Fecha de visita:</strong> ${escapeHTML(visitDate)}</p>
<div class="popup-fotos">${makePhotoLinks(photoValue)}</div>
</div>`;
}
 
/* ============================================================
   6. CARGA DE PROYECTOS Y CATEGORÍAS
   ============================================================ */
 
async function loadProjects() {
    const data = await fetchGeoJSON('datos/puntos.geojson');
    const features = data.features || [];
 
    document.getElementById('kpi-visitas').textContent =
        String(features.length);
 
    buildMonthlyChart(features);
 
    features.forEach((feature, index) => {
        const props = feature.properties || {};
 
        const categoryName = String(
            getProp(props, 'Clasificacion') || 'General'
        ).trim();
 
        const categoryKey = normalizeText(categoryName) || 'general';
        const config = getCategoryConfig(categoryName);
 
        let category = projectCategories.get(categoryKey);
 
        if (!category) {
            category = {
                label: categoryName,
                config,
                count: 0,
                layer: L.markerClusterGroup({
                    maxClusterRadius: 42,
                    showCoverageOnHover: false,
                    spiderfyOnMaxZoom: true,
                    zoomToBoundsOnClick: true,
 
                    iconCreateFunction: (cluster) => {
                        return L.divIcon({
                            html:
                                `<div class="custom-cluster" style="--cluster-color:${config.color}"><span>${cluster.getChildCount()}</span></div>`,
                            className: 'custom-cluster-wrapper',
                            iconSize: [40, 40]
                        });
                    }
                })
            };
 
            projectCategories.set(categoryKey, category);
            category.layer.addTo(map);
 
            layerControl.addItem('proyectos', {
                label: categoryName,
                layer: category.layer,
                count: 0,
                swatchHTML:
                    `<span class="project-legend-dot" style="background:${config.color}">${config.simbolo}</span>`
            });
        }
 
        category.count += 1;
 
        const geometry = feature.geometry;
 
        if (
            !geometry ||
            geometry.type !== 'Point' ||
            !Array.isArray(geometry.coordinates) ||
            geometry.coordinates.length < 2
        ) {
            console.warn(
                `Proyecto ${index + 1} omitido: geometría Point inválida.`,
                feature
            );
            return;
        }
 
        const lng = Number(geometry.coordinates[0]);
        const lat = Number(geometry.coordinates[1]);
 
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }
 
        const marker = L.marker([lat, lng], {
            pane: 'panePuntos',
            icon: createProjectIcon(config, map.getZoom() >= 12),
            title: String(
                getProp(props, '3_Nombre_de_Proyecto') ||
                'Proyecto sin nombre'
            ),
            riseOnHover: true
        });
 
        marker.bindPopup(
            projectPopup(props, categoryName),
            {
                maxWidth: 340,
                minWidth: 230
            }
        );
 
        category.layer.addLayer(marker);
        projectMarkers.push({ marker, config });
 
        const projectName = String(
            getProp(props, '3_Nombre_de_Proyecto') ||
            'Proyecto sin nombre'
        );
 
        const territoryName = String(
            getProp(
                props,
                '1_Territorio_Indgena',
                '1_Territorio_Indígena'
            ) || ''
        );
 
        allLayersSearch.push({
            type: 'proyecto',
            name: `${projectName} ${territoryName} ${categoryName}`,
            projectName,
            marker,
            category
        });
    });
 
    const projectGroup = layerControl.groups.find(
        (group) => group.id === 'proyectos'
    );
 
    projectGroup.items.forEach((item) => {
        const category = Array.from(projectCategories.values())
            .find((entry) => entry.layer === item.layer);
 
        if (category) {
            item.count = category.count;
        }
    });
 
    layerControl.render();
    refreshProjectIcons();
}
 
/* ============================================================
   7. GRÁFICO DE VISITAS POR MES
   Conserva el período de 2025 en adelante de tu código.
   ============================================================ */
 
function buildMonthlyChart(features) {
    const monthlyCounts = new Map();
 
    features.forEach((feature) => {
        const props = feature.properties || {};
        const date = parseDate(
            getProp(props, '11_Fecha_de_visita')
        );
 
        if (!date || date.getFullYear() < 2025) return;
 
        const key =
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
 
        if (!monthlyCounts.has(key)) {
            monthlyCounts.set(key, {
                year: date.getFullYear(),
                month: date.getMonth(),
                count: 0
            });
        }
 
        monthlyCounts.get(key).count += 1;
    });
 
    const entries = Array.from(monthlyCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
 
    const monthNames = [
        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
 
    const labels = entries.map(([, value]) =>
        `${monthNames[value.month]} ${value.year}`
    );
 
    const values = entries.map(([, value]) => value.count);
 
    const canvas = document.getElementById('visitasChart');
    const emptyMessage = document.getElementById('chart-empty');
 
    if (typeof Chart === 'undefined' || !canvas) {
        console.error('Chart.js no está disponible.');
        return;
    }
 
    if (chartInstance) chartInstance.destroy();
 
    emptyMessage.hidden = entries.length > 0;
    canvas.hidden = entries.length === 0;
 
    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
 
        data: {
            labels,
            datasets: [{
                label: 'Visitas',
                data: values,
                backgroundColor: '#0f766e',
                borderRadius: 4,
                maxBarThickness: 28
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
                        maxTicksLimit: 9,
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 9 }
                    }
                }
            }
        }
    });
}
 
/* ============================================================
   8. BUSCADOR
   ============================================================ */
 
document.getElementById('buscador').addEventListener('input', (event) => {
    const query = normalizeText(event.target.value);
    const feedback = document.getElementById('search-feedback');
 
    if (query.length < 2) {
        feedback.textContent = '';
        return;
    }
 
    const match = allLayersSearch.find(
        (item) => normalizeText(item.name).includes(query)
    );
 
    if (!match) {
        feedback.textContent = 'Sin coincidencias';
        return;
    }
 
    feedback.textContent = match.type === 'territorio'
        ? `Encontrado: ${match.item.name}`
        : `Encontrado: ${match.projectName}`;
 
    if (match.type === 'territorio') {
        if (!map.hasLayer(match.layer)) {
            map.addLayer(match.layer);
        }
 
        showTerritoryInfo(match.item, true);
    } else {
        if (!map.hasLayer(match.category.layer)) {
            map.addLayer(match.category.layer);
        }
 
        match.category.layer.zoomToShowLayer(
            match.marker,
            () => {
                map.flyTo(
                    match.marker.getLatLng(),
                    15,
                    { duration: 1.0 }
                );
 
                match.marker.openPopup();
            }
        );
    }
});
 
/* ============================================================
   9. CARGA DE DATOS Y MENSAJES DE ERROR
   ============================================================ */
 
Promise.allSettled([
    loadTerritories(),
    loadProjects()
]).then((results) => {
    const errors = [];
 
    if (results[0].status === 'rejected') {
        console.error(results[0].reason);
        errors.push('datos/territorios.geojson');
    }
 
    if (results[1].status === 'rejected') {
        console.error(results[1].reason);
        errors.push('datos/puntos.geojson');
    }
 
    layerControl.render();
 
    if (errors.length) {
        setStatus(
            `No se pudo cargar ${errors.join(' y ')}. Comprueba sus rutas y nombres en GitHub.`,
            true
        );
    } else {
        setStatus('Datos geográficos cargados correctamente.');
    }
});
