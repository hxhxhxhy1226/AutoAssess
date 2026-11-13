const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plugin=path.resolve(__dirname,'..');
function harness(){
  const calls=[],listeners=[];
  const event={addListener(){}};
  const chrome={runtime:{getURL:file=>'chrome-extension://test-extension/'+file,onMessage:{addListener(fn){listeners.push(fn);}},onInstalled:event},
    storage:{session:{},local:{}},tabs:{onRemoved:event},commands:{onCommand:event}};
  const context=vm.createContext({chrome,URL,setTimeout,clearTimeout});
  context.importScripts=(...files)=>files.forEach(file=>{
    if(file==='desktop-bridge.js')context.AssessmentDesktopBridge={createDesktopBridge:()=>({
      pulse:async(id,value)=>{calls.push({type:'pulse',id,value});return {connected:true};},
      ping:async id=>{calls.push({type:'ping',id});return {connected:true};}
    })};
    else vm.runInContext(fs.readFileSync(path.join(plugin,file),'utf8'),context);
  });
  vm.runInContext(fs.readFileSync(path.join(plugin,'background.js'),'utf8'),context);
  return {calls,send:(message,sender)=>new Promise(resolve=>listeners[0](message,sender,resolve))};
}
test('desktop heartbeat from a built-in extension practice tab uses its explicit tab ID',async()=>{
  for(const page of ['practice.html','personality-practice.html']){
    const h=harness();
    assert.equal((await h.send({type:'desktopPulse',tabId:7,snapshot:{count:1}},{url:'chrome-extension://test-extension/'+page+'?fixture=1'})).connected,true);
    assert.equal(h.calls[0].id,7);
    assert.equal((await h.send({type:'desktopPing',tabId:7},{url:'chrome-extension://test-extension/'+page})).connected,true);
  }
});
test('ordinary page sender tab overrides supplied IDs and unrelated contexts cannot send heartbeats',async()=>{
  const h=harness();
  await h.send({type:'desktopPulse',tabId:99,snapshot:{}},{tab:{id:7},url:'https://fixture.invalid/'});
  assert.equal(h.calls[0].id,7);
  for(const url of ['https://fixture.invalid/','chrome-extension://test-extension/popup.html','chrome-extension://other/practice.html']){
    const result=await h.send({type:'desktopPing',tabId:99},{url});assert.equal(result.connected,false);
  }
  assert.equal(h.calls.length,1);
});
