// Execute the actual popup script using synthetic DOM/Chrome messages. No GUI.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const PLUGIN=path.resolve(__dirname,'..');
const PAIR='43127.fixture_auth_1234567890abcdefgh';
const TOKEN=PAIR.split('.')[1];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function flush(){for(let i=0;i<10;i++)await tick();}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
class Element{
  constructor(tag,attrs,text){
    this.tagName=tag.toUpperCase();this.textContent=text||'';this.value='';
    this.disabled=/\bdisabled\b/.test(attrs);this.hidden=/\bhidden\b/.test(attrs);
    this.attributes=new Map([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
    this.type=this.attributes.get('type');this.classes=new Set();
    this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};
  }
  getAttribute(name){return this.attributes.get(name)??null;}
  async click(){if(!this.disabled)await this.onclick?.({target:this});}
}
async function harness(options={}){
  const html=fs.readFileSync(path.join(PLUGIN,'popup.html'),'utf8'),elements=new Map();
  for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>([^<]*)/g))elements.set(match[3],new Element(match[1],match[2],match[4]));
  const messages=[],tabs=[],logs=[];
  let desktop={connected:false,...options.desktop},statusCalls=0,closed=0;
  const chrome={runtime:{
    getManifest:()=>JSON.parse(fs.readFileSync(path.join(PLUGIN,'manifest.json'),'utf8')),
    getURL:file=>'chrome-extension://fixture/'+file,
    async sendMessage(message){
      messages.push({...message});
      if(message.type==='desktopStatus'){
        statusCalls++;
        const snapshot={ok:true,...desktop};
        if(options.statusGate&&statusCalls===(options.statusGateAt||1))await options.statusGate.promise;
        if(options.statusError||statusCalls===options.statusErrorAt)throw Error('status detail '+PAIR+' '+TOKEN);
        if(options.malformedStatus)return {ok:true};
        return snapshot;
      }
      if(message.type==='desktopConnect'){
        if(options.connectGate)await options.connectGate.promise;
        if(options.connectError)return {ok:false,error:'fixture connection refused '+PAIR+' token '+TOKEN};
        if(options.connectAckFalse)return {ok:true,connected:false};
        desktop={connected:true,tabId:7,tabTitle:'本地练习',capture:{requested:true,verified:true,error:'',...options.capture}};
        return {ok:true,...desktop};
      }
      if(message.type==='desktopDisconnect'){
        if(options.disconnectGate)await options.disconnectGate.promise;
        if(options.disconnectError)return {ok:false,error:'fixture disconnect refused '+TOKEN};
        if(options.disconnectAckWrong)return {ok:true,connected:true};
        desktop={connected:false};return {ok:true,connected:false};
      }
      // Any remaining page-panel, preference, or bank dependency is an error.
      throw Error('Unexpected popup dependency '+message.type);
    }},tabs:{
      async query(){return options.noTab?[]:[{id:7,url:'https://fixture.invalid/'}];},
      async create(tab){if(options.practiceError)throw Error('fixture practice unavailable');tabs.push(tab);}
    }};
  const context=vm.createContext({chrome,document:{getElementById:id=>elements.get(id)||null},
    window:{close(){closed++;}},console:{log:(...values)=>logs.push(values),error:(...values)=>logs.push(values),warn:(...values)=>logs.push(values)}});
  vm.runInContext(fs.readFileSync(path.join(PLUGIN,'popup.js'),'utf8'),context,{filename:'popup.js'});
  await flush();
  return {html,el:id=>elements.get(id),messages,tabs,logs,get desktop(){return desktop;},get closed(){return closed;},
    text:()=>[...elements.values()].map(element=>element.textContent).join('\n'),
    async connect(code=PAIR){elements.get('desktopCode').value=code;await elements.get('desktopConnect').click();await flush();}};
}

