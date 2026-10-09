'use strict';

// 1. Inicialización del mapa y paneles
const map = L.map('map', {
    zoomControl: true,
    preferCanvas: false
}).setView([9.25, -83.25], 9);

map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;

map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650;

// 2. Mapas base
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '&copy; CARTO' }),
    esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '&copy; Esri' })
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

// 3. Estilos y variables
const estiloNormal = { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.30, pane: 'paneTerritorios' };
const estiloHover = { color: '#0f766e', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.48, pane: 'paneTerritorios' };
const estiloSeleccionado = { color: '#115e59', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.46, pane: 'paneTerritorios' };

let selectedTerritoryLayer = null;
let chartInstance = null;
let layerControl = null;

const allLayersSearch = [];
const territoriosPorNombre = {};
const proyectosPorCategoria = {};

// Colores por categoría de proyectos
const coloresCategorias = {
    "infraestructura comunitaria y social": "#2563eb",
    "infraestructura de servicios basicos": "#dc2626",
    "educacion, cultura y juventud": "#d97706",
    "turismo sostenible y emprendimientos productivos": "#16a34a",
    "seguridad, vigilancia y gestion ambiental": "#9333ea",
    "ayuda social y mejoramiento de infraestructura": "#db2777"
};

// 4. Helpers de formato y normalización
function normalizeText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (!value) return null;
    let raw = String(value).trim().replace(/[₡$\s]/g, '');
    raw = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

function formatNumber(value, decimals = 2) {
    const num = parseNumber(value);
    if (num === null) return null;
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(num);
}

// 5. Formateador exacto basado en tus columnas de desembolso
function formatearDesembolso(fecha, usd, crc) {
    const tieneFecha = fecha !== undefined && fecha !== null && String(fecha).trim() !== '';
    const montoUSD = parseNumber(usd);
    const montoCRC = parseNumber(crc);

    if (!tieneFecha && montoUSD === null && montoCRC === null) {
        return '<span style="color:#94a3b8;">No asignado</span>';
    }

    let html = '';
    if (montoCRC !== null) {
        html += '<strong style="color:#0f766e;">₡' + formatNumber(montoCRC, 2) + '</strong><br>';
    }
    if (montoUSD !== null) {
        html += '<small style="color:#64748b;">($" + formatNumber(montoUSD, 2) + " USD)</small><br>';
    }
    if (tieneFecha) {
        html += '<span style="font-size:0.75rem; color:#0f766e; font-weight:600;">Fecha: ' + String(fecha).trim() + '</span>';
    }
    return html || '<span style="color:#94a3b8;">No asignado</span>';
}

// Actualizar control de capas en Leaflet de forma limpia
function actualizarControlCapas() {
    if (layerControl) {
        map.removeControl(layerControl);
    }
    layerControl = L.control.layers(null, {
        "Territorios Indígenas": territoriosPorNombre,
        "Proyectos Visitados": proyectosPorCategoria
    }, { collapsed: false }).addTo(map);
}

// 6. Cargar Territorios Indígenas
fetch('datos/territorios.geojson')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-territorios').textContent = data.features.length;

        data.features.forEach(feature => {
            const props = feature.properties || {};
            const nombreTerritorio = props.TERRITORIO || 'Territorio Indígena';

            const individualLayer = L.geoJSON(feature, {
                style: estiloNormal,
                pane: 'paneTerritorios',
                onEachFeature: (feat, layer) => {
                    allLayersSearch.push({ type: 'territorio', name: nombreTerritorio, layer });

                    layer.on({
                        mouseover: (e) => { e.target.setStyle(estiloHover); e.target.bringToFront(); },
                        mouseout: (e) => { 
                            individualLayer.resetStyle(e.target);
                            if (e.target === selectedTerritoryLayer) e.target.setStyle(estiloSeleccionado);
                        },
                        click: (e) => {
                            map.flyToBounds(e.target.getBounds(), { padding: [40, 40], duration: 1.1 });
                            document.getElementById('info-nombre').textContent = nombreTerritorio;

                            const clasif = (props.CLASIF || '').toUpperCase();
                            const badgeCref = document.getElementById('badge-cref');
                            const badgePaft = document.getElementById('badge-paft');

                            badgeCref.textContent = 'CREF: ' + (clasif.includes('CREF') ? 'Sí' : 'No');
                            badgeCref.className = 'tag-programa ' + (clasif.includes('CREF') ? 'tag-active' : 'tag-inactive');

                            badgePaft.textContent = 'PAFT: ' + (clasif.includes('PAFT') ? 'Sí' : 'No');
                            badgePaft.className = 'tag-programa ' + (clasif.includes('PAFT') ? 'tag-active' : 'tag-inactive');

                            document.getElementById('info-decreto').textContent = props.DECRETO ? 'Decreto ' + props.DECRETO + (props.AÑO ? ' (' + props.AÑO + ')' : '') : 'No especificado';
                            document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';

                            // Lectura exacta utilizando tus columnas de desembolso
                            document.getElementById('info-des1').innerHTML = formatearDesembolso(props['fec_desemb_1'], props['monto_desemb_1_usd'], props['monto_desemb_1_crc']);
                            document.getElementById('info-des2').innerHTML = formatearDesembolso(props['fec_desemb_2'], props['monto_desemb_2_usd'], props['monto_desemb_2_crc']);

                            [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].forEach((year) => {
                                const val = props['AE_' + year];
                                document.getElementById('ae-' + year).textContent = (val !== undefined && val !== null && val !== '') ? val : '—';
                            });

                            if (selectedTerritoryLayer && selectedTerritoryLayer !== e.target) {
                                individualLayer.resetStyle(selectedTerritoryLayer);
                            }
                            selectedTerritoryLayer = e.target;
                            e.target.setStyle(estiloSeleccionado);
                        }
                    });
                }
            });

            territoriosPorNombre[nombreTerritorio] = individualLayer;
            individualLayer.addTo(map);
        });

        actualizarControlCapas();
        document.getElementById('data-status').textContent = 'Datos cargados correctamente';
    })
    .catch(err => {
        console.error(err);
        document.getElementById('data-status').textContent = 'Error al cargar territorios.geojson';
    });

