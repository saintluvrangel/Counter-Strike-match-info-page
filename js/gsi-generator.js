(function initGsiGeneratorModule(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GsiGenerator = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGsiGenerator(root) {
  'use strict';

  const dataOptions = Object.freeze([
    ['provider', 'Provider'], ['map', 'Map'], ['round', 'Round'], ['player_id', 'Player ID'],
    ['player_state', 'Player State'], ['player_weapons', 'Player Weapons'], ['player_match_stats', 'Player Match Stats'],
    ['allplayers_id', 'All Players ID'], ['allplayers_state', 'All Players State'],
    ['allplayers_match_stats', 'All Players Match Stats'], ['allplayers_weapons', 'All Players Weapons'],
    ['allplayers_position', 'All Players Position'], ['phase_countdowns', 'Phase Countdowns'],
    ['allgrenades', 'All Grenades'], ['map_round_wins', 'Map Round Wins'], ['bomb', 'Bomb']
  ]);

  function randomToken(length = 48) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(length);
    if (root.crypto?.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  }

  function escapeKeyValue(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
  }

  function generateConfig({ name, token, port, selectedData }) {
    const safePort = Number(port);
    if (!Number.isInteger(safePort) || safePort < 1 || safePort > 65535) throw new Error('Порт должен быть числом от 1 до 65535');
    if (!String(name || '').trim()) throw new Error('Укажите название интеграции');
    if (!String(token || '').trim()) throw new Error('Укажите API-токен');

    const selected = new Set(selectedData || []);
    const dataLines = dataOptions
      .filter(([key]) => selected.has(key))
      .map(([key]) => `        "${key}"${' '.repeat(Math.max(1, 25 - key.length))}"1"`)
      .join('\n');

    return `"${escapeKeyValue(name.trim())}"
{
    "uri" "http://127.0.0.1:${safePort}"
    "timeout" "5.0"
    "buffer" "0.1"
    "throttle" "0.5"
    "heartbeat" "30.0"
    "auth"
    {
        "token" "${escapeKeyValue(token.trim())}"
    }
    "data"
    {
${dataLines}
    }
}`;
  }

  function safeFileName(name) {
    const normalized = String(name || 'gamestate_integration_cs2_dashboard')
      .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return `${normalized || 'gamestate_integration_cs2_dashboard'}.cfg`;
  }

  function init() {
    const form = document.getElementById('gsi-form');
    if (!form || form.dataset.initialized === 'true') return;
    form.dataset.initialized = 'true';

    const tokenInput = document.getElementById('gsi-token');
    const output = document.getElementById('gsi-output');
    const status = document.getElementById('gsi-status');
    const optionsRoot = document.getElementById('gsi-data-options');
    tokenInput.value = randomToken();
    optionsRoot.innerHTML = dataOptions.map(([key, label]) => `<label class="check-option"><input type="checkbox" name="gsi-data" value="${key}" checked><span>${label}</span></label>`).join('');

    function values() {
      return {
        name:document.getElementById('gsi-name').value,
        token:tokenInput.value,
        port:document.getElementById('gsi-port').value,
        selectedData:Array.from(form.querySelectorAll('[name="gsi-data"]:checked'), (input) => input.value)
      };
    }

    function renderConfig() {
      try {
        output.value = generateConfig(values());
        status.textContent = 'Конфиг сгенерирован';
        return true;
      } catch (error) {
        status.textContent = error.message;
        return false;
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderConfig();
    });
    document.getElementById('regenerate-token').addEventListener('click', () => {
      tokenInput.value = randomToken();
      renderConfig();
    });
    document.getElementById('copy-gsi').addEventListener('click', async () => {
      if (!output.value && !renderConfig()) return;
      try {
        await navigator.clipboard.writeText(output.value);
        status.textContent = 'Скопировано в буфер обмена';
      } catch {
        output.select();
        document.execCommand('copy');
        status.textContent = 'Скопировано в буфер обмена';
      }
    });
    document.getElementById('download-gsi').addEventListener('click', () => {
      if (!output.value && !renderConfig()) return;
      const url = URL.createObjectURL(new Blob([output.value], { type:'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName(document.getElementById('gsi-name').value);
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = 'Файл скачан';
    });

    renderConfig();
  }

  return { init, generateConfig, randomToken, safeFileName, dataOptions };
});