test('popup contains only desktop pairing and practice controls, without web panel or configuration dependencies',async()=>{
  const h=await harness();
  for(const id of ['openPanel','toggleVisibility','visibilityState','personality','settings','bank','preset','total'])assert.equal(h.el(id),undefined,id);
  assert.doesNotMatch(h.html,/<script[^>]+(?:shared|personality|options)\.js/);
  assert.equal(h.el('desktopCode').type,'password');
  assert.equal(h.el('desktopCode').getAttribute('autocomplete'),'off');
  assert.equal(h.el('desktopStatus').textContent,'未连接');
  assert.equal(h.el('desktopConnect').disabled,false);
  assert.deepEqual(h.messages.map(message=>message.type),['desktopStatus']);
  assert.equal(h.el('version').textContent,JSON.parse(fs.readFileSync(path.join(PLUGIN,'manifest.json'),'utf8')).version);
  assert.match(h.html,/桌面窗口的“偏好设置”与“页面适配”/);
});

test('connection binds the active tab without preferences or a question-bank read',async()=>{
  const h=await harness();await h.connect();
  assert.deepEqual(h.messages.map(message=>message.type),['desktopStatus','desktopConnect']);
  const call=h.messages[1];assert.equal(call.tabId,7);assert.equal(call.pairCode,PAIR);
  assert.equal(h.el('desktopCode').value,'');assert.equal(h.el('desktopPairing').hidden,true);
  assert.equal(h.el('desktopStatus').textContent,'已连接');assert.match(h.el('desktopTarget').textContent,/本地练习/);
  assert.match(h.el('desktopCapture').textContent,/已设置/);assert.equal(h.el('desktopDisconnect').hidden,false);
  assert.equal(h.closed,0);assert.deepEqual(h.tabs,[]);
});

test('disconnect resets connection controls without revealing or configuring a webpage panel',async()=>{
  const h=await harness();await h.connect();await h.el('desktopDisconnect').click();await flush();
  assert.equal(h.el('desktopStatus').textContent,'未连接');assert.equal(h.el('desktopPairing').hidden,false);
  assert.equal(h.el('desktopCapture').hidden,true);assert.equal(h.el('desktopTarget').hidden,true);
  assert.deepEqual(h.messages.map(message=>message.type),['desktopStatus','desktopConnect','desktopDisconnect']);
});

test('capture failure, disabled protection and unknown protection have distinct statuses',async()=>{
  const failed=await harness({capture:{requested:true,verified:false,error:'Windows error 87'}});await failed.connect();
  assert.match(failed.el('desktopCapture').textContent,/未生效.*87/);assert.doesNotMatch(failed.el('desktopCapture').textContent,/已设置/);
  assert.equal(failed.el('desktopCapture').classList.contains('warning'),true);
  const disabled=await harness({capture:{requested:false,verified:false}});await disabled.connect();
  assert.equal(disabled.el('desktopCapture').textContent,'采集排除已关闭');assert.equal(disabled.el('desktopCapture').classList.contains('warning'),false);
  const unknown=await harness({desktop:{connected:true,tabId:7}});
  assert.equal(unknown.el('desktopCapture').textContent,'采集排除状态未知');
});

test('failed connections and negative acknowledgements never claim success or print the pairing secret',async()=>{
  for(const options of [{connectError:true},{connectAckFalse:true}]){
    const h=await harness(options);await h.connect();
    assert.equal(h.el('desktopStatus').textContent,'未连接');assert.equal(h.el('desktopPairing').hidden,false);
    assert.equal(h.el('desktopError').hidden,false);assert.ok(!h.text().includes(PAIR));assert.ok(!h.text().includes(TOKEN));
    assert.deepEqual(h.logs,[]);
  }
});

