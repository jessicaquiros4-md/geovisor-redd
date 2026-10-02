// 1. Inicializar el mapa centrado en Costa Rica
const map = L.map('map').setView([9.7489, -83.7534], 8);

// 2. Agregar capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Estilos de los territorios
const estiloNormal = {
  color: '#0f766e',
  weight: 1.5,
  fillColor: '#14b8a6',
  fillOpacity: 0.35
};

const estiloHover = {
  color: '#0f766e',
  weight: 3,
  fillColor: '#2dd4bf',
  fillOpacity: 0.55
};

// 4. Cargar Territorios Indígenas
fetch('datos/territorios.geojson')
  .then(response => {
    if (!response.ok) throw new Error('No se pudo cargar territorios.geojson');
    return response.json();
  })
  .then(data => {
    const capaTerritorios = L.geoJSON(data, {
      style: estiloNormal,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            e.target.setStyle(estiloHover);
            e.target.bringToFront();
          },
          mouseout: (e) => {
            capaTerritorios.resetStyle(e.target);
          },
          click: (e) => {
            map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
            const props = feature.properties || {};

            // Nombre
            document.getElementById('info-nombre').textContent = props.TERRITORIO || 'Territorio Indígena';

            // Clasificación y Badges (CREF / PAFT)
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

            // Decreto, Bloque y Clasificación texto
            document.getElementById('info-decreto').textContent = props.DECRETO || 'No especificado';
            document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';
            document.getElementById('info-clasif').textContent = props.CLASIF || 'N/D';

            // Desembolsos exactos según tus columnas de QGIS
            document.getElementById('info-des1').textContent = props['PRIMER DESEMBOLS'] ?? props['PRIMER DESEMBOLSO'] ?? 'N/D';
            document.getElementById('info-des2').textContent = props['GUNDO DESEMBOLS'] ?? props['SEGUNDO DESEMBOLSO'] ?? 'N/D';

            // Tabla de áreas (2018 a 2024)
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
    }).addTo(map);
  })
  .catch(error => console.error('Error cargando territorios:', error));

// 5. Cargar Puntos de Visita (Opcional, si tienes tu archivo de puntos)
fetch('datos/puntos.geojson')
  .then(res => res.ok ? res.json() : null)
  .then(data => {
    if (!data) return;
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 6,
        fillColor: '#f43f5e',
        color: '#ffffff',
        weight: 1.5,
        fillOpacity: 0.9
      }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const nombre = props.nombre || props.NOMBRE || props.PUNTO || 'Visita';
        layer.bindPopup(`<strong>Punto:</strong><br>${nombre}`);
      }
    }).addTo(map);
  })
  .catch(() => console.log('Sin capa de puntos activa'));
