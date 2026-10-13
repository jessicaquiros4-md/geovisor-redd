'use strict';

/* ============================================================
   GEOVISOR REDD+ — script.js
   ============================================================ */

// 1. Inicialización del mapa y paneles
const map = L.map('map', {
    zoomControl: false,
    preferCanvas: false
}).setView([9.25, -83.25], 9);
L.control.zoom({ position: 'bottomright' }).addTo(map);

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

const allLayersSearch = [];

// Zoom a partir del cual los puntos pasan de un punto simple a su símbolo
const ZOOM_SIMBOLOS = 12;

// Color y símbolo por categoría de proyecto (las claves van sin tildes y en minúscula)
const categoriasConfig = {
    "infraestructura comunitaria y social": { color: "#2563eb", simbolo: "🏘️" },
    "infraestructura de servicios basicos": { color: "#dc2626", simbolo: "💧" },
    "educacion, cultura y juventud": { color: "#d97706", simbolo: "🎓" },
    "turismo sostenible y emprendimientos productivos": { color: "#16a34a", simbolo: "🌿" },
    "seguridad, vigilancia y gestion ambiental": { color: "#9333ea", simbolo: "🛡️" },
    "ayuda social y mejoramiento de infraestructura": { color: "#db2777", simbolo: "🤝" }
};
const categoriaPorDefecto = { color: "#0f766e", simbolo: "📍" };

// 4. Helpers de formato y normalización
function normalizeText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function getCategoriaConfig(nombre) {
    return categoriasConfig[normalizeText(nombre)] || categoriaPorDefecto;
}

// Busca una propiedad ignorando mayúsculas y tildes en el nombre de la columna
function getProp(props, ...nombres) {
    const claves = Object.keys(props || {});
    for (const nombre of nombres) {
        const buscado = normalizeText(nombre);
        const clave = claves.find((k) => normalizeText(k) === buscado);
        if (clave !== undefined && props[clave] !== null && props[clave] !== '') return props[clave];
    }
    return undefined;
}

function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined) return null;

    let raw = String(value).trim().replace(/CRC|USD|[₡$\s]/gi, '');
    if (!raw) return null;

    const tienePunto = raw.includes('.');
    const tieneComa = raw.includes(',');

    if (tienePunto && tieneComa) {
        // El último separador es el decimal
        if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
            raw = raw.replace(/\./g, '').replace(',', '.');   // 1.234.567,89
        } else {
            raw = raw.replace(/,/g, '');                      // 1,234,567.89
        }
    } else if (tieneComa) {
        raw = /^\d{1,3}(,\d{3})+$/.test(raw)
            ? raw.replace(/,/g, '')                           // 1,234,567
            : raw.replace(',', '.');                          // 1234,56
    } else if (tienePunto) {
        if (/^\d{1,3}(\.\d{3}){2,}$/.test(raw)) {
            raw = raw.replace(/\./g, '');                     // 1.234.567
        }                                                     // 1234.56 queda como decimal
    }

    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

function formatNumber(value, decimals = 2) {
    const num = parseNumber(value);
    if (num === null) return null;
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(num);
}

function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') return value > 1e11 ? new Date(value) : null;
    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        return new Date(year, month - 1, day);
    }
    match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[T\s].*)?$/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        return new Date(year, month - 1, day);
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatearFecha(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const fecha = parseDate(value);
    if (!fecha) return String(value).trim();
    return fecha.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Foto del proyecto: acepta un nombre de archivo (carpeta fotos/), un enlace de
// Google Drive, un enlace de Dropbox o cualquier URL directa a una imagen
function urlFoto(valor) {
    const v = String(valor ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v)) {
        const drive = v.match(/drive\.google\.com.*?(?:\/d\/|[?&]id=)([\w-]{10,})/i);
        if (drive) return 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w1000';

        if (/dropbox\.com/i.test(v)) {
            const u = v.replace(/([?&])dl=\d/, '$1raw=1');
            return /raw=1/.test(u) ? u : u + (u.includes('?') ? '&' : '?') + 'raw=1';
        }
        return v;
    }
    return 'fotos/' + encodeURI(v);
}

