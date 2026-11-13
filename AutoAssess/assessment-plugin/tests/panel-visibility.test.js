// State and message integration tests. This does not emulate browser rendering,
// screenshot capture, extension shortcut delivery, or a real BFCache navigation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const DEFAULT_PLUGIN = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
async function flush() { for (let i = 0; i < 8; i++) await tick(); }

function eventSource() {
  const listeners = [];
  return { listeners, addListener(fn) { listeners.push(fn); } };
}
async function dispatch(source, message, sender = {}) {
  return new Promise((resolve, reject) => {
    let pending = false, replied = false;
    for (const listener of source.listeners) {
      const result = listener(message, sender, answer => { replied = true; resolve(answer); });
      pending ||= result === true;
    }
    if (!pending && !replied) reject(Error('No message receiver'));
  });
}
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.dataset = {}; this.hidden = false;
    this.disabled = false; this.textContent = ''; this.value = ''; this.isConnected = false;
    this.events = new Map(); this.options = []; this.displayHistory = [];
    let display = '';
    this.style = {};
    Object.defineProperty(this.style, 'display', {
      get: () => display,
      set: value => { display = value; this.displayHistory.push(value); }, enumerable: true,
    });
    Object.defineProperty(this.style, 'cssText', { set: value => {
      for (const entry of value.split(';')) {
        const colon = entry.indexOf(':'); if (colon < 0) continue;
        const name = entry.slice(0, colon).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.style[name] = entry.slice(colon + 1).trim();
      }
    } });
    const classes = new Set();
    this.classList = { add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c), toggle(c, flag) {
        const add = flag === undefined ? !classes.has(c) : flag;
        if (add) classes.add(c); else classes.delete(c); return add;
      } };
  }
  add(option) { this.options.push(option); }
  addEventListener(type, listener) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push(listener);
  }
  emit(type, value = {}) { return (this.events.get(type) || []).map(fn => fn(value)); }
  click() { if (!this.disabled) this.emit('click', { target: this }); }
  appendChild(child) { child.isConnected = true; return child; }
  hasAttribute() { return false; }
  getBoundingClientRect() { return { x: 24, y: 80 }; }
  setPointerCapture() {}
  scrollIntoView() {}
  attachShadow() { this.shadowRoot = new Shadow(); return this.shadowRoot; }
}
class Shadow {
  constructor() { this.ids = new Map(); this.special = new Map(); this.modes = []; }
  set innerHTML(html) {
    this.html = html;
    for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
      const node = new Element(match[1]); node.id = match[3];
      node.hidden = /(?:^|\s)hidden(?:\s|$|=)/.test(match[2]);
      node.disabled = /(?:^|\s)disabled(?:\s|$|=)/.test(match[2]);
      this.ids.set(node.id, node);
    }
    for (const mode of ['auto', 'manual']) { const node = new Element('button'); node.dataset.mode = mode; this.modes.push(node); }
    for (const selector of ['.panel', '.top', '.top small']) this.special.set(selector, new Element());
  }
  getElementById(id) { return this.ids.get(id) || null; }
  querySelector(selector) { return this.special.get(selector) || null; }
  querySelectorAll(selector) {
    if (selector === '[data-mode]') return this.modes;
    if (selector === '#setup input,#setup select,[data-mode]') return [...this.modes, ...['personalityPreset', 'personalityStrategy', 'dwell'].map(id => this.ids.get(id))];
    return [];
  }
}

