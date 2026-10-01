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