// Admite una o varias fotos separadas por ;
function htmlFotos(valor) {
    return String(valor ?? '')
        .split(';')
        .map(urlFoto)
        .filter(Boolean)
        .map((url) =>
            `<a href="${url}" target="_blank" rel="noopener">` +
            `<img class="popup-foto" src="${url}" alt="Foto del proyecto" loading="lazy" ` +
            `onerror="this.closest('a').style.display='none'"></a>`
        )
        .join('');
}

// 5. Formateador de desembolsos (monto en colones, monto en dólares y fecha)
function formatearDesembolso(fecha, usd, crc) {
    const montoUSD = parseNumber(usd);
    const montoCRC = parseNumber(crc);
    const fechaTxt = formatearFecha(fecha);

    if (montoUSD === null && montoCRC === null && !fechaTxt) {
        return '<span style="color:#94a3b8; font-size:0.8rem;">No asignado</span>';
    }

    let html = '';
    if (montoCRC !== null) {
        html += `<strong style="color:#0f766e; font-size:0.9rem;">₡${formatNumber(montoCRC, 2)}</strong><br>`;
    }
    if (montoUSD !== null) {
        html += `<small style="color:#64748b;">$${formatNumber(montoUSD, 2)} USD</small><br>`;
    }
    if (fechaTxt) {
        html += `<span style="font-size:0.75rem; color:#0f766e; font-weight:600;">Fecha: ${fechaTxt}</span>`;
    }
    return html;
}

// 6. Control de capas agrupado (dos grupos desplegables)
const controlCapas = L.control({ position: 'topright' });
controlCapas.grupos = [
    { id: 'territorios', titulo: 'Territorios Indígenas', items: [] },
    { id: 'proyectos', titulo: 'Proyectos Visitados', items: [] }
];
const checkboxesPorCapa = new Map();

controlCapas.onAdd = function () {
    this._contenedor = L.DomUtil.create('div', 'leaflet-control capas-agrupadas');
    L.DomEvent.disableClickPropagation(this._contenedor);
    L.DomEvent.disableScrollPropagation(this._contenedor);
    this.render();
    return this._contenedor;
};

controlCapas.agregar = function (idGrupo, item) {
    this.grupos.find((g) => g.id === idGrupo).items.push(item);
};

controlCapas.render = function () {
    if (!this._contenedor) return;
    const contenedor = this._contenedor;
    contenedor.innerHTML = '';
    checkboxesPorCapa.clear();

    this.grupos.forEach((grupo) => {
        const details = L.DomUtil.create('details', 'capas-grupo', contenedor);
        details.open = true;

        const summary = L.DomUtil.create('summary', 'capas-grupo-titulo', details);
        summary.textContent = grupo.titulo;

        const acciones = L.DomUtil.create('div', 'capas-acciones', details);
        const btnTodos = L.DomUtil.create('button', '', acciones);
        btnTodos.type = 'button';
        btnTodos.textContent = 'Mostrar todos';
        btnTodos.addEventListener('click', () => grupo.items.forEach((i) => map.addLayer(i.capa)));

        const btnNinguno = L.DomUtil.create('button', '', acciones);
        btnNinguno.type = 'button';
        btnNinguno.textContent = 'Ocultar todos';
        btnNinguno.addEventListener('click', () => grupo.items.forEach((i) => map.removeLayer(i.capa)));

        const lista = L.DomUtil.create('div', 'capas-lista', details);
        if (!grupo.items.length) {
            const vacio = L.DomUtil.create('span', 'capas-vacio', lista);
            vacio.textContent = 'Cargando…';
            return;
        }

        [...grupo.items]
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
            .forEach((item) => {
                const label = L.DomUtil.create('label', 'capas-item', lista);

                const checkbox = L.DomUtil.create('input', '', label);
                checkbox.type = 'checkbox';
                checkbox.checked = map.hasLayer(item.capa);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) map.addLayer(item.capa);
                    else map.removeLayer(item.capa);
                });

                const simbolo = L.DomUtil.create('span', 'capas-simbolo', label);
                simbolo.innerHTML = item.simboloHTML;

                const texto = L.DomUtil.create('span', 'capas-texto', label);
                texto.textContent = item.etiqueta;

                if (item.conteo !== undefined) {
                    const conteo = L.DomUtil.create('span', 'capas-conteo', label);
                    conteo.textContent = item.conteo;
                }

                checkboxesPorCapa.set(L.stamp(item.capa), checkbox);
            });
    });
};

