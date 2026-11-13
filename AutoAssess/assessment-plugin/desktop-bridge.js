(function(root){
  "use strict";
  const KEY="assessmentDesktopBridge", PROTOCOL=1;
  const ACTIONS=new Set(["start","pause","resume","stop","apply","configure"]);
  const Settings=root.AssessmentDesktopSettings||(typeof require==='function'?require('./desktop-settings.js'):null);
  const text=(value,max=500)=>typeof value==="string"?value.slice(0,max):"";
  function pairing(value){
    const match=typeof value==="string"&&value.trim().match(/^([1-9]\d{0,4})\.([A-Za-z0-9_-]{24,128})$/);
    if(!match||Number(match[1])>65535)throw Error("连接码格式不正确，请从桌面窗口复制完整连接码。");
    return {port:Number(match[1]),token:match[2]};
  }
  function protection(value){return {requested:Boolean(value?.requested),verified:Boolean(value?.verified),error:text(value?.error,300)};}
  function snapshot(value={}){
    const result={};
    for(const [key,limit] of Object.entries({status:2000,countdown:64,question:20000,questionType:128,answer:8192,explanation:20000,basis:128}))
      result[key]=text(value[key],limit);
    result.mode=value.mode==="auto"?"auto":"manual";
    for(const key of ["running","paused","canApply"])result[key]=value[key]===true;
    result.count=Number.isInteger(value.count)&&value.count>=0?value.count:0;
    result.dwellSec=Number.isInteger(value.dwellSec)&&value.dwellSec>=1&&value.dwellSec<=120?value.dwellSec:5;
    return result;
  }
  function createDesktopBridge(deps){
    const now=deps.now||Date.now;
    let config=null,loaded=false,generation=0,connecting=false,inFlight=null,lastError="",capture=protection(null),acks=[],lastSettingsSent='';
    const preferences=async()=>Settings.fromApp(deps.getSettings?await deps.getSettings():{});
    async function load(){
      if(loaded)return config;
      const saved=(await deps.storage.get(KEY))[KEY];
      loaded=true;
      if(saved&&Number.isInteger(saved.tabId)&&typeof saved.clientId==="string"){
        try{const pair=pairing(saved.port+"."+saved.token);config={...pair,tabId:saved.tabId,tabTitle:text(saved.tabTitle,200),clientId:saved.clientId,seen:Array.isArray(saved.seen)?saved.seen.slice(-128):[]};}catch{}
      }
      return config;
    }
    async function save(){if(config)await deps.storage.set({[KEY]:config});else await deps.storage.remove(KEY);}
    async function request(cfg,path,body){
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),2500);
      try{
        const encoded=body===undefined?undefined:JSON.stringify(body);
        if(encoded&&new TextEncoder().encode(encoded).length>512*1024)throw Error('桌面消息过大，请缩短自定义配置。');
        const response=await deps.fetch(`http://127.0.0.1:${cfg.port}${path}`,{
          method:body===undefined?"GET":"POST",headers:{"Authorization":"Bearer "+cfg.token,...(body===undefined?{}:{"Content-Type":"application/json"})},
          ...(body===undefined?{}:{body:encoded}),signal:controller.signal,redirect:"error",credentials:"omit",cache:"no-store"
        });
        const data=await response.json();
        if(!response.ok||data?.ok!==true)throw Error(text(data?.error,300)||"桌面程序未接受连接。");
        return data;
      }catch(error){
        const message=text(error?.message,300).replaceAll(cfg.token,"[连接码]");
        throw Error(error?.name==="AbortError"?"桌面程序响应超时。":message||"无法连接桌面程序。");
      }finally{clearTimeout(timer);}
    }
    function publicState(){return {connected:Boolean(config),...(config?{tabId:config.tabId,tabTitle:config.tabTitle,capture}:{}),...(lastError?{error:lastError}:{})};}
    async function disconnect(options={}){
      await load();const previous=config;generation++;config=null;inFlight=null;acks=[];lastSettingsSent='';await save();
      if(previous){
        // Stop first: losing the control window must not leave automation running.
        if(!options.skipTab){
          try{await deps.sendTab(previous.tabId,{type:"stop-run"});}catch{}
          try{await deps.sendTab(previous.tabId,{type:"desktop-command",action:"detach"});}catch{}
        }
        await deps.writePanel(previous.tabId,{desktop:false,armed:false,paused:false,hidden:true});
        if(options.notify!==false)try{await request(previous,"/disconnect",{clientId:previous.clientId});}catch{}
      }
      return {connected:false,...(lastError?{error:lastError}:{})};
    }
    async function failed(error){lastError=text(error?.message,300)||"桌面连接中断，已停止。";await disconnect({notify:false});return {connected:false,error:lastError};}
    async function connect(pairCode,tabId){
      if(connecting)throw Error("正在连接桌面窗口，请稍候。");
      const pair=pairing(pairCode);
      if(!Number.isInteger(tabId))throw Error("请先打开需要连接的网页。");
      connecting=true;let started=false;
      try{
        const tab=await deps.getTab(tabId),url=new URL(tab.url||"about:blank");
        const own=["practice.html","personality-practice.html"].some(path=>url.href.split(/[?#]/)[0]===deps.getURL(path));
        if(!own&&!["http:","https:"].includes(url.protocol))throw Error("当前页面不能连接桌面面板。");
        started=true;
        await disconnect();lastError="";
        const candidate={...pair,tabId,tabTitle:text(tab.title,200)||url.hostname,clientId:deps.newClientId(),seen:[]};
        const settings=await preferences();
        const response=await request(candidate,"/connect",{clientId:candidate.clientId,tab:{id:tabId,title:candidate.tabTitle},version:"0.5.1",settings});
        if(response.protocol!==PROTOCOL)throw Error("桌面程序协议版本不兼容。");
        if(response.capabilities?.settings!==true){
          try{await request(candidate,'/disconnect',{clientId:candidate.clientId});}catch{}
          throw Error('请关闭旧桌面程序并启动0.5.1或更新版本，以使用桌面配置。');
        }
        capture=protection(response.capture);
        if(capture.requested&&!capture.verified){
          try{await request(candidate,"/disconnect",{clientId:candidate.clientId});}catch{}
          throw Error("桌面窗口采集排除尚未生效，请先检查桌面窗口中的状态。"+(capture.error?" "+capture.error:""));
        }
        config=candidate;generation++;acks=[];lastSettingsSent=JSON.stringify(settings);await save();
        await deps.writePanel(tabId,{enabled:true,hidden:true,desktop:true});
        await deps.openPanel(tabId,false);
        const attached=await deps.sendTab(tabId,{type:"desktop-command",action:"attach"});
        if(!attached?.ok)throw Error(attached?.error||"页面未能连接桌面控制器。");
        return publicState();
      }catch(error){if(started)await failed(error);throw error;}finally{connecting=false;}
    }
    async function ping(tabId){
      const cfg=await load();if(!cfg||cfg.tabId!==tabId)return {connected:false};
      const epoch=generation;
      try{
        const health=await request(cfg,"/health");
        if(epoch!==generation)return {connected:false};
        if(health.protocol!==PROTOCOL||health.app!=="assessment-desktop"||!health.connected)throw Error("桌面程序已断开，请重新连接。");
        if(health.capabilities?.settings!==true)throw Error('桌面程序版本已过期，请重启0.5.1或更新版本。');
        capture=protection(health.capture);return publicState();
      }catch(error){
        if(epoch!==generation)return {connected:false};
        // This health check can be requested while the content script awaits
        // initialization. Do not call back into that still-pending receiver.
        lastError=text(error?.message,300)||"桌面连接中断。";
        await disconnect({notify:false,skipTab:true});return {connected:false,error:lastError};
      }
    }
    async function status(){const cfg=await load();return cfg?ping(cfg.tabId):publicState();}
    function validate(command){
      if(!command||typeof command.id!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(command.id))throw Error("桌面命令编号无效。");
      if(!ACTIONS.has(command.action))throw Error("不支持的桌面命令。");
      if(!Number.isFinite(command.expiresAt)||command.expiresAt<now()||command.expiresAt>now()+60000)throw Error("桌面命令已过期，请重新操作。");
      const result={type:"desktop-command",action:command.action,commandId:command.id};
      if(command.action==="configure"){
        result.payload=Settings.validate(command.payload,{partial:true});
      }
      return result;
    }
    async function pulse(tabId,value){
      const cfg=await load();if(!cfg||cfg.tabId!==tabId)return {connected:false};
      if(inFlight)return inFlight;
      const epoch=generation;
      const operation=(async()=>{
        try{
          const settings=await preferences(),encodedSettings=JSON.stringify(settings);
          const response=await request(cfg,"/exchange",{clientId:cfg.clientId,snapshot:snapshot(value),acknowledgements:acks,...(encodedSettings===lastSettingsSent?{}:{settings})});
          if(epoch!==generation)return {connected:false};
          lastSettingsSent=encodedSettings;
          acks=[];capture=protection(response.capture);
          if(!Array.isArray(response.commands)||response.commands.length>16)throw Error("桌面命令队列无效。");
          for(const command of response.commands){
            if(epoch!==generation)return {connected:false};
            const known=cfg.seen.find(item=>item.id===command?.id);
            if(known){acks.push(known);continue;}
            let id=typeof command?.id==="string"?command.id.slice(0,80):"invalid",ack;
            try{
              const message=validate(command);
              // Commit an at-most-once marker before any page action. A worker
              // restart reports uncertainty instead of replaying a lost action.
              const pending={id,ok:false,error:"执行确认丢失，请检查页面状态后重新操作。"};
              cfg.seen=[...cfg.seen,pending].slice(-128);await save();
              if(epoch!==generation)return {connected:false};
              const result=await deps.sendTab(cfg.tabId,message);
              if(epoch!==generation)return {connected:false};
              ack=result?.ok?{id,ok:true}:{id,ok:false,error:text(result?.error,300)||"页面未接受命令。"};
            }catch(error){ack={id,ok:false,error:text(error?.message,300)||"桌面命令失败。"};}
            cfg.seen=[...cfg.seen.filter(item=>item.id!==id),ack].slice(-128);await save();acks.push(ack);
          }
          return publicState();
        }catch(error){if(epoch!==generation)return {connected:false};return failed(error);}
      })();
      inFlight=operation;
      try{return await operation;}finally{if(inFlight===operation)inFlight=null;}
    }
    return {connect,status,disconnect,pulse,ping};
  }
  const api={createDesktopBridge};root.AssessmentDesktopBridge=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(globalThis);
