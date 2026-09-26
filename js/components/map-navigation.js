(function initMapNavigation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CSMapNavigation = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMapNavigation() {
  'use strict';

  function walkableGrid(image, size = 128) {
    if (!image?.naturalWidth || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently:true });
    if (!context) return null;
    try { context.drawImage(image, 0, 0, size, size); } catch { return null; }
    const pixels = context.getImageData(0, 0, size, size).data;
    const cells = new Uint8Array(size * size);
    for (let index = 0; index < cells.length; index += 1) {
      const offset = index * 4;
      const brightness = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      // Пустая область радара почти чёрная; цвета пола и площадок остаются проходимыми.
      cells[index] = pixels[offset + 3] > 32 && brightness > 24 ? 1 : 0;
    }
    return { size, cells };
  }

  function cellWalkable(grid, x, y) {
    const ix = Math.round(x * (grid.size - 1)); const iy = Math.round(y * (grid.size - 1));
    return ix >= 0 && iy >= 0 && ix < grid.size && iy < grid.size && grid.cells[iy * grid.size + ix] === 1;
  }

  function nearestWalkable(grid, point) {
    if (cellWalkable(grid, point[0], point[1])) return point;
    const size = grid.size; const px = point[0] * (size - 1); const py = point[1] * (size - 1);
    for (let radius = 1; radius < size; radius += 1) {
      let best = null; let bestDistance = Infinity;
      for (let y = Math.max(0, Math.floor(py - radius)); y <= Math.min(size - 1, Math.ceil(py + radius)); y += 1) {
        for (let x = Math.max(0, Math.floor(px - radius)); x <= Math.min(size - 1, Math.ceil(px + radius)); x += 1) {
          if (Math.max(Math.abs(x - px), Math.abs(y - py)) > radius || grid.cells[y * size + x] !== 1) continue;
          const distance = (x - px) ** 2 + (y - py) ** 2;
          if (distance < bestDistance) { best = [x / (size - 1), y / (size - 1)]; bestDistance = distance; }
        }
      }
      if (best) return best;
    }
    return point;
  }

  function findPath(grid, start, end) {
    const from = nearestWalkable(grid, start); const to = nearestWalkable(grid, end); const n = grid.size;
    const key = (x, y) => y * n + x;
    const sx = Math.round(from[0] * (n - 1)); const sy = Math.round(from[1] * (n - 1));
    const ex = Math.round(to[0] * (n - 1)); const ey = Math.round(to[1] * (n - 1));
    const startKey = key(sx, sy); const endKey = key(ex, ey);
    const heap = [];
    const push = (entry) => {
      heap.push(entry); let index = heap.length - 1;
      while (index > 0) { const parent = (index - 1) >> 1; if (heap[parent].score <= entry.score) break; heap[index] = heap[parent]; index = parent; }
      heap[index] = entry;
    };
    const pop = () => {
      const first = heap[0]; const last = heap.pop();
      if (heap.length && last) {
        let index = 0;
        while (true) { let child = index * 2 + 1; if (child >= heap.length) break; if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child += 1; if (heap[child].score >= last.score) break; heap[index] = heap[child]; index = child; }
        heap[index] = last;
      }
      return first;
    };
    const previous = new Int32Array(n * n); previous.fill(-1);
    const distance = new Float32Array(n * n); distance.fill(Infinity); distance[startKey] = 0;
    const estimate = (x, y) => Math.hypot(ex - x, ey - y);
    const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    push({ node:startKey, score:estimate(sx, sy), cost:0 });
    while (heap.length) {
      const entry = pop(); const current = entry.node;
      if (entry.cost !== distance[current]) continue;
      if (current === endKey) break;
      const x = current % n; const y = Math.floor(current / n);
      for (const [dx, dy] of offsets) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || grid.cells[key(nx, ny)] !== 1) continue;
        if (dx && dy && (grid.cells[key(x + dx, y)] !== 1 || grid.cells[key(x, y + dy)] !== 1)) continue;
        const next = key(nx, ny); const candidate = distance[current] + (dx && dy ? 1.4142 : 1);
        if (candidate >= distance[next]) continue;
        distance[next] = candidate; previous[next] = current; push({ node:next, cost:candidate, score:candidate + estimate(nx, ny) });
      }
    }
    if (startKey !== endKey && previous[endKey] === -1) return [from, from];
    const path = []; let current = endKey;
    while (current !== -1) { path.push([(current % n) / (n - 1), Math.floor(current / n) / (n - 1)]); if (current === startKey) break; current = previous[current]; }
    path.reverse();
    // Сохраняем точки поворота, чтобы прямые сегменты не срезали углы стен.
    return path.filter((point, index) => index === 0 || index === path.length - 1 || Math.abs((point[0] - path[index - 1][0]) * (path[index + 1][1] - point[1]) - (point[1] - path[index - 1][1]) * (path[index + 1][0] - point[0])) > .00001);
  }

  function constrainRoutes(image, routes) {
    const grid = walkableGrid(image);
    if (!grid) return routes;
    return routes.map((route) => {
      const result = [];
      for (let index = 0; index < route.length - 1; index += 1) {
        const path = findPath(grid, route[index], route[index + 1]);
        result.push(...(index ? path.slice(1) : path));
      }
      return result.length > 1 ? result : route.map((point) => nearestWalkable(grid, point));
    });
  }

  return { walkableGrid, nearestWalkable, findPath, constrainRoutes };
});