controlCapas.addTo(map);

// Mantiene los checkboxes sincronizados si una capa se enciende/apaga desde el buscador
map.on('layeradd layerremove', (e) => {
    const checkbox = checkboxesPorCapa.get(L.stamp(e.layer));
    if (checkbox) checkbox.checked = (e.type === 'layeradd');
});

// 7. Cargar Territorios Indígenas
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

                            // Desembolsos: montos en USD y CRC + fechas
                            // (si algo no aparece, revisa en la consola los nombres reales de las columnas)
                            console.debug('Propiedades del territorio:', props);
                            document.getElementById('info-des1').innerHTML = formatearDesembolso(
                                getProp(props, 'fec_desemb_1'),
                                getProp(props, 'monto_desemb_1_usd'),
                                getProp(props, 'monto_desemb_1_crc')
                            );
                            document.getElementById('info-des2').innerHTML = formatearDesembolso(
                                getProp(props, 'fec_desemb_2'),
                                getProp(props, 'monto_desemb_2_usd'),
                                getProp(props, 'monto_desemb_2_crc')
                            );

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

            individualLayer.eachLayer((layer) => {
                allLayersSearch.push({ type: 'territorio', name: nombreTerritorio, layer, grupo: individualLayer });
            });

            individualLayer.addTo(map);
            controlCapas.agregar('territorios', {
                etiqueta: nombreTerritorio,
                capa: individualLayer,
                simboloHTML: '<span class="swatch-territorio"></span>'
            });
        });

        controlCapas.render();
        document.getElementById('data-status').textContent = 'Datos cargados correctamente';
    })
    .catch(err => {
        console.error(err);
        document.getElementById('data-status').textContent = 'Error al cargar territorios.geojson';
    });

// 8. Gráfico de visitas ordenado cronológicamente por mes (desde 2025 en adelante)
function construirGraficoVisitas(features) {
    const conteoMeses = new Map();

    features.forEach((feature) => {
        const properties = feature.properties || {};
        const rawDate = properties['11_Fecha_de_visita'];
        const parsedDate = parseDate(rawDate);

        if (!parsedDate) return;

        const year = parsedDate.getFullYear();
        if (year < 2025) return; // Filtrar desde 2025

        const month = parsedDate.getMonth(); // 0 al 11
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;

        const nombresMeses = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];
        const label = `${nombresMeses[month]} ${year}`;

        if (!conteoMeses.has(key)) {
            conteoMeses.set(key, { year, month, label, count: 0 });
        }

        conteoMeses.get(key).count += 1;
    });

    const sortedEntries = Array.from(conteoMeses.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    const labels = sortedEntries.length ? sortedEntries.map((e) => e.label) : ['Sin fechas válidas'];
    const values = sortedEntries.length ? sortedEntries.map((e) => e.count) : [0];

    const canvas = document.getElementById('visitasChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Visitas por mes',
                data: values,
                backgroundColor: '#0f766e',
                borderRadius: 4,
                maxBarThickness: 32
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
                    ticks: { stepSize: 1, precision: 0, font: { size: 10 } }
                },
                x: {
                    ticks: { autoSkip: false, maxRotation: 45, minRotation: 0, font: { size: 9 } }
                }
            }
        }
    });
}