// 7. Cargar Puntos de Proyectos
fetch('datos/puntos.geojson')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-visitas').textContent = data.features.length;

        // Gráfico de visitas
        const fechasConteo = {};
        data.features.forEach(f => {
            const fechaStr = (f.properties && f.properties['11_Fecha_de_visita']) ? String(f.properties['11_Fecha_de_visita']).trim() : '';
            if (fechaStr) {
                fechasConteo[fechaStr] = (fechasConteo[fechaStr] || 0) + 1;
            }
        });

        const labels = Object.keys(fechasConteo).sort();
        const values = labels.map(l => fechasConteo[l]);

        const ctx = document.getElementById('visitasChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Sin fechas'],
                datasets: [{ label: 'Visitas', data: values.length ? values : [0], backgroundColor: '#0f766e', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Agrupar proyectos por categoría
        const categoriasMap = {};
        data.features.forEach(feature => {
            const props = feature.properties || {};
            const catName = props.Clasificacion ? String(props.Clasificacion).trim() : 'General';
            if (!categoriasMap[catName]) {
                categoriasMap[catName] = [];
            }
            categoriasMap[catName].push(feature);
        });

        Object.keys(categoriasMap).forEach(catName => {
            const featuresCat = categoriasMap[catName];

            const layerCat = L.geoJSON({ type: "FeatureCollection", features: featuresCat }, {
                pointToLayer: (feature, latlng) => {
                    const props = feature.properties || {};
                    const catKey = (props.Clasificacion || '').trim().toLowerCase();
                    const color = coloresCategorias[catKey] || '#0f766e';

                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: color,
                        color: '#ffffff',
                        weight: 2,
                        fillOpacity: 0.95,
                        pane: 'panePuntos'
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};

                    const nombreProj = props['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
                    const territorio = props['1_Territorio_Indgena'] || 'No especificado';
                    const comunidad = props['6_Comunidad_TI'] || 'N/D';
                    const desc = props['4_Descripcin_de_proy'] || 'Sin descripción.';
                    const inversionNum = parseNumber(props['5_Inversin_CREF']);
                    const inversion = inversionNum !== null ? '₡' + formatNumber(inversionNum, 2) : 'N/D';
                    const fecha = props['11_Fecha_de_visita'] || 'N/D';
                    const desembolso = props['8_Desembolso_CREF'] || 'N/D';

                    allLayersSearch.push({ type: 'punto', name: nombreProj, layer });

                    layer.bindPopup(
                        '<div class="popup-proyecto">' +
                            '<h3>' + nombreProj + '</h3>' +
                            '<p><strong>Territorio:</strong> ' + territorio + '</p>' +
                            '<p><strong>Comunidad:</strong> ' + comunidad + '</p>' +
                            '<p><strong>Clasificación:</strong> ' + catName + '</p>' +
                            '<p><strong>Descripción:</strong> ' + desc + '</p>' +
                            '<p><strong>Inversión CREF:</strong> ' + inversion + '</p>' +
                            '<p><strong>Desembolso:</strong> ' + desembolso + '</p>' +
                            '<p><strong>Fecha de Visita:</strong> ' + fecha + '</p>' +
                        '</div>',
                        { maxWidth: 320 }
                    );
                }
            });

            proyectosPorCategoria[catName] = layerCat;
            layerCat.addTo(map);
        });

        actualizarControlCapas();
    })
    .catch(err => {
        console.error(err);
    });

// 8. Buscador rápido
document.getElementById('buscador').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) return;

    const match = allLayersSearch.find(item => item.name && item.name.toLowerCase().includes(query));
    if (match) {
        if (match.type === 'territorio') {
            match.layer.fire('click');
        } else {
            map.setView(match.layer.getLatLng(), 15);
            match.layer.openPopup();
        }
    }
});
