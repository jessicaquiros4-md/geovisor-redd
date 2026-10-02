click: (e) => {
  const props = feature.properties || {};

  // 1. Nombre principal y año del territorio
  document.getElementById('info-nombre').textContent = props.TERRITORIO || 'Territorio Indígena';
  document.getElementById('info-anio').textContent = props.AÑO || props.ANO || 'N/D';

  // 2. Lógica visual automática para CREF y PAFT basada en la columna "CLASIF"
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

  // 3. Decreto, Bloque y Clasificación
  document.getElementById('info-decreto').textContent = props.DECRETO || 'No especificado';
  document.getElementById('info-bloque').textContent = props.BLOQUE || 'N/D';
  document.getElementById('info-clasif').textContent = props.CLASIF || 'N/D';

  // 4. Desembolsos (tomando en cuenta cómo se visualizan en tu tabla)
  document.getElementById('info-des1').textContent = props['PRIMER DESEMBOLS'] ?? props['PRIMER DESEMBOLSO'] ?? 'N/D';
  document.getElementById('info-des2').textContent = props['GUNDO DESEMBOLS'] ?? props['SEGUNDO DESEMBOLSO'] ?? 'N/D';

  // 5. Tabla de áreas efectivas por año (desde AE_2018 hasta AE_2024)
  document.getElementById('ae-2018').textContent = props.AE_2018 ?? '-';
  document.getElementById('ae-2019').textContent = props.AE_2019 ?? '-';
  document.getElementById('ae-2020').textContent = props.AE_2020 ?? '-';
  document.getElementById('ae-2021').textContent = props.AE_2021 ?? '-';
  document.getElementById('ae-2022').textContent = props.AE_2022 ?? '-';
  document.getElementById('ae-2023').textContent = props.AE_2023 ?? '-';
  document.getElementById('ae-2024').textContent = props.AE_2024 ?? '-';
}
