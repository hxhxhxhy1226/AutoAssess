// Execute the real desktop bridge with mock Chrome storage and HTTP responses.
// These checks do not launch a browser, create a native window, or prove capture exclusion.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesktopBridge } = require('../desktop-bridge.js');

const TOKEN = 'LocalPairToken_0123456789abcdefghij';
const PORT = 54321;
const PAIR_CODE = `${PORT}.${TOKEN}`;
const CAPTURE = { requested: true, verified: true, error: '' };
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const snapshot = { status: '等待性格题目', running: false, paused: false, count: 2,
  countdown: '—', question: '本地样例', questionType: '量表', answer: '', explanation: '',
  basis: '离线', mode: 'manual', dwellSec: 5, canApply: false };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function actionOf(message) { return message.type === 'desktop-command' ? message.action : message.type === 'stop-run' ? 'stop' : null; }

function harness(options = {}) {
  const data = options.data || {}, calls = [], sends = [], writes = [], order = [];
  const clock = { value: 1_800_000_000_000 };
  let exchangeNumber = 0;
  const state = { commands: [], networkFailure: false, protocol: 1, exchangeGate: null, actionFailure: null, capture: clone(CAPTURE),settingsCapability:true,settings:{mode:'manual',dwellSec:5} };
  const storage = {
    async get(keys) {
      if (typeof keys === 'string') return clone({ [keys]: data[keys] });
      if (Array.isArray(keys)) return clone(Object.fromEntries(keys.map(key => [key, data[key]])));
      if (keys && typeof keys === 'object') return clone({ ...keys, ...data });
      return clone(data);
    },
    async set(values) { const value = clone(values); writes.push(value); order.push({ kind: 'write', value }); Object.assign(data, value); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; order.push({ kind: 'remove', keys: clone(keys) }); },
  };
  const deps = {
    storage, now: () => clock.value, newClientId: () => 'desktop-test-client',getSettings:async()=>clone(state.settings),
    getURL: file => 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/' + file,
    async getTab(id) { return { id, url: options.tabUrl || 'https://fixture.invalid/personality', title: '本地性格练习' }; },
    async openPanel(tabId, reveal) { order.push({ kind: 'openPanel', tabId, reveal }); return { opened: true }; },
    async writePanel(tabId, value) { order.push({ kind: 'writePanel', tabId, value: clone(value) }); return value; },
    async sendTab(tabId, message) {
      const record = { tabId, message: clone(message) };
      sends.push(record); order.push({ kind: 'send', ...record, stored: clone(data) });
      if (state.actionFailure && actionOf(message) === state.actionFailure) throw Error('fixture action failed');
      return { ok: true, hidden: true, snapshot: clone(snapshot) };
    },
    async fetch(url, init = {}) {
      const parsed = new URL(url);
      const body = init.body ? JSON.parse(init.body) : null;
      const record = { url: String(url), path: parsed.pathname, init, body };
      calls.push(record); order.push({ kind: 'fetch', path: parsed.pathname, body: clone(body) });
      if (state.networkFailure) throw Error('fixture connection refused');
      let value;
      if (parsed.pathname === '/connect') value = { ok: true, protocol: state.protocol, capture: state.capture,capabilities:{settings:state.settingsCapability} };
      else if (parsed.pathname === '/health') value = { ok: true, protocol: state.protocol, app: 'assessment-desktop', capture: state.capture, connected: true,capabilities:{settings:state.settingsCapability} };
      else if (parsed.pathname === '/disconnect') value = { ok: true };
      else if (parsed.pathname === '/exchange') {
        exchangeNumber++;
        if (state.exchangeGate) await state.exchangeGate.promise;
        value = { ok: true, capture: state.capture, commands: clone(state.commands) };
      } else throw Error('Unexpected bridge path: ' + parsed.pathname);
      return { ok: true, status: 200, async json() { return clone(value); }, async text() { return JSON.stringify(value); } };
    },
  };
  const make = () => createDesktopBridge(deps);
  return { bridge: make(), make, deps, data, calls, sends, writes, order, state, clock,
    command(id, action, payload) { return { id, action, ...(payload ? { payload } : {}), expiresAt: clock.value + 15_000 }; },
    get exchangeNumber() { return exchangeNumber; },
    dispatched(action) { return sends.filter(item => actionOf(item.message) === action); },
  };
}

