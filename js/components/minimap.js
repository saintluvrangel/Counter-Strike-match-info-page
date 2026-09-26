(function initMinimap(root, factory) {
  const radarConfig = typeof module === 'object' && module.exports
    ? require('../config/radar-config.js')
    : root.CSRadarConfig;
  const mockCoordinates = typeof module === 'object' && module.exports
    ? require('../data/mock-map-coordinates.js')
    : root.CSMockCoordinates;
  const api = factory(radarConfig, mockCoordinates);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CSMinimap = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMinimap(radarConfig, mockCoordinates) {
  'use strict';

  if (!radarConfig) {
    throw new Error('CSRadarConfig must be loaded before minimap.js');
  }

  if (!mockCoordinates) throw new Error('CSMockCoordinates must be loaded before minimap.js');

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function worldToRadar(mapName, position) {
    const overview = radarConfig.getOverview(mapName);
    const pixelX = (Number(position.x) - overview.posX) / overview.scale;
    const pixelY = (overview.posY - Number(position.y)) / overview.scale;
    const x = pixelX / overview.width;
    const y = pixelY / overview.height;

    return {
      x,
      y,
      visible: Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
    };
  }

  function radarToWorld(mapName, position) {
    const overview = radarConfig.getOverview(mapName);

    return {
      x: overview.posX + Number(position.x) * overview.width * overview.scale,
      y: overview.posY - Number(position.y) * overview.height * overview.scale
    };
  }

  function normalizePlayers(players) {
    const playersById = new Map();

    (Array.isArray(players) ? players : []).forEach((player) => {
      if (!player || !player.id || !player.position) return;
      if (player.side !== 'T' && player.side !== 'CT') return;

      const x = Number(player.position.x);
      const y = Number(player.position.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      playersById.set(String(player.id), {
        id: String(player.id),
        nick: player.nick ? String(player.nick) : String(player.id),
        side: player.side,
        number: Number.isFinite(Number(player.number)) ? Number(player.number) : 0,
        weapon: player.weapon ? String(player.weapon) : '',
        weaponUrl: player.weaponUrl ? String(player.weaponUrl) : '',
        health: player.health != null && Number.isFinite(Number(player.health)) ? clamp(Number(player.health), 0, 100) : null,
        heading: Number.isFinite(Number(player.heading)) ? Number(player.heading) : 0,
        alive: player.alive !== false,
        position: { x, y }
      });
    });

    return Array.from(playersById.values());
  }

  function interpolateRoute(route, progress) {
    if (!Array.isArray(route) || !route.length) return { x:.5, y:.5 };
    if (route.length === 1) return { x:route[0][0], y:route[0][1] };
    const bounded = clamp(progress, 0, 1);
    const segmentCount = route.length - 1;
    const segmentPosition = bounded * segmentCount;
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(segmentPosition));
    const localProgress = segmentPosition - segmentIndex;
    const start = route[segmentIndex];
    const end = route[segmentIndex + 1];
    return {
      // Прямая интерполяция не создаёт кривые, срезающие стены и проходящие через пустые зоны.
      x: start[0] + (end[0] - start[0]) * localProgress,
      y: start[1] + (end[1] - start[1]) * localProgress
    };
  }

  class MockMinimapSource {
    constructor({ mapName, players, intervalMs = 900 }) {
      this.mapName = mapName;
      this.players = Array.isArray(players) ? players : [];
      this.intervalMs = intervalMs;
      this.step = 0;
      this.timer = null;
    }

    subscribe(listener) {
      const emit = () => {
        const sideIndexes = { T: 0, CT: 0 };
        const snapshotPlayers = this.players.map((player, playerIndex) => {
          const side = player.side === 'CT' ? 'CT' : 'T';
          const routes = mockCoordinates.getRoutes(this.mapName, side);
          const route = routes[sideIndexes[side]++ % Math.max(1, routes.length)] || [[.5, .5], [.5, .5]];
          const rawProgress = (this.step * .075 + playerIndex * .09) % 2;
          const progress = rawProgress <= 1 ? rawProgress : 2 - rawProgress;
          const radarPosition = interpolateRoute(route, progress);

          return {
            ...player,
            position: radarToWorld(this.mapName, radarPosition)
          };
        });

        listener({ mapName: this.mapName, players: snapshotPlayers, source: 'mock' });
        this.step += 1;
      };

      emit();
      this.timer = setInterval(emit, this.intervalMs);

      return () => this.stop();
    }

    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  }

  class MinimapController {
    constructor({ root, layer, radarImage }) {
      this.root = root;
      this.layer = layer;
      this.radarImage = radarImage;
      this.mapName = null;
      this.markers = new Map();
      this.unsubscribe = null;
      this.boundSyncLayer = () => this.syncLayerBounds();

      this.radarImage.addEventListener('load', this.boundSyncLayer);
      if (typeof ResizeObserver === 'function') {
        this.resizeObserver = new ResizeObserver(this.boundSyncLayer);
        this.resizeObserver.observe(this.root);
      } else {
        window.addEventListener('resize', this.boundSyncLayer);
      }
    }

    setMap(mapName) {
      radarConfig.getOverview(mapName);
      this.mapName = mapName;
      this.clear();
      requestAnimationFrame(this.boundSyncLayer);
    }

    connect(source) {
      this.disconnect();
      if (!source || typeof source.subscribe !== 'function') return;
      this.unsubscribe = source.subscribe((snapshot) => this.update(snapshot));
    }

    disconnect() {
      if (typeof this.unsubscribe === 'function') this.unsubscribe();
      this.unsubscribe = null;
    }

    update(snapshot) {
      if (!snapshot || !snapshot.mapName || snapshot.mapName !== this.mapName) return;

      const activeIds = new Set();
      const players = normalizePlayers(snapshot.players);
      const recentDamage = Array.isArray(snapshot.recentDamage) ? snapshot.recentDamage : [];
      players.forEach((player) => {
        activeIds.add(player.id);
        this.renderPlayer(player, recentDamage.filter((event) => event.targetId === player.id));
      });

      this.markers.forEach((marker, playerId) => {
        if (!activeIds.has(playerId)) {
          marker.remove();
          this.markers.delete(playerId);
        }
      });
    }

    renderPlayer(player, recentDamage = []) {
      const radarPosition = worldToRadar(this.mapName, player.position);
      let marker = this.markers.get(player.id);

      if (!marker) {
        marker = this.createMarker(player);
        this.markers.set(player.id, marker);
        this.layer.appendChild(marker);
      }

      marker.className = `map-player side-${player.side.toLowerCase()}${player.alive ? '' : ' is-dead'}`;
      marker.dataset.playerId = player.id;
      marker.hidden = !radarPosition.visible;
      marker.style.left = `${clamp(radarPosition.x, 0, 1) * 100}%`;
      marker.style.top = `${clamp(radarPosition.y, 0, 1) * 100}%`;
      const dot = marker.querySelector('.map-player-dot');
      dot.querySelector('.map-player-number').textContent = player.number || '';
      dot.setAttribute('aria-pressed', String(marker.dataset.selected === 'true'));
      dot.setAttribute('aria-label', `${player.side}, ${player.nick}${player.weapon ? `, ${player.weapon}` : ''}${player.alive ? '' : ', выбыл'}`);
      marker.querySelector('.map-player-arrow').style.setProperty('--heading', `${player.heading}deg`);
      marker.querySelector('.map-player-side').textContent = player.side;
      marker.querySelector('.map-player-nick').textContent = player.nick;
      const health = marker.querySelector('.map-player-health');
      if (player.health === null) {
        health.hidden = true;
      } else {
        health.hidden = false;
        health.querySelector('b').textContent = `${Math.round(player.health)} HP`;
        health.querySelector('i').style.width = `${player.health}%`;
        health.dataset.level = player.health <= 30 ? 'low' : player.health <= 65 ? 'medium' : 'high';
        health.setAttribute('aria-label', `Здоровье: ${Math.round(player.health)} из 100`);
      }
      const damageLayer = marker.querySelector('.map-player-damage');
      const visibleDamage = new Set(recentDamage.map((event) => String(event.id)));
      damageLayer.querySelectorAll('.map-damage-number').forEach((popup) => {
        if (!visibleDamage.has(popup.dataset.damageId)) popup.remove();
      });
      recentDamage.forEach((event) => {
        const id = String(event.id);
        let popup = [...damageLayer.children].find((item) => item.dataset.damageId === id);
        if (!popup) {
          popup = document.createElement('span');
          popup.className = 'map-damage-number';
          popup.dataset.damageId = id;
          popup.setAttribute('aria-label', `Получено урона: ${event.damage}`);
          damageLayer.appendChild(popup);
        }
        popup.textContent = `−${event.damage}`;
      });

      const weaponImage = marker.querySelector('.map-player-weapon');
      weaponImage.hidden = !player.weaponUrl;
      weaponImage.src = player.weaponUrl || '';
      weaponImage.alt = player.weapon ? `Оружие: ${player.weapon}` : '';
    }

    createMarker(player) {
      const marker = document.createElement('div');
      marker.className = `map-player side-${player.side.toLowerCase()}`;
      marker.setAttribute('role', 'listitem');
      marker.innerHTML = `
        <img class="map-player-weapon" alt="">
        <span class="map-player-arrow" aria-hidden="true"></span>
        <button class="map-player-dot" type="button" aria-pressed="false"><span class="map-player-number"></span></button>
        <span class="map-player-health" hidden><b></b><i></i></span>
        <span class="map-player-damage" aria-live="polite"></span>
        <span class="map-player-label">
          <span class="map-player-side"></span>
          <b class="map-player-nick"></b>

        </span>`;
      return marker;
    }

    syncLayerBounds() {
      if (!this.radarImage.naturalWidth || !this.radarImage.naturalHeight) return;

      const rootRect = this.root.getBoundingClientRect();
      const imageRect = this.radarImage.getBoundingClientRect();
      const imageScale = Math.min(
        imageRect.width / this.radarImage.naturalWidth,
        imageRect.height / this.radarImage.naturalHeight
      );
      const width = this.radarImage.naturalWidth * imageScale;
      const height = this.radarImage.naturalHeight * imageScale;
      const left = imageRect.left - rootRect.left + (imageRect.width - width) / 2;
      const top = imageRect.top - rootRect.top + (imageRect.height - height) / 2;

      Object.assign(this.layer.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      });
    }

    clear() {
      this.markers.forEach((marker) => marker.remove());
      this.markers.clear();
    }

    selectPlayer(playerId) {
      this.markers.forEach((marker, id) => {
        marker.dataset.selected = String(id === playerId);
        marker.querySelector('.map-player-dot')?.setAttribute('aria-pressed', String(id === playerId));
      });
    }

    destroy() {
      this.disconnect();
      this.clear();
      this.radarImage.removeEventListener('load', this.boundSyncLayer);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      else window.removeEventListener('resize', this.boundSyncLayer);
    }
  }

  return {
    MinimapController,
    MockMinimapSource,
    normalizePlayers,
    radarToWorld,
    worldToRadar,
    interpolateRoute
  };
});
