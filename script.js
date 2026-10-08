// 1. Inicializar mapa y Panes para garantizar orden de capas (Z-Index estricto)
const map = L.map('map').setView([9.25, -83.25], 9);

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
let puntosLayersList = [];
let chartInstance = null;

// Función para evaluar si un punto debe mostrarse según los checkboxes activos
function actualizarFiltroPuntos() {
    const checkboxesActivos = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value.trim().toLowerCase());
    
    puntosLayersList.forEach(item => {
        const categoriaPunto = (item.category || '').trim().toLowerCase();
        const coincide = checkboxesActivos.some(cat => categoriaPunto.includes(cat));

        if (coincide) {
            if (!capaPuntosGroup.hasLayer(item.marker)) {
                capaPuntosGroup.addLayer(item.marker);
            }
        } else {
            if (capaPuntosGroup.hasLayer(item.marker)) {
                capaPuntosGroup.removeLayer(item.marker);
            }
        }
    });
}

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
                const nombreTerritorio = props.TERRITORIO || 'Territorio Indígena';

                allLayersSearch.push({ layer, type: 'territorio', name: nombreTerritorio });

                layer.on({
                    mouseover: (e) => { e.target.setStyle(estiloHover); e.target.bringToFront(); },
                    mouseout: (e) => { geoLayer.resetStyle(e.target); },
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

                        document.getElementById('info-decreto').textContent = props.DEcreto || props.DECRETO ? `Decreto ${props.DECRETO || ''} (${props.AÑO || ''})` : 'No especificado';
                        document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';

                        document.getElementById('info-des1').textContent = props['PRIMER DESEMBOLSO'] ? `${props['PRIMER DESEMBOLSO']}` : 'N/D';
                        document.getElementById('info-des2').textContent = props['SEGUNDO DESEMBOLSO'] ? `${props['SEGUNDO DESEMBOLSO']}` : 'N/D';

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
        capaTerritoriosGroup.addLayer(geoLayer);
    });

// 3. Cargar Puntos de Proyectos
fetch('datos/puntos.geojson')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-visitas').textContent = data.features.length;

        // Procesar gráfico de visitas por fecha exacta (DD/MM/YYYY)
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

        const puntosLayer = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                const p = feature.properties || {};
                const catRaw = (p.Clasificacion || '').trim().toLowerCase();
                const color = coloresCategorias[catRaw] || '#0f766e';

                const marker = L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: color,
                    color: '#ffffff',
                    weight: 2,
                    fillOpacity: 0.95,
                    pane: 'panePuntos'
                });

                marker.categoryKey = catRaw;
                puntosLayersList.push({ marker, category: catRaw });
                return marker;
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties || {};

                const nombreProj = p['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
                const territorio = p['1_Territorio_Indgena'] || 'No especificado';
                const comunidad = p['6_Comunidad_TI'] || 'N/D';
                const catFormateada = p.Clasificacion || 'General';
                const desc = p['4_Descripcin_de_proy'] || 'Sin descripción detallada.';
                const inversion = p['5_Inversin_CREF'] !== undefined ? `₡${Number(p['5_Inversin_CREF']).toLocaleString()}` : 'N/D';
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

        // Añadir puntos al grupo principal respetando los filtros iniciales
        puntosLayersList.forEach(item => capaPuntosGroup.addLayer(item.marker));
        actualizarFiltroPuntos();
    });

// 4. Control de capas estándar de Leaflet (para encender/apagar grupos globales)
L.control.layers(null, {
    "Territorios Indígenas": capaTerritoriosGroup,
    "Proyectos / Visitas": capaPuntosGroup
}, { collapsed: false }).addTo(map);

// 5. Filtrado por Checkboxes de Categorías
document.querySelectorAll('.cat-filter').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        actualizarFiltroPuntos();
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