async function makeHarness({ plugin = DEFAULT_PLUGIN, saved = {}, holdSession = false, tabUrl = 'https://local-fixture.invalid/', staleDOM = null } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'manifest.json'), 'utf8'));
  const sessions = { 'assessmentPanel:7': clone(saved) }, settings = { mode: 'manual', showLauncher: true };
  const calls = [], contentOverrides = {}, backgroundMessages = eventSource(), contentMessages = eventSource(), commands = eventSource();
  let releaseSession;
  let sessionGate = holdSession ? new Promise(resolve => { releaseSession = resolve; }) : Promise.resolve();
  const storage = record => ({
    async get(keys) { return clone(typeof keys === 'string' ? { [keys]: record[keys] } : record); },
    async set(values) { Object.assign(record, clone(values)); },
    async remove(key) { delete record[key]; },
  });
  const sessionStorage = storage(sessions), originalGet = sessionStorage.get;
  sessionStorage.get = async keys => { await sessionGate; return originalGet(keys); };
  const bgChrome = {
    storage: { session: sessionStorage, local: storage(settings) },
    runtime: { onMessage: backgroundMessages, onInstalled: eventSource(),getManifest:()=>manifest,
      getURL: file => 'chrome-extension://state-test/' + file },
    tabs: { onRemoved: eventSource(), async query() { return [{ id: 7 }]; },
      async get(id) { return { id, url: tabUrl }; },
      async sendMessage(id, message) {
        calls.push({ destination: 'content', id, ...clone(message) });
        if (Object.hasOwn(contentOverrides, message.type)) return clone(contentOverrides[message.type]);
        return dispatch(contentMessages, message);
      },
      async create() { throw Error('Unexpected external tab creation'); } },
    commands: { onCommand: commands },
    scripting: { async executeScript(request) {
      if(request.func&&!request.files){calls.push({destination:'dom-visibility-read'});return [{result:staleDOM||{exists:false,visible:false}}];}
      throw Error('Unexpected panel injection in state harness');
    } },
  };
  const bgContext = vm.createContext({ chrome: bgChrome, URL, setTimeout, clearTimeout,
    fetch: async () => { throw Error('Unexpected network request'); } });
  bgContext.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(plugin, file), 'utf8'), bgContext, { filename: file }));
  vm.runInContext(fs.readFileSync(path.join(plugin, 'background.js'), 'utf8'), bgContext, { filename: 'background.js' });
  const documentEvents = new Element(), windowEvents = new Element(), body = new Element('body'), root = new Element('html');
  let host;
  const document = {
    body, documentElement: root, fullscreenElement: null,
    createElement(tag) { host = new Element(tag); return host; },
    getElementById(id) { return host?.isConnected && host.id === id ? host : null; },
    querySelector() { return null; }, addEventListener: documentEvents.addEventListener.bind(documentEvents),
  };
  const contentChrome = { runtime: { id: 'state-test', getManifest: () => manifest, onMessage: contentMessages,
    async sendMessage(message) { calls.push({ destination: 'background', ...clone(message) }); return dispatch(backgroundMessages, message, { tab: { id: 7 } }); } } };
  const contentContext = vm.createContext({ chrome: contentChrome, document,
    window: { addEventListener: windowEvents.addEventListener.bind(windowEvents) },
    location: { protocol: 'https:', assign() { throw Error('Unexpected navigation'); } },
    Option: function(text, value) { this.text = text; this.value = value; },
    MutationObserver: class { observe() {} disconnect() {} },
    Assessment: bgContext.Assessment, AssessmentPersonality: bgContext.AssessmentPersonality,AssessmentDesktopSettings:bgContext.AssessmentDesktopSettings,
    AssessmentAdapter: { read() { const error = Error('No fixture question'); error.code = 'QUESTION_NOT_READY'; throw error; } },
    setTimeout, clearTimeout, performance, innerWidth: 1440, innerHeight: 1040,
  });
  vm.runInContext(fs.readFileSync(path.join(plugin, 'content.js'), 'utf8'), contentContext, { filename: 'content.js' });
  const result = {
    host, session: sessions['assessmentPanel:7'], sessions, calls, manifest, contentOverrides,
    el: id => host.shadowRoot.getElementById(id), panel: host.shadowRoot.querySelector('.panel'),
    releaseSession: () => releaseSession?.(),
    holdSessionReads() { sessionGate = new Promise(resolve => { releaseSession = resolve; }); },
    message: type => dispatch(contentMessages, typeof type === 'string' ? { type } : type),
    background: message => dispatch(backgroundMessages, { tabId: 7, ...message }, {}),
    setBadSelector(value){document.querySelector=selector=>{if(selector===value)throw Error('Invalid selector');return null;};},
    reinject(){vm.runInContext(fs.readFileSync(path.join(plugin,'content.js'),'utf8'),contentContext);},
    receiverCount:()=>contentMessages.listeners.length,
    async command(name) { for (const listener of commands.listeners) await listener(name); await flush(); },
    async pageshow() { await Promise.all(windowEvents.emit('pageshow', { persisted: true })); await flush(); },
    async close() { releaseSession?.(); await flush(); await dispatch(contentMessages, { type: 'stop-run' }); await flush(); },
  };
  if (!holdSession) await flush();
  return result;
}


