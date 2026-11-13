const el=id=>document.getElementById(id);
el("version").textContent=chrome.runtime.getManifest().version;
let desktopState={connected:false}, desktopKnown=false, desktopBusy=false, desktopStatusPending=true, desktopRevision=0, desktopError="";
const redactionSecrets=new Set();

async function request(message){
  const result=await chrome.runtime.sendMessage(message);
  if(!result?.ok)throw Error(result?.error||"插件未响应，请重新打开此弹窗。");
  return result;
}
function redact(error,pairCode=""){
  let message=String(error?.message||error||"桌面连接失败，请确认桌面程序仍在运行。");
  const pieces=[pairCode,pairCode.split(".").slice(1).join("."),...redactionSecrets];
  for(const secret of pieces)if(secret.length>=16)message=message.split(secret).join("[连接码已隐藏]");
  return message.replace(/\b\d{1,5}\.[A-Za-z0-9_-]{16,128}\b/g,"[连接码已隐藏]").slice(0,400);
}
function view(result,pairCode=""){
  const capture=result.capture;
  return {connected:result.connected===true,tabId:Number.isInteger(result.tabId)?result.tabId:null,
    tabTitle:typeof result.tabTitle==="string"?result.tabTitle.slice(0,160):"",
    capture:capture&&typeof capture==="object"?{requested:capture.requested===true,verified:capture.verified===true,
      error:capture.error?redact(capture.error,pairCode):""}:null};
}
function paint(){
  const connected=desktopState.connected;
  el("desktopPairing").hidden=connected;
  el("desktopCode").disabled=desktopBusy;
  el("desktopConnect").disabled=desktopBusy||desktopStatusPending;
  el("desktopConnect").textContent=desktopBusy&&!connected?"正在连接…":"连接当前页面";
  el("desktopDisconnect").hidden=!connected;
  el("desktopDisconnect").disabled=desktopBusy;
  el("desktopDisconnect").textContent=desktopBusy&&connected?"正在断开…":"断开桌面连接";
  el("desktopRefresh").disabled=desktopBusy||desktopStatusPending;
  el("practice").disabled=desktopBusy;
  el("desktopStatus").textContent=desktopStatusPending?"正在检查…":!desktopKnown?"状态未知":connected?"已连接":"未连接";
  el("desktopStatus").classList.toggle("connected",connected);
  el("desktopTarget").hidden=!connected||!desktopState.tabTitle;
  el("desktopTarget").textContent=connected&&desktopState.tabTitle?"连接页面："+desktopState.tabTitle:"";
  const capture=desktopState.capture;
  el("desktopCapture").hidden=!connected;
  el("desktopCapture").classList.toggle("warning",connected&&(!capture||capture.requested&&!capture.verified));
  el("desktopCapture").textContent=!connected?"":!capture?"采集排除状态未知":!capture.requested?"采集排除已关闭":capture.verified?"采集排除已设置 · 效果取决于捕获方式":"采集排除未生效"+(capture.error?"："+capture.error:"");
  el("desktopError").hidden=!desktopError;
  el("desktopError").textContent=desktopError;
}
async function readStatus(){
  if(desktopBusy)return;
  const revision=++desktopRevision;
  desktopStatusPending=true;paint();
  try{
    const result=await request({type:"desktopStatus"});
    if(revision!==desktopRevision)return;
    if(typeof result.connected!=="boolean")throw Error("桌面连接状态不完整。");
    desktopState=view(result);desktopKnown=true;
    desktopError=result.error?"桌面连接不可用，请确认桌面程序仍在运行。":"";
  }catch{
    if(revision!==desktopRevision)return;
    desktopError="暂时无法读取桌面连接状态，可粘贴连接码重试。";
  }finally{
    if(revision===desktopRevision){desktopStatusPending=false;paint();}
  }
}
el("desktopConnect").onclick=async()=>{
  if(desktopBusy||desktopStatusPending||desktopState.connected)return;
  const pairCode=el("desktopCode").value.trim();
  const match=/^([1-9]\d{0,4})\.([A-Za-z0-9_-]{24,128})$/.exec(pairCode);
  if(!match||Number(match[1])>65535){desktopError="请粘贴桌面程序显示的完整连接码。";paint();return;}
  redactionSecrets.add(pairCode);redactionSecrets.add(match[2]);
  ++desktopRevision;desktopStatusPending=false;desktopBusy=true;desktopError="";paint();
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!Number.isInteger(tab?.id))throw Error("请先打开要连接的普通网页。");
    const result=await request({type:"desktopConnect",pairCode,tabId:tab.id});
    if(result.connected!==true)throw Error("桌面程序未确认连接，请重试。");
    desktopState=view(result,pairCode);desktopKnown=true;el("desktopCode").value="";
  }catch(error){desktopError=redact(error,pairCode);}
  finally{desktopBusy=false;paint();}
};
el("desktopDisconnect").onclick=async()=>{
  if(desktopBusy||!desktopState.connected)return;
  ++desktopRevision;desktopStatusPending=false;desktopBusy=true;desktopError="";paint();
  try{
    const result=await request({type:"desktopDisconnect"});
    if(result.connected!==false)throw Error("桌面连接尚未确认断开，请重试。");
    desktopState={connected:false};desktopKnown=true;
  }catch(error){desktopError=redact(error);}
  finally{desktopBusy=false;paint();}
};
el("desktopRefresh").onclick=()=>readStatus();
el("practice").onclick=async()=>{
  if(desktopBusy)return;
  try{await chrome.tabs.create({url:chrome.runtime.getURL("personality-practice.html")});}
  catch(error){desktopError=redact(error);paint();}
};
readStatus();
