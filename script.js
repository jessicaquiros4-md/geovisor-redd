// 1. Inicializar el mapa centrado en Costa Rica
const map = L.map('map').setView([9.7489, -83.7534], 8);

// 2. Agregar capa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Estilo para los territorios indígenas
const estiloTerritorio = {
  color: '#0d9488',
  weight: 2,
  fillColor: '#14b8a6',
  fillOpacity: 0.4
};

// 4. Cargar el archivo GeoJSON (Asegúrate de que la ruta 'datos/territorios.geojson' sea la correcta en tu repo)
fetch('datos/territorios.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('No se pudo cargar el archivo GeoJSON');
    }
    return response.json();
  })
  .then(data => {
    const capaTerritorios = L.geoJSON(data, {
      style: estiloTerritorio,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 3,
              fillOpacity: 0.7
            });
          },
          mouseout: (e) => {
            capaTerritorios.resetStyle(e.target);
          },
          click: (e) => {
            const props = feature.properties || {};

            // 1. Textos principales y nubes
            document.getElementById('info-nombre').textContent = props.TERRITORIO || 'Territorio Indígena';
            document.getElementById('info-anio').textContent = props.AÑO || props.ANO || 'N/D';
            document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';
            
            // 2. Decreto y Clasificación
            document.getElementById('info-decreto').textContent = props.DECRETO || 'N/D';
            document.getElementById('info-clasif').textContent = props.CLASIF || 'N/D';

            // 3. Rellenar la tablita de áreas por año de forma segura
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

    // Ajustar el zoom automáticamente a la capa de territorios si se desea
    // map.fitBounds(capaTerritorios.getBounds());
  })
  .catch(error => console.error('Error al cargar los datos:', error));