async function probe(plugin){
  const h=await makeHarness({plugin:path.resolve(plugin)});
  const before=h.host.isConnected;
  const reply=await h.message('show-panel');
  const result={input:'load controller -> request webpage panel',evidence:'Node VM state simulation; no browser rendering',web_panel_mounted:before,web_show_allowed:reply.ok===true,controller_hidden:h.host.style.display==='none'};
  await h.close();return result;
}
if(process.argv[2]==='--desktop-only-probe'){
  probe(process.argv[3]||DEFAULT_PLUGIN).then(value=>console.log(JSON.stringify(value)),error=>{console.error(error);process.exitCode=1;});
}else{
  test('controller stays detached and cannot expose a webpage panel',async t=>{
    const h=await makeHarness();t.after(()=>h.close());
    assert.equal(h.host.isConnected,false);assert.equal(h.host.style.display,'none');
    for(const type of ['show-panel','toggle-panel','toggle-visibility'])assert.equal((await h.message(type)).ok,false);
    assert.equal((await h.background({type:'openPanel'})).ok,false);
    assert.equal(h.host.isConnected,false);assert.equal(h.host.style.display,'none');
  });
  test('desktop attach and detach keep the controller invisible and preserve count until start',async t=>{
    const h=await makeHarness({saved:{enabled:true,count:4}});t.after(()=>h.close());
    assert.equal((await h.message({type:'desktop-command',action:'attach'})).ok,true);
    assert.equal(h.sessions['assessmentPanel:7'].desktop,true);assert.equal(h.el('count').textContent,4);
    await h.message({type:'desktop-command',action:'detach'});
    assert.equal(h.sessions['assessmentPanel:7'].desktop,false);assert.equal(h.sessions['assessmentPanel:7'].armed,false);
    assert.equal(h.host.isConnected,false);assert.equal(h.host.style.display,'none');
  });
  test('desktop settings are validated, saved completely, and nested partial updates preserve other fields',async t=>{
    const h=await makeHarness();t.after(()=>h.close());await h.message({type:'desktop-command',action:'attach'});
    const value={mode:'auto',dwellSec:7,autoNext:false,personalityPreset:'custom',personalityStrategy:'strict',personalityTraits:{E:1,A:2,C:3,S:4,O:5},personalityRanking:'善于沟通的\n有计划性的',personalityAnswers:'我喜欢计划。 => 符合',selectors:{question:'.question',next:'.next'}};
    const saved=await h.message({type:'desktop-command',action:'configure',payload:value});assert.equal(saved.ok,true,saved.error);
    let settings=(await h.background({type:'settings'})).settings;
    assert.equal(settings.personalityTraits.E,1);assert.equal(settings.autoNext,false);assert.equal(settings.personalityRanking,value.personalityRanking);assert.equal(h.el('apply').disabled,true);
    await h.message({type:'desktop-command',action:'configure',payload:{selectors:{next:'.continue'},personalityTraits:{E:5}}});
    settings=(await h.background({type:'settings'})).settings;
    assert.equal(settings.selectors.question,'.question');assert.equal(settings.selectors.next,'.continue');assert.equal(settings.personalityTraits.E,5);assert.equal(settings.personalityTraits.A,2);
  });
  test('invalid settings and malformed CSS never overwrite saved configuration',async t=>{
    const h=await makeHarness();t.after(()=>h.close());await h.message({type:'desktop-command',action:'attach'});h.setBadSelector('[');
    const before=JSON.stringify((await h.background({type:'settings'})).settings);
    for(const payload of [{dwellSec:0},{personalityPreset:'custom',personalityRanking:'甲\n甲'},{personalityAnswers:'bad format'},{selectors:{question:'['}},{apiKey:'not-allowed'}]){
      const result=await h.message({type:'desktop-command',action:'configure',payload});assert.equal(result.ok,false);
      assert.equal(JSON.stringify((await h.background({type:'settings'})).settings),before);
    }
  });
  test('desktop start pause resume stop remain operable without DOM controls',async t=>{
    const h=await makeHarness();t.after(()=>h.close());await h.message({type:'desktop-command',action:'attach'});
    await h.message({type:'desktop-command',action:'start'});await flush();assert.equal(h.el('start').disabled,true);
    assert.equal((await h.message({type:'desktop-command',action:'configure',payload:{dwellSec:8}})).ok,false);
    await h.message({type:'desktop-command',action:'pause'});assert.equal(h.el('pause').textContent,'继续');
    await h.message({type:'desktop-command',action:'resume'});assert.equal(h.el('pause').textContent,'暂停');
    await h.message({type:'desktop-command',action:'stop'});assert.equal(h.el('start').disabled,false);assert.equal(h.host.isConnected,false);
  });
  test('unattached and invalid desktop actions are rejected',async t=>{
    const h=await makeHarness();t.after(()=>h.close());assert.equal((await h.message({type:'desktop-command',action:'start'})).ok,false);
    await h.message({type:'desktop-command',action:'attach'});
    for(const action of ['execute','apply'])assert.equal((await h.message({type:'desktop-command',action})).ok,false);
  });
  test('restoring a desktop session without the bridge does not restart work',async t=>{
    const h=await makeHarness({saved:{enabled:true,desktop:true,armed:true,hidden:true,count:8}});t.after(()=>h.close());
    assert.equal(h.sessions['assessmentPanel:7'].desktop,false);assert.equal(h.sessions['assessmentPanel:7'].armed,false);assert.equal(h.el('start').disabled,false);assert.equal(h.host.isConnected,false);
  });
  test('injecting the same controller version twice does not duplicate receivers',async t=>{
    const h=await makeHarness();t.after(()=>h.close());const count=h.receiverCount();h.reinject();await flush();assert.equal(h.receiverCount(),count);assert.equal(h.host.isConnected,false);
  });
}
