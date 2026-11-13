importScripts("shared.js", "personality-data.js", "personality-open-data.js", "personality.js", "desktop-settings.js", "desktop-bridge.js");
const A = globalThis.Assessment, P = globalThis.AssessmentPersonality;
const panelLoads = new Map(), panelWrites = new Map();
const fields = ["mode", "dwellSec", "speed", "autoNext", "showLauncher", "selectors", "personalityPreset", "personalityStrategy", "personalityTraits", "personalityRanking", "personalityAnswers"];
const panelKey = id => "assessmentPanel:" + id;
const desktopBridge=AssessmentDesktopBridge.createDesktopBridge({
  storage:chrome.storage.session,getTab:id=>chrome.tabs.get(id),getURL:path=>chrome.runtime.getURL(path),
  openPanel:(id,reveal)=>openPanel(id,reveal),writePanel:(id,value)=>writePanel(id,value),
  sendTab:(id,message)=>chrome.tabs.sendMessage(id,message,{frameId:0}),fetch:(...args)=>fetch(...args),
  newClientId:()=>crypto.randomUUID(),getSettings:()=>getSettings()
});
async function getSettings() {
  const s = A.settings(await chrome.storage.local.get(fields));
  return { ...Object.fromEntries(fields.map(key => [key, s[key]])), taskMode: "personality", bankSource: "bundled" };
}
async function readPanel(tabId) {
  if (!Number.isInteger(tabId)) return {};
  await panelWrites.get(tabId);
  const saved = (await chrome.storage.session.get(panelKey(tabId)))[panelKey(tabId)];
  if (saved) return saved;
  const tab = await chrome.tabs.get(tabId);
  if (Number.isInteger(tab.openerTabId)) {
    const parent = (await chrome.storage.session.get(panelKey(tab.openerTabId)))[panelKey(tab.openerTabId)];
    if (parent?.enabled) return { enabled: true, armed: false, count: 0 };
  }
  return {};
}
function writePanel(tabId, value) {
  if (!Number.isInteger(tabId)) return Promise.resolve({});
  const prior = panelWrites.get(tabId) || Promise.resolve();
  const pending = prior.catch(() => {}).then(async () => {
    const key = panelKey(tabId), state = { ...((await chrome.storage.session.get(key))[key] || {}) };
    for (const name of ["enabled", "armed", "paused", "collapsed", "hidden", "desktop"]) if (typeof value[name] === "boolean") state[name] = value[name];
    if (Number.isInteger(value.count) && value.count >= 0) state.count = value.count;
    await chrome.storage.session.set({ [key]: state }); return state;
  });
  panelWrites.set(tabId, pending);
  pending.finally(() => { if (panelWrites.get(tabId) === pending) panelWrites.delete(tabId); }).catch(() => {});
  return pending;
}
function openPanel(tabId) {
  if (panelLoads.has(tabId)) return panelLoads.get(tabId);
  const pending = (async () => {
    const tab = await chrome.tabs.get(tabId), url = new URL(tab.url || "about:blank");
    const own = ["practice.html", "personality-practice.html"].some(path => url.href.split(/[?#]/)[0] === chrome.runtime.getURL(path));
    if (!own && !["http:", "https:"].includes(url.protocol)) throw Error("请先打开普通网页；浏览器设置页不能加载面板。");
    const message = { type: "ping-panel" };
    try { const reply=await chrome.tabs.sendMessage(tabId,message,{frameId:0});if(reply?.ok&&reply.controllerVersion===chrome.runtime.getManifest().version)return {opened:true}; } catch {}
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => document.getElementById("assessment-assistant")?.remove() });
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["shared.js", "personality-data.js", "personality-open-data.js", "personality.js", "desktop-settings.js", "personality-shl-adapter.js", "personality-disc-adapter.js", "personality-matrix-adapter.js", "pair-adapter.js", "adapter.js", "content.js"] });
    if (!(await chrome.tabs.sendMessage(tabId, message, { frameId: 0 }))?.ok) throw Error("面板未响应，请刷新网页后重试。");
    return { opened: true };
  })();
  panelLoads.set(tabId, pending);
  pending.finally(() => { if (panelLoads.get(tabId) === pending) panelLoads.delete(tabId); }).catch(() => {});
  return pending;
}
let bankPromise;
async function loadBank() {
  if (!bankPromise) bankPromise = Promise.all(["questions.json", "personality-open.json"].map(async file => {
    const response = await fetch(chrome.runtime.getURL("question-bank/" + file));
    if (!response.ok) throw Error("性格题库文件读取失败，请重新加载插件。");
    return A.validateBank(await response.json());
  })).then(parts => A.validateBank({ site: "personality-practice", source: { name: "本地性格练习与中文IPIP" }, questions: parts.flatMap(part => part.questions).filter(q => A.isPersonality(q)) })).catch(error => { bankPromise = null; throw error; });
  return bankPromise;
}
async function saveSettings(input) {
  const current = await getSettings(), next = { ...current };
  for (const field of fields) if (Object.hasOwn(input, field)) next[field] = input[field];
  next.mode = next.mode === "auto" ? "auto" : "manual";
  next.dwellSec = Number(next.dwellSec);
  if (!Number.isInteger(next.dwellSec) || next.dwellSec < 1 || next.dwellSec > 120) throw Error("停留时间须为1–120秒整数。");
  if (!P.presets[next.personalityPreset]) throw Error("性格预设无效。");
  P.config(next);
  next.taskMode = "personality"; next.bankSource = "bundled";
  await chrome.storage.local.set(next); return next;
}
async function handle(message, sender) {
  const tabId = sender.tab?.id ?? message.tabId;
  const ownPractice=["practice.html","personality-practice.html"].some(path=>sender.url?.split(/[?#]/)[0]===chrome.runtime.getURL(path));
  const desktopTabId=Number.isInteger(sender.tab?.id)?sender.tab.id:ownPractice&&Number.isInteger(message.tabId)?message.tabId:null;
  if (message.type === "desktopConnect") return desktopBridge.connect(message.pairCode,tabId);
  if (message.type === "desktopStatus") return desktopBridge.status();
  if (message.type === "desktopDisconnect") return desktopBridge.disconnect();
  if (message.type === "desktopPulse") return desktopTabId!==null?desktopBridge.pulse(desktopTabId,message.snapshot):{connected:false};
  if (message.type === "desktopPing") return desktopTabId!==null?desktopBridge.ping(desktopTabId):{connected:false};
  if (message.type === "openPanel") {
    throw Error('网页浮窗已移除，请在桌面窗口操作。');
  }
  if (message.type === "panelVisibility") return {supported:false,enabled:false,hidden:true,desktopOnly:true};
  if (message.type === "hidePanel") throw Error('网页浮窗已移除，请在桌面窗口操作。');
  if (message.type === "panelSession") return { panel: message.state ? await writePanel(tabId, message.state) : await readPanel(tabId) };
  if (message.type === "restorePanel") {
    const panel = await readPanel(tabId);
    if (panel.desktop) await openPanel(tabId, false);
    return { panel };
  }
  if (message.type === "settings") return { settings: await getSettings(), configured: true, offline: true, ruleCount: globalThis.AssessmentPersonalityData.length };
  if (message.type === "savePanel" || message.type === "saveSettings") return { settings: await saveSettings(message.settings || {}) };
  if (message.type === "loadBank") { const payload = await loadBank(); return { payload, stats: A.bankStats(payload) }; }
  if (message.type === "solve") {
    const q = message.question, reason = P.supportReason(q);
    if (reason) throw Error(reason);
    const settings = await getSettings();
    for (const key of ["personalityPreset", "personalityStrategy", "personalityTraits", "personalityRanking", "personalityAnswers"]) if (Object.hasOwn(message.personalitySettings || {}, key)) settings[key] = message.personalitySettings[key];
    const answer = P.solve(q, settings);
    return { answer, diagnostics: { offline: true, stage: "complete", model: "本地性格规则", endpoint: "本机计算", message: "离线结果已就绪" } };
  }
  if (message.type === "cancel") return {};
  if (message.type === "openOptions") throw Error('配置已移到桌面窗口的偏好设置与页面适配。');
  throw Error("当前版本仅支持离线性格测评，此功能已移除。");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handle(message || {}, sender).then(result => reply({ ok: true, ...result }), error => reply({ ok: false, error: error.message })); return true;
});
chrome.runtime.onInstalled.addListener(async()=>{
  await chrome.storage.local.set({taskMode:'personality',bankSource:'bundled'});
  const tabs=await chrome.tabs.query({url:['http://*/*','https://*/*']});
  await Promise.allSettled(tabs.filter(tab=>Number.isInteger(tab.id)).map(tab=>chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:()=>document.getElementById('assessment-assistant')?.remove()})));
});
chrome.tabs.onRemoved.addListener(tabId => {
  readPanel(tabId).then(panel=>panel.desktop?desktopBridge.disconnect():null).catch(()=>{});
  (panelWrites.get(tabId) || Promise.resolve()).catch(() => {}).then(() => chrome.storage.session.remove(panelKey(tabId)));
});
chrome.commands.onCommand.addListener(async command => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) return;
  try {
    if (command === "stop-run") await chrome.tabs.sendMessage(tab.id, { type: "stop-run" });
  } catch {}
});
