(function initDemoImporter(root) {
  'use strict';

  let initialized = false;
  const fallbackMaps = ['Ancient','Anubis','Cache','Dust2','Inferno','Mirage','Nuke','Overpass','Train','Vertigo'];

  function setStatus(message, state = 'info') {
    const status = document.getElementById('demo-import-status');
    status.textContent = message;
    status.dataset.state = state;
  }

  function option(select, value, label) {
    const item = document.createElement('option');
    item.value = value; item.textContent = label; select.appendChild(item);
  }

  function fillMapChoices(matches) {
    const matchSelect = document.getElementById('demo-match-select');
    const mapSelect = document.getElementById('demo-map-select');
    const match = matches.find((entry) => String(entry.id) === matchSelect.value);
    const maps = [...new Set((match?.maps || []).map(([name]) => name).filter((name) => name && name !== 'TBA'))];
    mapSelect.replaceChildren();
    option(mapSelect, 'auto', 'Авто по названию карты в демо');
    (maps.length ? maps : fallbackMaps).forEach((name) => option(mapSelect, name, name));
  }

  async function fillMatches() {
    const select = document.getElementById('demo-match-select');
    const matches = await root.MatchesApi.list();
    select.replaceChildren();
    matches.forEach((match) => option(select, match.id, `${match.teamA.name} — ${match.teamB.name} · ${match.date}`));
    fillMapChoices(matches);
    select.addEventListener('change', () => fillMapChoices(matches));
  }

  function init() {
    if (initialized) return;
    initialized = true;
    const form = document.getElementById('demo-import-form');
    const fileInput = document.getElementById('demo-file-input');
    const fileName = document.getElementById('demo-file-name');
    const urlInput = document.getElementById('demo-url-input');
    const mapSelect = document.getElementById('demo-map-select');
    const allMaps = document.getElementById('demo-all-maps');
    const submit = document.getElementById('demo-import-submit');
    fileInput.addEventListener('change', () => { fileName.textContent = fileInput.files[0]?.name || 'Файл не выбран'; });
    allMaps.addEventListener('change', () => { mapSelect.disabled = allMaps.checked; });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const matchId = document.getElementById('demo-match-select').value;
      const file = fileInput.files[0];
      const url = urlInput.value.trim();
      const targetMap = allMaps.checked ? 'all' : mapSelect.value;
      if (!matchId || (!file && !url)) { setStatus('Выберите матч и загрузите файл или вставьте ссылку на демо.', 'error'); return; }
      if (file && !/\.(dem|zip)$/i.test(file.name)) { setStatus('Поддерживаются только файлы .dem и .zip.', 'error'); return; }
      const maxFileSize = file?.name.toLowerCase().endsWith('.zip') ? 5 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024;
      if (file && file.size > maxFileSize) { setStatus(`Файл больше разрешённого размера ${file.name.toLowerCase().endsWith('.zip') ? '5 ГБ' : '1 ГБ'}.`, 'error'); return; }
      submit.disabled = true;
      submit.textContent = 'Загружаю и разбираю…';
      setStatus(targetMap === 'all' ? 'Демо загружаются. Проверяю карты архива и привязываю их к картам серии…' : 'Демо загружается. Сверяю выбранную карту с картой внутри демо…');
      try {
        const result = file ? await root.DemoApi.importFile(matchId, file, targetMap) : await root.DemoApi.importUrl(matchId, url, targetMap);
        const mapText = result.maps.join(', ');
        setStatus(`Демо сохранено: ${mapText}; раундов: ${result.rounds}; точек гранат: ${result.grenadePoints}. Открываю матч…`, 'success');
        root.location.hash = `#match/${matchId}`;
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Разобрать и загрузить на сайт';
      }
    });
    fillMatches().catch((error) => setStatus(error.message, 'error'));
  }

  root.DemoImporter = { init };
})(window);
