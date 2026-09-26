(function initDemoApi(root) {
  'use strict';

  function headers(extra = {}) {
    const user = root.Auth?.getUser?.();
    return { ...extra, 'X-CS2-Role':user?.role || '', 'X-CS2-User':user?.email || '' };
  }

  async function readResponse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || 'Не удалось обработать демо');
    return body;
  }

  async function importFile(matchId, file, targetMap = 'auto') {
    return readResponse(await fetch('/api/demos/import', {
      method:'POST',
      headers:headers({ 'Content-Type':'application/octet-stream', 'X-Demo-Match-Id':String(matchId), 'X-Demo-Filename':encodeURIComponent(file.name), 'X-Demo-Target-Map':encodeURIComponent(targetMap) }),
      body:file
    }));
  }

  async function importUrl(matchId, url, targetMap = 'auto') {
    return readResponse(await fetch('/api/demos/import', {
      method:'POST', headers:headers({ 'Content-Type':'application/json' }), body:JSON.stringify({ matchId:String(matchId), url, targetMap })
    }));
  }

  async function get(matchId) {
    const response = await fetch(`/api/demos/${encodeURIComponent(String(matchId))}`, { headers:headers() });
    if (response.status === 404) return null;
    return readResponse(response);
  }

  root.DemoApi = { importFile, importUrl, get };
})(window);