// 9. Iconos de proyectos: punto simple (zoom lejano) o símbolo de categoría (zoom cercano)
function crearIcono(config, usarSimbolo) {
    if (usarSimbolo) {
        return L.divIcon({
            className: 'marcador-wrap',
            html: `<div class="marcador-simbolo" style="background:${config.color}">${config.simbolo}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18]
        });
    }
    return L.divIcon({
        className: 'marcador-wrap',
        html: `<div class="marcador-punto" style="background:${config.color}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8]
    });
}

const marcadoresProyectos = [];
let modoSimbolos = null;

function actualizarIconosProyectos() {
    const usarSimbolos = map.getZoom() >= ZOOM_SIMBOLOS;
    if (usarSimbolos === modoSimbolos) return;
    modoSimbolos = usarSimbolos;
    marcadoresProyectos.forEach(({ marker, config }) => marker.setIcon(crearIcono(config, usarSimbolos)));
}

map.on('zoomend', actualizarIconosProyectos);

// 10. Cargar Puntos de Proyectos
fetch('datos/puntos.geojson')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-visitas').textContent = data.features.length;

        // Construir gráfico optimizado por mes (2025 en adelante)
        construirGraficoVisitas(data.features);

        // Agrupar proyectos por categoría (sin distinguir mayúsculas ni tildes)
        const categoriasMap = {};
        data.features.forEach(feature => {
            const props = feature.properties || {};
            const nombre = props.Clasificacion ? String(props.Clasificacion).trim() : 'General';
            const clave = normalizeText(nombre) || 'general';
            if (!categoriasMap[clave]) {
                categoriasMap[clave] = { nombre, features: [] };
            }
            categoriasMap[clave].features.push(feature);
        });

        Object.values(categoriasMap).forEach(({ nombre: catName, features: featuresCat }) => {
            const config = getCategoriaConfig(catName);

            const layerCat = L.geoJSON({ type: "FeatureCollection", features: featuresCat }, {
                pointToLayer: (feature, latlng) => {
                    const marker = L.marker(latlng, {
                        icon: crearIcono(config, false),
                        pane: 'panePuntos',
                        riseOnHover: true
                    });
                    marcadoresProyectos.push({ marker, config });
                    return marker;
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

                    layer.bindPopup(
                        '<div class="popup-proyecto">' +
                            htmlFotos(getProp(props, 'foto', 'fotografia', 'imagen')) +
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

            layerCat.eachLayer((layer) => {
                const nombreProj = (layer.feature.properties || {})['3_Nombre_de_Proyecto'] || 'Proyecto sin nombre';
                allLayersSearch.push({ type: 'punto', name: nombreProj, layer, grupo: layerCat });
            });

            layerCat.addTo(map);
            controlCapas.agregar('proyectos', {
                etiqueta: catName,
                capa: layerCat,
                conteo: featuresCat.length,
                simboloHTML: `<span class="marcador-simbolo mini" style="background:${config.color}">${config.simbolo}</span>`
            });
        });

        modoSimbolos = null;
        actualizarIconosProyectos();
        controlCapas.render();
    })
    .catch(err => {
        console.error(err);
    });

// 11. Buscador rápido
document.getElementById('buscador').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) return;

    const match = allLayersSearch.find(item => item.name && item.name.toLowerCase().includes(query));
    if (match) {
        // Si la capa estaba apagada en el control, se enciende para poder mostrarla
        if (match.grupo && !map.hasLayer(match.grupo)) map.addLayer(match.grupo);

        if (match.type === 'territorio') {
            map.flyToBounds(match.layer.getBounds(), { padding: [50, 50], duration: 1.2 });
            match.layer.fire('click');
        } else {
            map.flyTo(match.layer.getLatLng(), 15, { duration: 1.2 });
            match.layer.openPopup();
        }
    }
});
