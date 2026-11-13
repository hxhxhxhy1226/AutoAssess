(function (root) {
  "use strict";
  const defaults = Object.freeze({
    mode: "manual", dwellSec: 5, speed: "normal",
    taskMode: "personality", personalityStrategy: "positive", personalityPreset: "outgoing_engineer", personalityTraits: {}, personalityRanking: "", personalityAnswers: "",
    bankSource: "bundled", autoNext: true, showLauncher: true,
    selectors: { question: "", stem: "", option: "", next: "", pairItem: "", pairMost: "", pairLeast: "" }
  });
  const types = { likert: "性格量表", single_choice: "描述单选", forced_choice: "迫选题", P_LIKERT: "性格量表", P_FORCED_PAIR: "配对迫选", P_FORCED: "迫选题" };
  const normalize = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  types.forced_pair = "双角色迫选 · 最符合／最不符合";
  function settings(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) value = {};
    // Only active preferences enter the page. Obsolete settings remain in storage
    // without restoring retired features or exposing unrelated stored values.
    const s = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, Object.hasOwn(value, key) ? value[key] : fallback]));
    for (const [key, fallback] of Object.entries(defaults)) {
      if (typeof fallback !== "object" && (typeof s[key] !== typeof fallback || (typeof fallback === "number" && !Number.isFinite(s[key])))) s[key] = fallback;
    }
    s.selectors = Object.fromEntries(Object.entries(defaults.selectors).map(([key, fallback]) => [key, typeof value.selectors?.[key] === "string" ? value.selectors[key] : fallback]));
    s.personalityTraits = s.personalityTraits && typeof s.personalityTraits === "object" && !Array.isArray(s.personalityTraits) ? { ...s.personalityTraits } : {};
    if (!["manual", "auto"].includes(s.mode)) s.mode = "manual";
    s.taskMode = "personality";
    s.bankSource = "bundled";
    if (!["positive", "balanced", "random", "strict"].includes(s.personalityStrategy)) s.personalityStrategy = "positive";
    return s;
  }
  const isPersonality = q => ["likert", "forced_choice", "forced_pair", "P_LIKERT", "P_FORCED_PAIR", "P_FORCED"].includes(q.type || q.expected_type);
  function mediaPath(value) { return typeof value === "string" && /^assets\/(?:[\w-]+\/)*[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(value) && !value.includes(".."); }
  // `stimulus` is the compatibility alias of the first entry, not another image.
  // Keep the order (and intentional repetitions) inside the canonical array.
  function stemMedia(question) {
    return Array.isArray(question?.stimuli) ? question.stimuli : question?.stimulus ? [question.stimulus] : [];
  }
  const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
  const allMedia = question => [...stemMedia(question), ...(question.options || []).flatMap(option => option.media ? [option.media] : [])];
  const mediaDescription = media => JSON.stringify([media?.kind, media?.src, media?.alt, media?.sourceUrl || "", media?.sha256 || ""]);
  function validAnswerKeys(question) {
    const keys = question.answer?.keys;
    return Array.isArray(keys) && keys.length > 0 && keys.every(key => typeof key === "string" && question.options.some(option => option.key === key))
      && new Set(keys).size === keys.length && (question.type === "multi_choice" || keys.length === 1);
  }
  function validateBank(payload) {
    if (!payload || !Array.isArray(payload.questions) || !payload.questions.length) throw Error("题库必须包含非空 questions 数组");
    const ids = new Set();
    for (const [i, q] of payload.questions.entries()) {
      if (!q || typeof q.qid !== "string" || !/^[\w-]{1,120}$/.test(q.qid) || ids.has(q.qid)) throw Error(`第 ${i + 1} 题的 qid 无效或重复`);
      ids.add(q.qid);
      if (typeof q.stem !== "string" || !Array.isArray(q.options)) throw Error(`${q.qid} 缺少题干或选项`);
      if (q.stimuli !== undefined && !Array.isArray(q.stimuli)) throw Error(`${q.qid} 的 stimuli 必须是图片数组`);
      if (q.stimulus && Array.isArray(q.stimuli) && (!q.stimuli.length || mediaDescription(q.stimulus) !== mediaDescription(q.stimuli[0]))) throw Error(`${q.qid} 的 stimulus 必须与 stimuli 首图一致`);
      const keys = new Set();
      for (const o of q.options) {
        if (!o || typeof o.key !== "string" || !o.key || keys.has(o.key)) throw Error(`${q.qid} 的选项标识无效或重复`);
        keys.add(o.key);
      }
      for (const m of allMedia(q)) {
        if (m.kind !== "image" || !mediaPath(m.src) || typeof m.alt !== "string" || !m.alt) throw Error(`${q.qid} 图片路径或说明无效`);
        // Historical synthetic records used this provenance placeholder. Keep
        // them readable, but sha256() never accepts it as matching evidence.
        const legacyPlaceholder = !q.bankId && m.sha256 === "synthetic-self-made";
        if (m.sha256 !== undefined && !sha256(m.sha256) && !legacyPlaceholder) throw Error(`${q.qid} 图片 SHA-256 无效`);
        if (m.sourceUrl !== undefined) {
          let url;
          try { url = new URL(m.sourceUrl); } catch { throw Error(`${q.qid} 图片来源地址无效`); }
          if (typeof m.sourceUrl !== "string" || !["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error(`${q.qid} 图片来源地址无效`);
        }
      }
      if (q.answer !== undefined) {
        if (!q.answer || typeof q.answer !== "object" || Array.isArray(q.answer)) throw Error(`${q.qid} 答案格式无效`);
        const reference = q.answer.kind === "reference";
        if (reference && (q.answer.verified !== false || typeof q.answer.usable !== "boolean")) throw Error(`${q.qid} 来源参考答案必须明确 verified:false 和 usable`);
        const unusableReference = reference && q.answer.usable === false && q.quality?.usable === false;
        if (!unusableReference && !validAnswerKeys(q)) throw Error(`${q.qid} 答案标识缺失、重复或不属于本题选项`);
        if (reference && q.answer.usable && (q.quality?.usable === false || !normalize(q.stem) || q.options.length < 2)) throw Error(`${q.qid} 不完整的来源题目不能标记答案可用`);
      }
    }
    return payload;
  }
  function bankStats(payload) {
    const stats = { total: payload.questions.length, types: {}, images: 0, duplicates: 0, collections: {}, categories: {} };
    const seen = new Set();
    for (const q of payload.questions) {
      const type = q.type || q.expected_type || "unknown";
      stats.types[type] = (stats.types[type] || 0) + 1;
      stats.images += Number(Boolean(stemMedia(q).length || q.options.some(o => o.media || o.is_image)));
      const collection = q.bankId || "original";
      stats.collections[collection] = (stats.collections[collection] || 0) + 1;
      const category = q.category || (isPersonality(q) ? "personality" : "other");
      stats.categories[category] = (stats.categories[category] || 0) + 1;
      const mediaSignature = media => media ? sha256(media.sha256) || media.src : null;
      const signature = JSON.stringify([normalize(q.stem), stemMedia(q).map(mediaSignature), q.options.map(o => JSON.stringify([normalize(o.text), mediaSignature(o.media)])).sort()]);
      if (seen.has(signature)) stats.duplicates++;
      seen.add(signature);
    }
    return stats;
  }
  function fingerprint(q) { return JSON.stringify([q.qid || "", normalize(q.stem), q.options.map(o => [o.key, normalize(o.text), o.images || []]), q.images || [], q.type || "", normalize(q.personalityContext), normalize(q.personalitySurveyTitle)]); }
  function validateOptions(question) {
    if (!Array.isArray(question?.options) || question.options.length < 2 || question.options.length > 30) throw Error("题目需要 2–30 个可识别选项，请检查页面适配");
    if (question.options.some(o => typeof o?.key !== "string" || !o.key.trim()) || new Set(question.options.map(o => o.key)).size !== question.options.length) throw Error("选项标识缺失或重复，无法唯一定位，请检查页面适配；未填写");
  }
  function parseAnswer(raw, question, allowOffline = false) {
    validateOptions(question);
    let data = raw;
    if (typeof raw === "string") {
      const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      try { data = JSON.parse(clean); } catch { throw Error("答题结果不是有效 JSON，未填写；请重新识别"); }
    }
    if (!data || !Array.isArray(data.keys) || !data.keys.length || !data.keys.every(k => typeof k === "string")) throw Error("答题结果没有可用选项，等待人工确认");
    if (new Set(data.keys).size !== data.keys.length || data.keys.some(k => !question.options.some(o => o.key === k))) throw Error("答题结果包含不存在或重复的选项，未填写");
    const pair = question.type === "forced_pair", offline = allowOffline && data.offline === true && data.source === "离线性格";
    if (pair && (data.keys.length !== 2 || typeof data.mostKey !== 'string' || typeof data.leastKey !== 'string' || data.mostKey === data.leastKey || !data.keys.includes(data.mostKey) || !data.keys.includes(data.leastKey))) throw Error("双角色迫选必须分别指定不同的最符合和最不符合选项，未填写");
    if (!pair && question.type !== "multi_choice" && data.keys.length !== 1) throw Error("单选题返回多个选项，未填写");
    if (!offline && (typeof data.confidence !== "number" || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1)) throw Error("结果未通过离线标记或置信度校验，未填写");
    const method = ["exact","strategy"].includes(data.method) ? data.method : "exact";
    const strategy = ["positive","balanced","random","strict"].includes(data.strategy) ? data.strategy : "positive";
    const strategyBasis = ["traits","scale","random","tie","unrecognized"].includes(data.strategyBasis) ? data.strategyBasis : undefined;
    return { keys: data.keys, ...(pair ? { mostKey: data.mostKey, leastKey: data.leastKey } : {}), ...(offline ? { offline: true, method, strategy, ...(strategyBasis ? { strategyBasis } : {}) } : {}), confidence: offline ? null : data.confidence, explanation: String(data.explanation || "").slice(0, 6000), source: offline ? "离线性格" : data.source || "未标注来源" };
  }
  root.Assessment = { defaults, settings, types, normalize, isPersonality, mediaPath, stemMedia, validateBank, bankStats, fingerprint, validateOptions, parseAnswer };
  root.Assessment.answerLabel = answer => answer?.mostKey ? `最符合 ${answer.mostKey}；最不符合 ${answer.leastKey}` : answer?.keys.join('、') || '—';
  root.Assessment.offlineBasisLabel = answer => ({traits:'词组与偏好',scale:'量表策略',random:'随机选择',tie:'同分随机',unrecognized:'未识别，随机选择'})[answer?.strategyBasis] || (answer?.method==='strategy' ? '策略推选' : '精确规则匹配');
  if (typeof module !== "undefined") module.exports = root.Assessment;
})(globalThis);