test('pairing rejects arbitrary hosts, malformed tokens and invalid ports before a request', async () => {
  for (const code of ['http://evil.invalid/pair', `0.${TOKEN}`, `65536.${TOKEN}`, `-1.${TOKEN}`,
    `54321.${TOKEN}/path`, '54321.short', `54321.${TOKEN}\nINJECT`, `127.0.0.1:${PORT}.${TOKEN}`]) {
    const h = harness();
    await assert.rejects(h.bridge.connect(code, 7));
    assert.equal(h.calls.length, 0, code);
    assert.equal(h.sends.length, 0, code);
  }
});

test('connect uses authenticated loopback requests, hides the page panel and does not expose the token', async () => {
  const h = harness();
  const result = await h.bridge.connect(PAIR_CODE, 7);
  assert.equal(result.connected, true);
  assert.equal(result.tabId, 7);
  assert.equal(h.dispatched('attach').length, 1);
  assert.ok(h.order.some(item => item.kind === 'openPanel' && item.tabId === 7 && item.reveal === false));
  const status = await h.bridge.status();
  assert.equal(status.connected, true);
  assert.equal(status.capture.verified, true);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(JSON.stringify(status).includes(TOKEN), false);
  for (const call of h.calls) {
    assert.equal(new URL(call.url).origin, `http://127.0.0.1:${PORT}`);
    assert.equal(new Headers(call.init.headers).get('Authorization'), 'Bearer ' + TOKEN);
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.credentials, 'omit');
    assert.ok(call.init.signal instanceof AbortSignal);
    assert.equal(call.url.includes(TOKEN), false);
  }
});

test('protected target pages cannot be paired for desktop control', async () => {
  for (const tabUrl of ['chrome://settings/', 'edge://extensions/', 'file:///C:/private.html', 'about:blank']) {
    const h = harness({ tabUrl });
    await assert.rejects(h.bridge.connect(PAIR_CODE, 7));
    assert.equal(h.calls.length, 0, tabUrl);
    assert.equal(h.dispatched('attach').length, 0, tabUrl);
  }
});

test('older desktop without configuration capability is released before attaching',async()=>{
  const h=harness();h.state.settingsCapability=false;
  await assert.rejects(h.bridge.connect(PAIR_CODE,7),/0.5.1|桌面/);
  assert.equal(h.dispatched('attach').length,0);assert.ok(h.calls.some(call=>call.path==='/disconnect'));
});

test('complete configuration is sent on connect and echoed only when saved settings change',async()=>{
  const h=harness();h.state.settings={mode:'auto',dwellSec:8,autoNext:false,personalityPreset:'custom',personalityTraits:{E:5},personalityAnswers:'题干 => 答案',apiKey:'must-not-copy'};
  await h.bridge.connect(PAIR_CODE,7);
  const first=h.calls.find(call=>call.path==='/connect').body.settings;
  assert.equal(first.autoNext,false);assert.equal(first.personalityTraits.E,5);assert.equal('apiKey' in first,false);
  await h.bridge.pulse(7,snapshot);assert.equal('settings' in h.calls.at(-1).body,false);
  h.state.settings.personalityStrategy='strict';h.state.settings.selectors={question:'.question'};
  await h.bridge.pulse(7,snapshot);assert.equal(h.calls.at(-1).body.settings.personalityStrategy,'strict');assert.equal(h.calls.at(-1).body.settings.selectors.question,'.question');
  await h.bridge.pulse(7,snapshot);assert.equal('settings' in h.calls.at(-1).body,false);
});

