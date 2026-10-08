// 1. Inicializar mapa y Panes para garantizar orden de capas (Z-Index estricto)
const map = L.map('map').setView([9.25, -83.25], 9);

map.createPane('paneTerritorios');
map.getPane('paneTerritorios').style.zIndex = 400;

map.createPane('panePuntos');
map.getPane('panePuntos').style.zIndex = 650;

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

const estiloNormal = { color: '#0f766e', weight: 1.5, fillColor: '#14b8a6', fillOpacity: 0.35, pane: 'paneTerritorios' };
const estiloHover = { color: '#0f766e', weight: 3, fillColor: '#2dd4bf', fillOpacity: 0.55, pane: 'paneTerritorios' };

// Colores según las clasificaciones exactas de tus puntos
const coloresCategorias = {
    "infraestructura comunitaria y social": "#2563eb",
    "infraestructura de servicios basicos": "#dc2626",
    "educacion, cultura y juventud": "#d97706",
    "turismo sostenible y emprendimientos productivos ": "#16a34a",
    "turismo sostenible y emprendimientos productivos": "#16a34a",
    "seguridad, vigilancia y gestion ambiental": "#9333ea",
    "ayuda social y mejoramiento de infraestructura": "#db2777"
};

let allLayersSearch = [];
let chartInstance = null;

// Grupos principales para el menú de Leaflet
const territoriosGroup = L.layerGroup().addTo(map);
const proyectosGroup = L.layerGroup().addTo(map);

// Subcapas por categoría para los puntos dentro de Proyectos
const categoriasLayers = {};

const overlayMaps = {
    "Territorios Indígenas": territoriosGroup,
    "Proyectos Visitados (Puntos)": proyectosGroup
};

let controlCapas = L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

// 2. Cargar Territorios Indígenas
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
                    allLayersSearch.push({ layer, type: 'territorio', name: nombreTerritorio });

                    layer.on({
                        mouseover: (e) => { e.target.setStyle(estiloHover); e.target.bringToFront(); },
                        mouseout: (e) => { individualLayer.resetStyle(e.target); },
                        click: (e) => {
                            map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
                            document.getElementById('info-nombre').textContent = nombreTerritorio;

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

                            document.getElementById('info-decreto').textContent = props.DECRETO ? `Decreto ${props.DECRETO} (${props.AÑO || ''})` : 'No especificado';
                            document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';

                            // Mostrar el año del desembolso tal como viene en las propiedades
                            const anioDes1 = props['PRIMER DESEMBOLSO'];
                            const anioDes2 = props['SEGUNDO DESEMBOLSO'];

                            document.getElementById('info-des1').innerHTML = anioDes1 ? `<strong style="font-size: 1.1rem; color: #0f766e;">${anioDes1}</strong><br><small style="color:#64748b;">Año de Desembolso</small>` : '<span style="color:#94a3b8;">No asignado</span>';
                            document.getElementById('info-des2').innerHTML = anioDes2 ? `<strong style="font-size: 1.1rem; color: #0f766e;">${anioDes2}</strong><br><small style="color:#64748b;">Año de Desembolso</small>` : '<span style="color:#94a3b8;">No asignado</span>';

                            document.getElementById('ae-2017').textContent = props.AE_2017 ?? '-';
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

            territoriosGroup.addLayer(individualLayer);
        });
    });

// 3. Cargar Puntos de Proyectos
fetch('datos/puntos.geojson')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-visitas').textContent = data.features.length;

        // Gráfico de visitas por fecha exacta (DD/MM/YYYY)
        const fechasConteo = {};
        data.features.forEach(f => {
            const p = f.properties || {};
            const fechaStr = (p['11_Fecha_de_visita'] || '').trim();
            if (fechaStr) {
                fechasConteo[fechaStr] = (fechasConteo[fechaStr] || 0) + 1;
            }
        });

        const fechasOrdenadas = Object.keys(fechasConteo).sort();
        const valoresVisitas = fechasOrdenadas.map(f => fechasConteo[f]);

        const ctx = document.getElementById('visitasChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fechasOrdenadas.length ? fechasOrdenadas : ['Sin fechas válidas'],
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
                    x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 } }
                }
            }
        });

        // Agrupar puntos por categoría para el menú desplegable
        const categoriasMap = {};
        data.features.forEach(feature => {
            const p = feature.properties || {};
            const catRaw = (p.Clasificacion || 'General').trim();
            if (!categoriasMap[catRaw]) {
                categoriasMap[catRaw] = [];
            }
            categoriasMap[catRaw].push(feature);
        });

        Object.keys(categoriasMap).forEach(catName => {
            const featuresCat = categoriasMap[catName];
            
            const layerCat = L.geoJSON({ type: "FeatureCollection", features: featuresCat }, {
                pointToLayer: (feature, latlng) => {
                    const p = feature.properties || {};
                    const catKey = (p.Clasificacion || '').trim().toLowerCase();
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
                    const p = feature.properties || {};

                    const nombreProj = p['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
                    const territorio = p['1_Territorio_Indgena'] || 'No especificado';
                    const comunidad = p['6_Comunidad_TI'] || 'N/D';
                    const catFormateada = p.Clasificacion || 'General';
                    const desc = p['4_Descripcin_de_proy'] || 'Sin descripción detallada.';
                    const inversionVal = p['5_Inversin_CREF'];
                    const inversion = inversionVal !== undefined ? `₡${Number(inversionVal).toLocaleString()} (~$${(Number(inversionVal)/520).toFixed(2)} USD)` : 'N/D';
                    const fecha = p['11_Fecha_de_visita'] || 'N/D';
                    const desembolso = p['8_Desembolso_CREF'] || 'N/D';
                    const colaborador = p['12_Colaboradora_o'] || 'N/D';

                    allLayersSearch.push({ layer, type: 'punto', name: nombreProj });

                    layer.bindPopup(`
                        <div class="popup-proyecto">
                            <h3>${nombreProj}</h3>
                            <p><strong>Territorio:</strong> ${territorio}</p>
                            <p><strong>Comunidad:</strong> ${comunidad}</p>
                            <p><strong>Clasificación:</strong> ${catFormateada}</p>
                            <p><strong>Descripción:</strong> ${desc.replace(/\n/g, '<br>')}</p>
                            <p><strong>Inversión CREF:</strong> ${inversion}</p>
                            <p><strong>Desembolso:</strong> ${desembolso}</p>
                            <p><strong>Fecha de Visita:</strong> ${fecha}</p>
                            <p><strong>Colaborador(a):</strong> ${colaborador}</p>
                            <div class="popup-img-preview">📸 Fotografía: ${p['13_Fotografa'] || 'N/D'}</div>
                        </div>
                    `, { maxWidth: 320 });
                }
            });

            categoriasLayers[catName] = layerCat;
            proyectosGroup.addLayer(layerCat);
        });

        // Actualizar el control de capas en Leaflet con las categorías independientes
        if (controlCapas) controlCapas.remove();
        controlCapas = L.control.layers(null, {
            "Territorios Indígenas": territoriosGroup,
            "Proyectos Visitados": categoriasLayers
        }, { collapsed: false }).addTo(map);
    });

// 4. Buscador Rápido Global corregido
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
