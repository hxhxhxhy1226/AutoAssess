// Exercise the real JS bridge against the real Python loopback server, without GUI.
const assert=require('node:assert/strict');
const readline=require('node:readline');
const {createDesktopBridge}=require('../assessment-plugin/desktop-bridge.js');
const Settings=require('../assessment-plugin/desktop-settings.js');
(async()=>{
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
const setup=JSON.parse((await lines.next()).value);
const data={},actions=[],page={desktop:false,running:false,paused:false,mode:'manual',dwellSec:5};
let preferences=Settings.validate({personalityPreset:'custom',personalityTraits:{E:2},personalityStrategy:'positive',autoNext:true});
const storage={async get(key){return {[key]:data[key]};},async set(value){Object.assign(data,value);},async remove(key){delete data[key];}};
const bridge=createDesktopBridge({storage,getTab:async id=>({id,url:'https://fixture.invalid/',title:'本机联调样例'}),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,
  openPanel:async()=>({opened:true}),writePanel:async()=>{},newClientId:()=> 'wire-test-client',getSettings:async()=>preferences,
  fetch:(url,init)=>fetch(url,{...init,headers:{...init.headers,Origin:'chrome-extension://'+'a'.repeat(32)}}),
  sendTab:async(id,message)=>{
    assert.equal(id,7);
    const action=message.type==='stop-run'?'stop':message.action;actions.push(action);
    if(action==='attach')page.desktop=true;
    if(action==='detach')page.desktop=false;
    if(action==='start')page.running=true;
    if(action==='stop'){page.running=false;page.paused=false;}
    if(action==='pause')page.paused=true;
    if(action==='resume')page.paused=false;
    if(action==='configure'){
      preferences=Settings.validate({...preferences,...message.payload,personalityTraits:{...preferences.personalityTraits,...(message.payload.personalityTraits||{})},selectors:{...preferences.selectors,...(message.payload.selectors||{})}});
      page.mode=preferences.mode;page.dwellSec=preferences.dwellSec;
    }
    return {ok:true};
  }});
const connected=await bridge.connect(setup.code,7);
assert.equal(connected.connected,true);
assert.equal(JSON.stringify(connected).includes(setup.code.split('.')[1]),false);
process.stdout.write(JSON.stringify({phase:'connected',connected:true})+'\n');
while(true){
  const next=await lines.next();if(next.done)break;
  const command=JSON.parse(next.value);
  if(command.op==='disconnect'){
    await bridge.disconnect();process.stdout.write(JSON.stringify({phase:'disconnected',page,actions})+'\n');break;
  }
  const result=await bridge.pulse(7,{status:'本机联调',question:'合成题面',answer:'A',explanation:'协议样例',questionType:'量表',basis:'测试',count:0,countdown:'—',canApply:false,...page});
  process.stdout.write(JSON.stringify({phase:'pulse',connected:result.connected,page,actions})+'\n');
}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