test('concurrent connect requests cannot both pass while the first tab lookup is pending', async () => {
  const h = harness(), gate = deferred(), originalGetTab = h.deps.getTab;
  h.deps.getTab = async id => { await gate.promise; return originalGetTab(id); };
  const first = h.bridge.connect(PAIR_CODE, 7);
  const second = h.bridge.connect(PAIR_CODE, 8);
  const outcomes = Promise.allSettled([first, second]);
  await tick(); gate.resolve();
  const result = await outcomes;
  assert.equal(result[0].status, 'fulfilled');
  assert.equal(result[1].status, 'rejected');
  assert.equal(h.calls.filter(call => call.path === '/connect').length, 1);
  assert.equal((await h.bridge.status()).tabId, 7);
});

test('an incompatible native protocol cannot attach the page panel', async () => {
  const h = harness(); h.state.protocol = 99;
  await assert.rejects(h.bridge.connect(PAIR_CODE, 7));
  assert.equal(h.dispatched('attach').length, 0);
  assert.equal((await h.bridge.status()).connected, false);
});

test('capture negotiation releases an unprotected requested binding but permits explicitly unprotected mode', async () => {
  const protectedMode = harness();
  protectedMode.state.capture = { requested: true, verified: false, error: 'fixture native protection unavailable' };
  await assert.rejects(protectedMode.bridge.connect(PAIR_CODE, 7), /采集排除|未生效|protection/);
  const connect = protectedMode.calls.find(call => call.path === '/connect');
  const released = protectedMode.calls.find(call => call.path === '/disconnect');
  assert.ok(connect && released, 'release the native binding that accepted the failed protected connection');
  assert.equal(released.body.clientId, connect.body.clientId);
  assert.equal(protectedMode.dispatched('attach').length, 0);
  assert.equal(protectedMode.order.some(item => item.kind === 'openPanel'), false);
  assert.equal((await protectedMode.bridge.status()).connected, false);
  assert.equal(JSON.stringify(protectedMode.data).includes(TOKEN), false);

  const ordinaryMode = harness();
  ordinaryMode.state.capture = { requested: false, verified: false, error: '' };
  const result = await ordinaryMode.bridge.connect(PAIR_CODE, 7);
  assert.equal(result.connected, true);
  assert.equal(result.capture.requested, false);
  assert.equal(result.capture.verified, false);
  assert.equal(ordinaryMode.dispatched('attach').length, 1);
  assert.equal(ordinaryMode.calls.some(call => call.path === '/disconnect'), false);
});

test('a different tab cannot publish a snapshot or execute commands for the paired tab', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.commands = [h.command('wrong-tab-command', 'start')];
  const previousRequests = h.calls.length;
  const result = await h.bridge.pulse(8, snapshot);
  assert.equal(result.connected, false);
  assert.equal(h.calls.length, previousRequests);
  assert.equal(h.dispatched('start').length, 0);
  assert.equal((await h.bridge.status()).connected, true);
});

test('allowed commands run once and their acknowledgement is returned on the next exchange', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.commands = [h.command('pause-1', 'pause'), h.command('configure-1', 'configure', { mode: 'manual', dwellSec: 8 })];
  await h.bridge.pulse(7, snapshot);
  await h.bridge.pulse(7, snapshot);
  assert.equal(h.dispatched('pause').length, 1);
  assert.equal(h.dispatched('configure').length, 1);
  const exchanges = h.calls.filter(call => call.path === '/exchange');
  const acks = exchanges[1].body.acknowledgements;
  assert.ok(acks.some(ack => ack.id === 'pause-1' && ack.ok === true));
  assert.ok(acks.some(ack => ack.id === 'configure-1' && ack.ok === true));
  const sent = h.dispatched('configure')[0].message;
  assert.deepEqual(sent.payload, { mode: 'manual', dwellSec: 8 });
});

