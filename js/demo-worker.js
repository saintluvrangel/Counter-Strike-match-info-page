'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { parseDemoFile } = require('./demo-parser.js');

try {
  parentPort.postMessage({ parsed:parseDemoFile(workerData.filePath) });
} catch (error) {
  parentPort.postMessage({ error:error.message || 'Ошибка парсинга демо' });
}
