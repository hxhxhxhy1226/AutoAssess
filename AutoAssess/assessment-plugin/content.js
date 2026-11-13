(() => {
  const controllerVersion=chrome.runtime.getManifest().version;
  if(globalThis.__assessmentDesktopControllerVersion===controllerVersion)return;
  const A = globalThis.Assessment, P = globalThis.AssessmentPersonality, adapter = globalThis.AssessmentAdapter;
  const host = document.createElement("div"); host.id = "assessment-assistant";
  host.style.cssText = "display:none;position:fixed;right:24px;top:80px;z-index:2147483647;font-family:Microsoft YaHei,system-ui,sans-serif";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = [
    '<style>*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.panel{width:340px;max-height:calc(100dvh - 96px);display:flex;flex-direction:column;color:#352744;background:#fff;border:1px solid #e5dbf3;border-radius:20px;box-shadow:0 16px 50px #25113b20;font-size:12px}.top{display:flex;gap:10px;align-items:center;padding:18px;border-bottom:1px solid #f1edf5;cursor:move}.logo{background:#753bec;color:white;border-radius:10px;padding:8px;font-weight:700}.top strong{font-size:16px}.top small{display:block;color:#9c8baa;font-size:10px}.icon{border:0;background:#f5f1fb;border-radius:50%;width:28px;height:28px;color:#8a72a1}.body{padding:16px;overflow:auto;min-height:0}.seg{display:flex;gap:4px;padding:4px;border-radius:10px;background:#f5f0fd;margin-bottom:16px}.seg button{flex:1;border:0;border-radius:7px;padding:9px;color:#81738e;background:transparent}.seg button.active{background:#753bec;color:white}label{display:block;margin:13px 0 5px;color:#7c6f88}input,select{width:100%;border:1px solid #e4dbea;padding:10px;border-radius:8px;background:white;color:#3d304a}.hint{font-size:11px;color:#94849f;line-height:1.7}.metrics{display:flex;gap:8px;margin:16px 0}.metrics div{flex:1;background:#f8f5fb;border-radius:10px;padding:10px;color:#9989a5;font-size:10px}.metrics b{display:block;color:#634783;font-size:17px}.status{padding:12px;line-height:1.7;white-space:pre-wrap;background:#f4efff;border:1px solid #eadffd;border-radius:10px;margin:12px 0}.status.error{background:#fff4ec;border-color:#f1d8bc;color:#9d5c27}h3{font-size:13px;margin:14px 0 8px}.question,.reason{max-height:170px;overflow:auto;white-space:pre-wrap;line-height:1.75;overflow-wrap:anywhere}.answer{padding:13px;border-radius:10px;background:#eee5ff;color:#7538d0;margin:12px 0}.answer strong{display:block;font-size:16px;margin-top:6px}.small{border:0;border-radius:8px;padding:8px 10px;background:#f0e7fd;color:#7749a8}.actions{display:flex;gap:8px;padding:13px 16px;border-top:1px solid #eee6f4}.primary{flex:1;border:0;border-radius:9px;background:#753bec;color:white;padding:11px}.secondary{border:1px solid #e5dced;border-radius:9px;padding:9px;background:white;color:#887495}.footer{padding:10px 16px;border-top:1px solid #f1edf5;display:flex;justify-content:space-between;font-size:10px;color:#9a8aa5}.link{border:0;background:none;padding:0;color:#8966b2;font-size:11px}.launcher{border:1px solid #d6c6ef;border-radius:24px;background:white;color:#7545b5;padding:12px 16px;box-shadow:0 8px 22px #35155720}.hidden,[hidden]{display:none!important}:focus-visible{outline:3px solid #c2a6ee;outline-offset:2px}</style>',
    '<button id="launcher" class="launcher" hidden>性格助手 <span id="miniStatus"></span></button>',
    '<section class="panel"><header class="top"><span class="logo">P</span><div style="flex:1"><strong>离线性格助手</strong><small>本地偏好规则 · 无需模型</small></div><button id="hide" class="icon" title="完全隐藏 · 从工具栏弹窗恢复" aria-label="完全隐藏界面">−</button><button id="collapse" class="icon" title="折叠面板">⌄</button><button id="close" class="icon" title="关闭并停止">×</button></header>',
    '<div class="body"><div class="seg" id="modes"><button data-mode="auto">自动填写</button><button data-mode="manual">手动辅助</button></div><div id="completion" class="status" hidden></div>',
    '<section id="setup"><label for="personalityPreset">性格偏好</label><select id="personalityPreset"></select><label for="personalityStrategy">答题策略</label><select id="personalityStrategy"></select><p id="strategyHint" class="hint"></p><label for="dwell">填写后停留（秒）</label><input id="dwell" type="number" min="1" max="120" value="5"><p class="hint">根据你的偏好选择；性格题没有统一正确答案。无法识别的描述会按策略处理并说明依据。</p></section>',
    '<div class="metrics"><div><b id="count">0</b>本次已填写</div><div><b id="countdown">—</b>切题倒计时</div><div><b id="basis">离线</b>选择依据</div></div><div class="status" id="status" role="status" aria-live="polite">正在连接…</div>',
    '<section id="result" hidden><h3>当前题目 <small id="questionType"></small></h3><div id="question" class="question"></div><div class="answer"><span id="source">离线性格</span><strong id="answer">—</strong></div><h3>选择说明</h3><div id="reason" class="reason"></div><button id="apply" class="small" disabled style="margin-top:12px">仅填写本题</button></section></div>',
    '<div class="actions"><button id="start" class="primary">开始识别</button><button id="pause" class="secondary" disabled>暂停</button><button id="stop" class="secondary" disabled>停止</button></div><footer class="footer"><button id="options" class="link">性格偏好与题库 ↗</button><span>工具栏可隐藏 / 恢复</span></footer></section>'
  ].join("");
  shadow.querySelector('.top small').textContent = 'v' + chrome.runtime.getManifest().version + ' · 本地偏好规则 · 无需模型';
  // Detached state elements support the existing answer loop; they are never
  // mounted in the webpage. All visible controls now live in the desktop app.
  const el = id => shadow.getElementById(id), panel = shadow.querySelector(".panel");
  for (const [id,preset] of Object.entries(P.presets)) el("personalityPreset").add(new Option(preset.name,id));
  for (const [id,strategy] of Object.entries(P.strategies)) el("personalityStrategy").add(new Option(strategy.name,id));
  const state = { settings:A.settings(), generation:0, running:false, paused:false, count:0, answer:null, snapshot:null, collapsed:false, hidden:false, desktop:false, navigating:false };
  const ownTab = location.protocol === "chrome-extension:" && chrome.tabs?.getCurrent ? chrome.tabs.getCurrent() : Promise.resolve(null);
  async function send(message) {
    const tab = await ownTab;
    const response = await chrome.runtime.sendMessage({ ...message, ...(tab?.id ? {tabId:tab.id}: {}) });
    if (!response?.ok) throw Error(response?.error || "插件未响应，请刷新网页后重试。");
    return response;
  }
  const checkpoint = value => send({type:"panelSession",state:value}).catch(()=>{});
  function status(message,error=false) { el("status").textContent=message;el("status").classList.toggle("error",error);el("miniStatus").textContent=state.running?(state.paused?"暂停":"运行中"):""; }
  function controls() {
    el("start").disabled=state.running;el("pause").disabled=!state.running;el("stop").disabled=!state.running;
    el("pause").textContent=state.paused?"继续":"暂停";el("setup").hidden=state.running;
    shadow.querySelectorAll("#setup input,#setup select,[data-mode]").forEach(n=>n.disabled=state.running);
  }
  function updateSetup() {
    el("strategyHint").textContent=P.strategies[el("personalityStrategy").value]?.description || "";
    shadow.querySelectorAll("[data-mode]").forEach(n=>n.classList.toggle("active",n.dataset.mode===state.settings.mode));
  }
  function renderVisibility() {
    host.style.display="none";panel.hidden=true;el("launcher").hidden=true;
  }
  function toggle(force) {
    return Promise.reject(Error('网页浮窗已移除，请在桌面窗口操作。'));
  }
  function hidePanel(hidden=true) {
    state.hidden=Boolean(hidden);renderVisibility();
    return checkpoint({enabled:true,hidden:state.hidden});
  }
  function stop(message="已停止，可重新开始。") {
    state.generation++;state.running=false;state.paused=false;state.answer=null;el("apply").disabled=true;
    send({type:"cancel"}).catch(()=>{});checkpoint({armed:false,paused:false,count:state.count});
    controls();el("countdown").textContent="—";status(message);
  }
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitActive(ms,generation,countdown=false) {
    let left=ms,last=performance.now();
    while(left>0||state.paused) {
      if(generation!==state.generation||!state.running)return false;
      await sleep(50);const now=performance.now();if(!state.paused)left-=now-last;last=now;
      if(countdown)el("countdown").textContent=Math.max(0,left/1000).toFixed(1)+"s";
    }
    return generation===state.generation&&state.running;
  }
  function finished() {
    const allowed=location.protocol==="chrome-extension:"||document.body?.dataset.site==="mock-assessment"||document.body?.hasAttribute("data-personality-fixture");
    const marker=allowed&&document.querySelector('[data-personality-complete="true"]');
    if(!marker||!marker.getClientRects().length){
      if(el("completion").dataset.state){el("completion").hidden=true;delete el("completion").dataset.state;if(!state.running)status("新的性格练习已就绪，可开始识别。");}
      return false;
    }
    el("completion").hidden=false;el("completion").dataset.state="complete";
    el("completion").textContent="本场性格练习已完成 · 本次填写 "+state.count+" 题";
    state.answer=null;el("apply").disabled=true;status("本场性格练习已完成。");return true;
  }
  async function waitQuestion(generation) {
    let previous="";
    while(generation===state.generation&&state.running) {
      if(!await waitActive(1,generation)||finished())return null;
      try{return adapter.read(state.settings);}catch(error){
        if(error.code!=="QUESTION_NOT_READY")throw error;
        if(previous!==error.message){previous=error.message;status("等待性格题目。\n"+error.message);}
      }
      if(!await waitActive(200,generation))return null;
    }
    return null;
  }
  async function start(resume=false,resumePaused=false) {
    if(state.running)return;
    const generation=++state.generation;state.running=true;state.paused=resumePaused;state.navigating=false;state.answer=null;
    el("result").hidden=true;el("completion").hidden=true;delete el("completion").dataset.state;el("apply").disabled=true;controls();status(resumePaused?"已暂停，点击继续后开始。":"正在读取性格题目…");
    try {
      const saved=await send({type:"settings"});if(generation!==state.generation)return;
      state.settings=A.settings({...saved.settings,taskMode:"personality",mode:state.settings.mode,personalityPreset:el("personalityPreset").value,personalityStrategy:el("personalityStrategy").value,dwellSec:Number(el("dwell").value)});
      await send({type:"savePanel",settings:state.settings});if(generation!==state.generation)return;
      if(!resume){state.count=0;el("count").textContent="0";}
      await checkpoint({enabled:true,armed:true,paused:state.paused,count:state.count});
      const visited=new Set(), snapshotKey=snapshot=>JSON.stringify([snapshot.fingerprint,snapshot.pageGroup?.index,snapshot.pageGroup?.fingerprint]);
      while(generation===state.generation&&state.running) {
        const snapshot=await waitQuestion(generation);if(!snapshot||generation!==state.generation)return;
        if(!snapshot.answered&&visited.has(snapshotKey(snapshot)))throw Error("题目没有变化，已停止重复填写；请检查下一步。");
        const reason=P.supportReason(snapshot.question);if(reason)throw Error(reason);
        state.snapshot=snapshot;state.answer=null;el("result").hidden=false;
        el("question").textContent=snapshot.question.stem;el("questionType").textContent=snapshot.matrix?"矩阵量表":snapshot.pair?snapshot.question.options.length+"项双角色迫选":A.types[snapshot.question.type]||"性格题";
        if(snapshot.pageGroup)el("questionType").textContent+=' · 本页 '+(snapshot.pageGroup.index+1)+'/'+snapshot.pageGroup.count;
        if(snapshot.disc)el("questionType").textContent='DISC 四选二 · '+(snapshot.disc.groupIndex+1)+'/'+snapshot.disc.groupCount+' 组';
        let outcome;
        if(snapshot.answered){
          el("answer").textContent="已有选择";el("source").textContent="网页已有作答";el("reason").textContent="本页已答题目已保留。";el("apply").disabled=true;
          status("本页已有完整选择，请确认下一步。");
          if(state.settings.mode==='manual'||!state.settings.autoNext)break;
          outcome={advanced:false};
        }else{
        el("answer").textContent="…";el("reason").textContent="正在按本地偏好规则选择…";status("正在计算离线选择…");
        const response=await send({type:"solve",question:snapshot.question,personalitySettings:state.settings});
        if(generation!==state.generation)return;
        if(snapshotKey(adapter.read(state.settings))!==snapshotKey(snapshot))throw Error("题目已变化，旧结果已作废。");
        if(!response.answer?.offline)throw Error("未收到有效离线结果，已停止。");
        state.answer=response.answer;el("answer").textContent=A.answerLabel(state.answer);el("source").textContent=state.answer.source;el("reason").textContent=state.answer.explanation;
        el("basis").textContent=state.answer.method==="exact"?"精确规则":(["random","tie","unrecognized"].includes(state.answer.strategyBasis)?"随机":"偏好");
        el("apply").disabled=false;
        if(state.settings.mode==="manual"){status("离线结果已就绪，请核对后填写。");break;}
        if(!await waitActive(1,generation))return;
        el("apply").disabled=true;
        outcome=await adapter.apply(snapshot,state.answer,state.settings,()=>waitActive(1,generation));
        if(generation!==state.generation)return;
        state.count++;visited.add(snapshotKey(snapshot));el("count").textContent=state.count;checkpoint({count:state.count});
        status("已确认选择，等待下一题…");
        }
        if(!state.settings.autoNext){status("本题已填写；自动切题已关闭。");break;}
        if(outcome.withinPage&&!await waitActive(state.settings.dwellSec*1000,generation,true))return;
        if(!outcome.advanced) {
          if(!await waitActive(state.settings.dwellSec*1000,generation,true))return;
          if(finished())return;
          const next=adapter.next(snapshot,state.settings);
          if(!next){status("本页已填写，请手动确认下一步。");break;}
          if(next.url){await checkpoint({armed:true,count:state.count});if(generation!==state.generation)return;state.navigating=true;location.assign(next.url);return;}
        }
        let changed=false;
        for(let i=0;i<75;i++){
          if(!await waitActive(100,generation))return;if(finished())return;
          try{if(snapshotKey(adapter.read(state.settings))!==snapshotKey(snapshot)){changed=true;break;}}catch(error){if(error.code!=="QUESTION_NOT_READY")throw error;}
        }
        el("countdown").textContent="—";
        if(!changed){status("未等到新题目，已停止，请核对页面。");break;}
      }
    }catch(error){if(generation===state.generation){state.answer=null;el("apply").disabled=true;el("answer").textContent="—";el("reason").textContent=error.message;status(error.message,true);}}
    finally{if(generation===state.generation&&!state.navigating){state.running=false;state.paused=false;controls();checkpoint({armed:false,paused:false,count:state.count});el("countdown").textContent="—";if(state.answer)el("result").scrollIntoView({block:"nearest"});}}
  }
  el("start").addEventListener("click",()=>start());
  el("stop").addEventListener("click",()=>stop());
  el("pause").addEventListener("click",()=>{state.paused=!state.paused;controls();checkpoint({paused:state.paused});status(state.paused?"已暂停，剩余时间保留；不会继续点击。":"已继续运行。");});
  async function applyCurrent(){
    if(!state.answer||!state.snapshot||el("apply").disabled)throw Error("当前没有可填写的结果。");
    const generation=state.generation;el("apply").disabled=true;
    try{await adapter.apply(state.snapshot,state.answer,state.settings,()=>generation===state.generation&&!state.paused);if(generation!==state.generation)return;state.count++;el("count").textContent=state.count;state.answer=null;checkpoint({count:state.count});if(!finished())status("已填写并核对本题，可进入下一题后再次识别。");}
    catch(error){if(generation===state.generation)status(error.message,true);throw error;}
  }
  el("apply").addEventListener("click",()=>applyCurrent().catch(()=>{}));
  async function persist(rethrow=false){
    if(state.running)return;
    state.settings={...state.settings,personalityPreset:el("personalityPreset").value,personalityStrategy:el("personalityStrategy").value,dwellSec:Number(el("dwell").value)};
    updateSetup();try{await send({type:"savePanel",settings:state.settings});}catch(error){status(error.message,true);if(rethrow===true)throw error;}
  }
  for(const id of ["personalityPreset","personalityStrategy","dwell"])el(id).addEventListener("change",persist);
  shadow.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{state.settings.mode=button.dataset.mode;persist();}));
  el("options").addEventListener("click",()=>send({type:"openOptions",section:"personality"}).catch(error=>status(error.message,true)));
  el("hide").addEventListener("click",()=>hidePanel());
  el("collapse").addEventListener("click",()=>toggle());el("launcher").addEventListener("click",()=>toggle(true));
  el("close").addEventListener("click",()=>{stop();state.hidden=true;renderVisibility();checkpoint({enabled:false,armed:false,hidden:true});});
  function desktopSnapshot(){
    return {status:el("status").textContent,running:state.running,paused:state.paused,count:state.count,
      countdown:el("countdown").textContent,question:el("question").textContent,questionType:el("questionType").textContent,
      answer:el("answer").textContent,explanation:el("reason").textContent,basis:el("basis").textContent,
      mode:state.settings.mode,dwellSec:Number(el("dwell").value),canApply:Boolean(state.answer)&&!el("apply").disabled};
  }
  async function desktopCommand(message){
    const action=message.action;
    if(action==="attach"){
      state.desktop=true;state.hidden=true;renderVisibility();
      await checkpoint({enabled:true,desktop:true,hidden:true});return;
    }
    if(action==="detach"){
      stop("桌面连接已断开，已停止。");state.desktop=false;state.hidden=true;renderVisibility();
      await checkpoint({desktop:false,hidden:true,armed:false,paused:false});return;
    }
    if(!state.desktop)throw Error("当前页面未连接桌面窗口。");
    if(action==="start"){if(!state.running)start();return;}
    if(action==="pause"||action==="resume"){
      if(!state.running)throw Error("当前没有正在运行的任务。");
      const paused=action==="pause";
      if(state.paused!==paused){state.paused=paused;controls();await checkpoint({paused});status(paused?"已暂停，剩余时间保留；不会继续点击。":"已继续运行。");}
      return;
    }
    if(action==="stop"){stop();return;}
    if(action==="apply"){await applyCurrent();return;}
    if(action==="configure"){
      if(state.running)throw Error("请先停止，再修改运行设置。");
      const value=AssessmentDesktopSettings.validate(message.payload,{partial:true});
      const next=A.settings({...state.settings,...value,
        selectors:{...state.settings.selectors,...(value.selectors||{})},
        personalityTraits:{...state.settings.personalityTraits,...(value.personalityTraits||{})}});
      P.config(next);
      for(const selector of Object.values(next.selectors))if(selector){try{document.querySelector(selector);}catch{throw Error('页面选择器格式无效，请检查页面适配。');}}
      const saved=await send({type:'savePanel',settings:next});
      state.settings=A.settings(saved.settings);el('dwell').value=String(state.settings.dwellSec);
      el('personalityPreset').value=state.settings.personalityPreset;el('personalityStrategy').value=state.settings.personalityStrategy;updateSetup();
      state.answer=null;state.snapshot=null;el('apply').disabled=true;el('result').hidden=true;
      status('设置已保存，重新识别后生效。');return;
    }
    throw Error("未知桌面控制操作。");
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(!["toggle-panel","show-panel","ping-panel","hide-panel","toggle-visibility","stop-run","set-launcher","desktop-command"].includes(message.type))return;
    ready.then(async()=>{
      if(message.type==="desktop-command")await desktopCommand(message);
      if(message.type==="toggle-panel")await toggle();if(message.type==="show-panel")await toggle(true);if(message.type==="stop-run")stop();
      if(message.type==="hide-panel")await hidePanel();
      if(message.type==="toggle-visibility")throw Error('网页浮窗已移除，请在桌面窗口操作。');
      if(message.type==="set-launcher"){state.settings.showLauncher=Boolean(message.visible);renderVisibility();}
      reply({ok:true,hidden:true,visible:false,desktop:state.desktop,controllerVersion});
    }).catch(error=>reply({ok:false,error:error.message}));
    return true;
  });
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&state.running)stop();});
  const observer=new MutationObserver(()=>{if(!chrome.runtime?.id){observer.disconnect();return;}if(!state.running)finished();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("pagehide",()=>{state.generation++;state.running=false;send({type:"cancel"}).catch(()=>{});});
  window.addEventListener("pageshow",async event=>{
    if(!event.persisted)return;
    host.style.display="none";
    const generation=++state.generation;state.running=false;state.paused=false;controls();
    try{const response=await send({type:"panelSession"});if(generation!==state.generation)return;const saved=response.panel||{};
      state.hidden=saved.enabled===false||Boolean(saved.hidden);state.collapsed=Boolean(saved.collapsed);state.desktop=Boolean(saved.desktop);renderVisibility();
      if(saved.enabled===false)return;state.count=saved.count||0;el("count").textContent=state.count;
      if(state.desktop&&!(await send({type:"desktopPing"})).connected){await desktopCommand({action:"detach"});return;}
      if(saved.armed)start(true,Boolean(saved.paused));else if(!finished())status("面板已就绪，可重新识别性格题。");
    }catch(error){if(generation===state.generation)status(error.message,true);}
  });
  const header=shadow.querySelector(".top");let drag;
  header.addEventListener("pointerdown",event=>{if(event.target.closest("button"))return;const r=host.getBoundingClientRect();drag={x:event.clientX-r.x,y:event.clientY-r.y};header.setPointerCapture(event.pointerId);});
  header.addEventListener("pointermove",event=>{if(!drag)return;host.style.right="auto";host.style.left=Math.max(8,Math.min(innerWidth-350,event.clientX-drag.x))+"px";const top=Math.max(8,Math.min(innerHeight-220,event.clientY-drag.y));host.style.top=top+"px";panel.style.maxHeight="calc(100dvh - "+(top+16)+"px)";});
  header.addEventListener("pointerup",()=>{drag=null;});
  const ready=Promise.all([send({type:"settings"}),send({type:"panelSession"})]).then(async([data,session])=>{
    state.settings=A.settings(data.settings);el("personalityPreset").value=state.settings.personalityPreset;el("personalityStrategy").value=state.settings.personalityStrategy;el("dwell").value=state.settings.dwellSec;updateSetup();
    const saved=session.panel||{};state.count=saved.count||0;el("count").textContent=state.count;state.collapsed=Boolean(saved.collapsed);state.hidden=Boolean(saved.hidden);state.desktop=Boolean(saved.desktop);renderVisibility();
    status("面板已就绪 · 纯离线性格测评。");checkpoint({enabled:true});
    if(state.desktop&&!(await send({type:"desktopPing"})).connected){await desktopCommand({action:"detach"});return;}
    if(saved.armed)start(true,Boolean(saved.paused));
  }).catch(error=>{renderVisibility();status(error.message,true);throw error;});
  ready.catch(()=>{});
  let desktopPending=false;
  const desktopTimer=typeof setInterval==="function"?setInterval(async()=>{
    if(!state.desktop||desktopPending||state.navigating)return;
    desktopPending=true;
    try{
      const response=await send({type:"desktopPulse",snapshot:desktopSnapshot()});
      if(!response.connected&&state.desktop)await desktopCommand({action:"detach"});
    }catch{if(state.desktop)await desktopCommand({action:"detach"});}
    finally{desktopPending=false;}
  },700):null;
  window.addEventListener("unload",()=>{if(desktopTimer!==null)clearInterval(desktopTimer);});
  globalThis.__assessmentDesktopControllerVersion=controllerVersion;
})();