test('expired, unsupported and malformed commands are not sent to the page', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.commands = [
    { ...h.command('expired', 'start'), expiresAt: h.clock.value - 1 },
    h.command('unsupported', 'eval', { code: 'unexpected()' }),
    h.command('bad-mode', 'configure', { mode: 'unrecognized', dwellSec: 5 }),
    h.command('bad-dwell', 'configure', { mode: 'auto', dwellSec: 0 }),
    h.command('too-long-dwell', 'configure', { mode: 'auto', dwellSec: 121 }),
  ];
  await h.bridge.pulse(7, snapshot);
  h.state.commands = [];
  await h.bridge.pulse(7, snapshot);
  assert.equal(h.dispatched('start').length, 0);
  assert.equal(h.dispatched('eval').length, 0);
  assert.equal(h.dispatched('configure').length, 0);
  const acks = h.calls.filter(call => call.path === '/exchange').at(-1).body.acknowledgements;
  for (const id of ['expired', 'unsupported', 'bad-mode', 'bad-dwell', 'too-long-dwell']) {
    assert.ok(acks.some(ack => ack.id === id && ack.ok === false), id);
  }
});

test('command identity is persisted before dispatch and survives a worker recreation', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.commands = [h.command('persisted-start', 'start')];
  await h.bridge.pulse(7, snapshot);
  const execution = h.order.find(item => item.kind === 'send' && actionOf(item.message) === 'start');
  assert.ok(execution);
  assert.ok(JSON.stringify(execution.stored).includes('persisted-start'), 'persist before dispatch, not only after the page replies');
  const recreated = h.make();
  await recreated.pulse(7, snapshot);
  assert.equal(h.dispatched('start').length, 1);
});

test('a failed page action is acknowledged as failed and is not re-executed', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.actionFailure = 'apply';
  h.state.commands = [h.command('apply-fails', 'apply')];
  await h.bridge.pulse(7, snapshot);
  await h.bridge.pulse(7, snapshot);
  assert.equal(h.dispatched('apply').length, 1);
  const acks = h.calls.filter(call => call.path === '/exchange').at(-1).body.acknowledgements;
  assert.ok(acks.some(ack => ack.id === 'apply-fails' && ack.ok === false));
});

test('overlapping pulses share one exchange instead of issuing duplicate page commands', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.commands = [h.command('single-exchange', 'pause')];
  const gate = deferred(); h.state.exchangeGate = gate;
  const one = h.bridge.pulse(7, snapshot), two = h.bridge.pulse(7, snapshot);
  await tick();
  assert.equal(h.exchangeNumber, 1);
  gate.resolve();
  await Promise.all([one, two]);
  assert.equal(h.dispatched('pause').length, 1);
});

test('native connection failure stops and detaches the target, then removes the pairing secret', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  h.state.networkFailure = true;
  const result = await h.bridge.pulse(7, snapshot);
  assert.equal(result.connected, false);
  assert.ok(h.dispatched('stop').some(item => item.tabId === 7));
  assert.ok(h.dispatched('detach').some(item => item.tabId === 7));
  assert.equal(JSON.stringify(h.data).includes(TOKEN), false);
  const status = await h.bridge.status();
  assert.equal(status.connected, false);
  assert.equal(JSON.stringify(status).includes(TOKEN), false);
});

test('initialization health failure clears the session without calling back into an unready page', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  const priorSends = h.sends.length;
  h.state.networkFailure = true;
  const result = await h.bridge.ping(7);
  assert.equal(result.connected, false);
  assert.equal(h.sends.length, priorSends, 'ping failure must not await content that is itself awaiting initialization');
  assert.equal(JSON.stringify(h.data).includes(TOKEN), false);
  assert.ok(h.order.some(item => item.kind === 'writePanel' && item.value.desktop === false && item.value.armed === false));
});

test('explicit disconnect ends the native binding and stops the paired page', async () => {
  const h = harness(); await h.bridge.connect(PAIR_CODE, 7);
  const result = await h.bridge.disconnect();
  assert.equal(result.connected, false);
  assert.ok(h.calls.some(call => call.path === '/disconnect'));
  assert.ok(h.dispatched('stop').some(item => item.tabId === 7));
  assert.ok(h.dispatched('detach').some(item => item.tabId === 7));
  assert.equal(JSON.stringify(h.data).includes(TOKEN), false);
});
