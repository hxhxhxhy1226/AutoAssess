const practice = { questions: [], index: 0, responses: {} };
try { practice.responses = JSON.parse(sessionStorage.getItem("practiceResponses") || "{}"); } catch {}
if (!practice.responses || typeof practice.responses !== "object" || Array.isArray(practice.responses)) practice.responses = {};
const pEl = id => document.getElementById(id);
function saveResponses() { sessionStorage.setItem("practiceResponses", JSON.stringify(practice.responses)); }
function renderPractice() {
  const q = practice.questions[practice.index], area = pEl("questionArea");
  area.replaceChildren(); area.dataset.qid = q.qid; area.dataset.type = q.type || "single_choice"; area.dataset.bankId = q.bankId || "";
  const heading = document.createElement("h2"); heading.textContent = q.title || q.qid;
  const meta = document.createElement("p"); meta.className = "hint"; meta.textContent = Assessment.types[q.type || q.expected_type] || "性格自评";
  const stem = document.createElement("div"); stem.dataset.role = "stem"; stem.className = "stem"; stem.textContent = q.stem;
  area.append(meta, heading, stem);
  const selected = practice.responses[q.qid] || [];
  for (const o of q.options) {
    const item = document.createElement("button"); item.type = "button"; item.dataset.role = "option"; item.dataset.key = o.key; item.className = "practice-option"; item.classList.toggle("selected", Array.isArray(selected) && selected.includes(o.key)); item.setAttribute("aria-selected", String(Array.isArray(selected) && selected.includes(o.key)));
    const key = document.createElement("b"); key.textContent = o.key; key.setAttribute("aria-hidden", "true");
    const text = document.createElement("span"); text.textContent = o.text; item.append(key, text);
    item.addEventListener("click", () => {
      practice.responses[q.qid] = [o.key];
      saveResponses(); area.querySelectorAll('[data-role="option"]').forEach(n => { const active = practice.responses[q.qid].includes(n.dataset.key); n.classList.toggle("selected", active); n.setAttribute("aria-selected", String(active)); });
    }); area.appendChild(item);
  }
  pEl("progress").textContent = `第 ${practice.index + 1} / ${practice.questions.length} 题 · ${q.qid}`; pEl("jump").value = String(practice.index);
  pEl("prev").disabled = practice.index === 0; pEl("next").disabled = practice.index === practice.questions.length - 1;
  history.replaceState(null, "", "?qid=" + encodeURIComponent(q.qid));
}
pEl("prev").addEventListener("click", () => { if (practice.index > 0) { practice.index--; renderPractice(); } });
pEl("next").addEventListener("click", () => { if (practice.index < practice.questions.length - 1) { practice.index++; renderPractice(); } });
pEl("jump").addEventListener("change", () => { practice.index = Number(pEl("jump").value); renderPractice(); });
(async () => {
  const r = await chrome.runtime.sendMessage({ type: "loadBank" });
  if (!r.ok) throw Error(r.error);
  const questions = r.payload.questions;
  if (!questions.length || questions.some(q => !["likert","forced_choice","P_LIKERT","P_FORCED"].includes(q.type || q.expected_type)
    || !AssessmentPersonality.isSupportedPersonality(q))) throw Error("题库包含未支持的题目；本页仅提供文字性格单选练习。");
  practice.questions = questions;
  const requested = new URLSearchParams(location.search).get("qid");
  practice.index = Math.max(0, practice.questions.findIndex(q => q.qid === requested));
  practice.questions.forEach((q, i) => pEl("jump").add(new Option(`${i + 1}. ${q.title || q.qid}`, String(i))));
  renderPractice();
})().catch(e => {
  let error = pEl("error");
  if (!error) { error = document.createElement("p"); error.id = "error"; error.setAttribute("role","status"); pEl("questionArea").append(error); }
  error.textContent = e.message;
});