test('invalid pairing strings do not reach the backend',async()=>{
  const h=await harness();
  for(const code of ['',`0.${TOKEN}`,`65536.${TOKEN}`,`04312.${TOKEN}`,`http://127.0.0.1:43127/${TOKEN}`,'43127.short'])await h.connect(code);
  assert.equal(h.messages.filter(message=>message.type==='desktopConnect').length,0);
  assert.match(h.el('desktopError').textContent,/完整连接码/);
});

test('missing active tab fails locally instead of requesting a desktop binding',async()=>{
  const h=await harness({noTab:true});await h.connect();
  assert.equal(h.messages.filter(message=>message.type==='desktopConnect').length,0);
  assert.match(h.el('desktopError').textContent,/普通网页/);
});

test('pending connection disables repeated connect, refresh and practice actions',async()=>{
  const gate=deferred(),h=await harness({connectGate:gate});
  h.el('desktopCode').value=PAIR;const pending=h.el('desktopConnect').click();await flush();
  assert.equal(h.el('desktopConnect').disabled,true);assert.equal(h.el('desktopRefresh').disabled,true);assert.equal(h.el('practice').disabled,true);
  await h.el('desktopConnect').click();await h.el('desktopRefresh').click();await h.el('practice').click();
  assert.equal(h.messages.filter(message=>message.type==='desktopConnect').length,1);assert.deepEqual(h.tabs,[]);
  gate.resolve();await pending;await flush();assert.equal(h.el('desktopStatus').textContent,'已连接');
});

test('failed or malformed initial status remains unknown but allows an explicit pairing retry',async()=>{
  for(const options of [{statusError:true},{malformedStatus:true}]){
    const h=await harness(options);
    assert.equal(h.el('desktopStatus').textContent,'状态未知');assert.equal(h.el('desktopConnect').disabled,false);
    assert.ok(!h.text().includes(PAIR));assert.ok(!h.text().includes(TOKEN));
    await h.connect();assert.equal(h.el('desktopStatus').textContent,'已连接');
  }
});

test('failed disconnect retains the last confirmed binding and redacts previously submitted token',async()=>{
  for(const options of [{disconnectError:true},{disconnectAckWrong:true}]){
    const h=await harness(options);await h.connect();await h.el('desktopDisconnect').click();await flush();
    assert.equal(h.el('desktopStatus').textContent,'已连接');assert.equal(h.el('desktopPairing').hidden,true);
    assert.equal(h.el('desktopError').hidden,false);assert.ok(!h.text().includes(TOKEN));assert.equal(h.el('desktopDisconnect').disabled,false);
  }
});

test('late status refresh cannot overwrite a completed disconnect',async()=>{
  const gate=deferred(),h=await harness({statusGate:gate,statusGateAt:2,desktop:{connected:true,tabId:7,tabTitle:'原连接'}});
  const pending=h.el('desktopRefresh').click();await flush();assert.equal(h.el('desktopStatus').textContent,'正在检查…');
  await h.el('desktopDisconnect').click();await flush();assert.equal(h.el('desktopStatus').textContent,'未连接');
  gate.resolve();await pending;await flush();assert.equal(h.el('desktopStatus').textContent,'未连接');assert.equal(h.el('desktopPairing').hidden,false);
});

test('failed refresh preserves a known binding instead of reporting it disconnected',async()=>{
  const h=await harness({statusErrorAt:2,desktop:{connected:true,tabId:7,tabTitle:'已配对页面'}});
  await h.el('desktopRefresh').click();await flush();
  assert.equal(h.el('desktopStatus').textContent,'已连接');assert.match(h.el('desktopTarget').textContent,/已配对页面/);
  assert.equal(h.el('desktopError').hidden,false);
});

test('practice opens only the packaged exercise page and never opens settings or a webpage panel',async()=>{
  const h=await harness();await h.el('practice').click();await flush();
  assert.equal(h.tabs.length,1);assert.equal(h.tabs[0].url,'chrome-extension://fixture/personality-practice.html');
  assert.deepEqual(h.messages.map(message=>message.type),['desktopStatus']);
});
