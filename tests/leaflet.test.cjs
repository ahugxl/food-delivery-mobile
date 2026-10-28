const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { mapScene, parseMapEvent, scriptJson, mapUpdateScript, MAP_CHANNEL } = require('../src/features/location/leafletProtocol.ts');
const { leafletDocument, mapTilesConfig } = require('../src/features/location/leafletDocument.ts');
const scene = mapScene({ coordinate: { latitude: 10.8, longitude: 106.6 }, origin: { latitude: 10.7, longitude: 106.5 }, driver: { latitude: 10.75, longitude: 106.55 }, simulation: true });
const message = (type, coordinate, token = 'session') => JSON.stringify({ channel: MAP_CHANNEL, token, type, coordinate });
test('map bridge rejects stale sessions, foreign messages, malformed JSON and disabled selections', () => {
  assert.equal(parseMapEvent(message('ready', null, 'stale'), 'session', true), null);
  assert.equal(parseMapEvent({ channel: 'foreign', token: 'session', type: 'ready' }, 'session', true), null);
  assert.equal(parseMapEvent('{', 'session', true), null);
  assert.equal(parseMapEvent('x'.repeat(2049), 'session', true), null);
  assert.equal(parseMapEvent(message('select', { latitude: 10, longitude: 100 }), 'session', false), null);
  assert.equal(parseMapEvent(message('eval', 'alert(1)'), 'session', true), null);
});
test('map bridge accepts zero coordinates and rejects nonnumeric or out-of-range locations', () => {
  assert.deepEqual(parseMapEvent(message('select', { latitude: 0, longitude: 0 }), 'session', true), { type: 'select', coordinate: { latitude: 0, longitude: 0 } });
  for (const coordinate of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: '10', longitude: 100 }, null]) {
    assert.equal(parseMapEvent(message('select', coordinate), 'session', true), null);
  }
  assert.deepEqual(parseMapEvent(message('tiles-ready'), 'session', false), { type: 'tiles-ready' });
});
test('map scene copies only coordinates and flags, never addresses, auth data or callbacks', () => {
  const coordinate = { latitude: 10, longitude: 100, address: 'Private address' };
  const state = mapScene({ coordinate, onSelect() {}, driver: { latitude: NaN, longitude: 1 }, secret: 'token' });
  assert.deepEqual(state, { coordinate: { latitude: 10, longitude: 100 }, origin: null, driver: null, selectable: true, simulation: false });
  coordinate.latitude = 20;
  assert.equal(state.coordinate.latitude, 10);
  assert.throws(() => mapScene({ coordinate: { latitude: Infinity, longitude: 1 } }), /Tọa độ/);
});
test('inline document safely embeds token values and bundles Leaflet without external scripts', () => {
  const hostileToken = '</script><script>alert(1)</script>\u2028';
  const html = leafletDocument(scene, hostileToken);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 2);
  for (const source of scripts) assert.doesNotThrow(() => new vm.Script(source));
  assert.equal(html.includes('<script src='), false);
  assert.equal(html.includes(hostileToken), false);
  assert.equal(JSON.parse(scriptJson(hostileToken)), hostileToken);
  assert.doesNotThrow(() => new vm.Script(mapUpdateScript(scene, hostileToken)));
  assert.match(html, /https:\/\/www.openstreetmap.org\/copyright/);
});
test('tile configuration accepts HTTPS providers and rejects insecure or incomplete templates', () => {
  const old = process.env.EXPO_PUBLIC_MAP_TILE_URL;
  try {
    process.env.EXPO_PUBLIC_MAP_TILE_URL = 'https://tiles.example.test/{z}/{x}/{y}.png';
    assert.equal(mapTilesConfig().origin, 'https://tiles.example.test');
    for (const url of ['http://example.test/{z}/{x}/{y}', 'javascript:alert(1)', 'https://user:secret@example.test/{z}/{x}/{y}', 'https://example.test/static.png']) {
      process.env.EXPO_PUBLIC_MAP_TILE_URL = url;
      assert.equal(mapTilesConfig().origin, 'https://tile.openstreetmap.de');
      assert.equal(mapTilesConfig().credit, 'OSM Deutschland');
    }
  } finally { if (old === undefined) delete process.env.EXPO_PUBLIC_MAP_TILE_URL; else process.env.EXPO_PUBLIC_MAP_TILE_URL = old; }
});
