(function initDdsRadar(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CSDdsRadar = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDdsRadar() {
  'use strict';

  function decodeDxt1(buffer) {
    if (ArrayBuffer.isView(buffer)) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (bytes.length < 128 || String.fromCharCode(...bytes.slice(0, 4)) !== 'DDS ' || String.fromCharCode(...bytes.slice(84, 88)) !== 'DXT1') {
      throw new Error('Ожидался DDS радар в формате DXT1');
    }
    const height = view.getUint32(12, true);
    const width = view.getUint32(16, true);
    const pixels = new Uint8ClampedArray(width * height * 4);
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    const rgb565 = (value) => [((value >> 11) & 31) * 255 / 31, ((value >> 5) & 63) * 255 / 63, (value & 31) * 255 / 31];
    for (let by = 0; by < blocksHigh; by += 1) for (let bx = 0; bx < blocksWide; bx += 1) {
      const offset = 128 + (by * blocksWide + bx) * 8;
      const first = view.getUint16(offset, true); const second = view.getUint16(offset + 2, true);
      const a = rgb565(first); const b = rgb565(second);
      const palette = [a, b];
      if (first > second) {
        palette.push(a.map((channel, index) => (2 * channel + b[index]) / 3));
        palette.push(a.map((channel, index) => (channel + 2 * b[index]) / 3));
      } else {
        palette.push(a.map((channel, index) => (channel + b[index]) / 2));
        palette.push([0,0,0]);
      }
      const indices = view.getUint32(offset + 4, true);
      for (let pixel = 0; pixel < 16; pixel += 1) {
        const x = bx * 4 + pixel % 4; const y = by * 4 + Math.floor(pixel / 4);
        if (x >= width || y >= height) continue;
        const colorIndex = (indices >> (pixel * 2)) & 3;
        const color = palette[colorIndex]; const target = (y * width + x) * 4;
        pixels[target] = Math.round(color[0]); pixels[target + 1] = Math.round(color[1]); pixels[target + 2] = Math.round(color[2]);
        pixels[target + 3] = first <= second && colorIndex === 3 ? 0 : 255;
      }
    }
    return { width, height, data:pixels };
  }

  async function loadIntoImage(image, url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить радар: ${url}`);
    const decoded = decodeDxt1(await response.arrayBuffer());
    const canvas = document.createElement('canvas'); canvas.width = decoded.width; canvas.height = decoded.height;
    canvas.getContext('2d').putImageData(new ImageData(decoded.data, decoded.width, decoded.height), 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Не удалось подготовить радар')), 'image/png'));
    if (image.dataset.ddsObjectUrl) URL.revokeObjectURL(image.dataset.ddsObjectUrl);
    const objectUrl = URL.createObjectURL(blob); image.dataset.ddsObjectUrl = objectUrl; image.src = objectUrl;
  }

  return { decodeDxt1, loadIntoImage };
});
