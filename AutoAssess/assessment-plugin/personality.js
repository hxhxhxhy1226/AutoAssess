// Offline preference rules inspired by the two projects credited in THIRD_PARTY_NOTICES.md.
(function (root) {
  'use strict';
  const A = root.Assessment;
  const normalize = text => A.normalize(text).replace(/[。.!！?？;；,，、:：\s]/g, '').toLowerCase();
  const dimensions = { E: '外向沟通', A: '合作体谅', C: '条理尽责', S: '情绪稳定', O: '开放探索' };
  const strategies = {
    positive: { name: '积极策略', description: '优先按描述词组与所选性格偏好比较；识别不足时随机继续，并显示依据。选项位置不参与评分。' },
    balanced: { name: '平衡策略', description: '按适度收敛的性格倾向比较描述，量表优先中间等级；识别不足时随机继续。' },
    random: { name: '随机策略', description: '未精确匹配时随机选择；三选二抽取两个不同选项。同一道题保持选择，调换选项顺序不改变所选内容。' },
    strict: { name: '严格匹配', description: '仅使用已有答案或完整排序；未匹配或并列时停止，等待补充规则。' }
  };
  const presets = {
    outgoing_engineer: { name: '沟通外向 · 嵌入式工程师', traits: { E: 4, A: 4, C: 5, S: 4, O: 4 } },
    careful: { name: '沉稳严谨', traits: { E: 2, A: 4, C: 5, S: 4, O: 3 } },
    balanced: { name: '均衡协作', traits: { E: 3, A: 4, C: 4, S: 3, O: 3 } },
    custom: { name: '自定义偏好', traits: { E: 4, A: 4, C: 5, S: 4, O: 4 } }
  };
  // Aliases are exact phrases, never substring/keyword matches.
  const groups = [
    ['C',true,'认真负责的|认真负责|负责任的|负责任|有责任心的|有责任心|我更在意把事情做完'],
    ['E',true,'善于沟通的|善于沟通|善于沟通协作的|沟通主动的|我享受与人交流和分享新的想法与观点'],
    ['A',true,'善于合作的|善于合作|合作的|团队合作的|团队合作|我偏好团队协作而非独立工作|相比于独立工作，我更喜欢与人协作'],
    ['C',true,'有计划性的|有计划性|有计划的|有计划|先规划学习任务|我喜欢按流程办事|我认为有规划和有序的工作环境对我更有帮助'],
    ['S',true,'乐观的|乐观|乐观积极的|乐观积极|积极乐观的|我能很快从挫折中恢复'],
    ['C',true,'细致的|细致|细心的|细心|严谨的|严谨|严谨细致的|课后总结知识点'],
    ['A',true,'善解人意的|善解人意|体谅他人的|体贴的|有同理心的|我在帮助他人解决问题时感到满足'],
    ['E',true,'外向的|外向|开朗的|开朗|外向开朗的|外向开朗|遇到困难主动请教|主动社交'],
    ['S',true,'冷静的|冷静|沉着的|沉着|沉着冷静的|从容的|从容'],
    ['O',true,'好学的|好学|勤于学习的|我习惯持续精进自己的技能与知识|新知识能强烈吸引我'],
    ['C',true,'有条理的|有条理|条理清晰的|自律的|自律|坚持不懈的|坚持不懈'],
    ['E',true,'主动的|主动|积极主动的|积极主动|善于表达的|善于表达|健谈的|健谈'],
    ['A',true,'友善的|友善|友好的|友好|愿意倾听的|愿意倾听|乐于助人的|乐于助人'],
    ['O',true,'好奇的|好奇|有好奇心的|有好奇心|富有创造力的|创新的|我对科学和技术领域有着浓厚的兴趣'],
    ['C',true,'可靠的|可靠|踏实的|踏实|勤奋的|勤奋|有毅力的|有毅力'],
    ['E',true,'有领导意愿的|有领导意愿|有领导力的|果断的|果断|在团队中我愿意主动牵头与决策'],
    ['O',true,'开放的|开放|灵活的|灵活|我喜欢打破常规|我喜欢挑战舒适区之外的新任务'],
    ['A',true,'谦虚的|谦虚|包容的|包容|有耐心的|有耐心|在团队中我更愿意配合执行'],
    ['S',true,'情绪稳定的|情绪稳定|镇定的|镇定|坚韧的|坚韧'],
    ['E',false,'内向的|内向|安静的|安静|独立思考|我偏好独立工作而非团队工作'],
    ['O',false,'保守的|保守|我更偏好熟悉稳妥的事|我满足于现状'],
    ['A',false,'固执的|固执|强硬的|强硬'],
    ['C',false,'随意的|随意|粗心的|粗心|缺乏条理的|缺乏条理|拖延的|拖延'],
    ['S',false,'焦虑的|焦虑|急躁的|急躁|容易紧张的|容易紧张|我容易被他人的情绪影响'],
    ['E',false,'退缩的|退缩|我很少比别人更强']
  ];
  const scaleGroups = [
    ['agreement',0,'非常不符合|很不符合|完全不符合|非常不同意|完全不同意|很不同意|完全不像我|非常不像我|strongly disagree'],
    ['agreement',1,'不符合|不同意|不像我|disagree'],
    ['agreement',2,'比较不符合|较不符合|不太符合|有点不符合|比较不同意|较不同意|有些不同意|有点不同意|不太同意|不太像我|somewhat disagree|slightly disagree'],
    ['agreement',3,'一般符合|一般|不确定|中立|既不同意也不反对|既不同意也不否认|说不清|不置可否|neutral|neither agree nor disagree'],
    ['agreement',4,'比较符合|较符合|有点符合|基本符合|比较同意|有些同意|有点同意|较同意|比较像我|somewhat agree|slightly agree'],
    ['agreement',5,'符合|同意|像我|agree'],
    ['agreement',6,'非常符合|很符合|完全符合|非常同意|完全同意|很同意|非常像我|完全像我|strongly agree'],
    ['frequency',0,'从不|从来不|从未|never'],
    ['frequency',.5,'几乎从不|几乎不|almost never'],
    ['frequency',1,'极少|很少|很少如此|rarely'],
    ['frequency',2,'偶尔|偶然|seldom'],
    ['frequency',3,'有时|时而|有时候|sometimes'],
    ['frequency',4,'经常|时常|often'],
    ['frequency',5,'通常|大多数时候|usually'],
    ['frequency',5.5,'几乎总是|almost always'],
    ['frequency',6,'总是|始终|每次|always'],
    ['binary',0,'否|不是|不是的|不对|no|false'],
    ['binary',1,'是|是的|对|yes|true']
  ];
  const scale = new Map(scaleGroups.flatMap(([family, rank, words]) => words.split('|').map(w => [normalize(w), {family,rank}])));
  function scaleOptions(question) {
    if (!Array.isArray(question?.options) || ![2,3,4,5,6,7].includes(question.options.length)) return null;
    const rows = question.options.map(o => ({...o, scale:scale.get(normalize(o.text))}));
    if (rows.some(o => !o.scale) || new Set(rows.map(o=>o.scale.family)).size !== 1 || new Set(rows.map(o=>o.scale.rank)).size !== rows.length) return null;
    const ranks = rows.map(o=>o.scale.rank).sort((a,b)=>a-b);
    return rows.map(({scale:descriptor,...option})=>({...option, score:ranks.indexOf(descriptor.rank)/(rows.length-1), scaleFamily:descriptor.family}));
  }
  function forcedRole(value) {
    const text = normalize(value);
    if (/^(least|leastlikeme|leastlikemyself|最不符合(?:我|自己|本人)?|最不像(?:我|自己|本人)?|最不贴近(?:我|自己|本人)?)$/.test(text)) return 'least';
    if (/^(most|mostlikeme|mostlikemyself|最符合(?:我|自己|本人)?|最像(?:我|自己|本人)?|最贴近(?:我|自己|本人)?)$/.test(text)) return 'most';
    return '';
  }
  const leastWording = value => /最不符合|最不像|最不贴近|\bleast\b/i.test(String(value || ''));
  const mostWording = value => /最符合|最像|最贴近|更贴近你|更符合你|更像你|\bmost\b/i.test(String(value || ''));
  const selfWording = value => /我(?!国|省|市)|自己|本人|自我|自述|个性|性格|习惯|偏好|倾向|日常|你对[『“「][^』”」]{1,120}[』”」]的?认同程度|你对[^。！？\n]{1,100}认同程度|你(?:的|自己)|您(?:的|自己)|符合你|像你|\b(?:myself|yourself|my|me|personality)\b|describe you|like you|\bI\s+(?:am|feel|prefer|like|enjoy|tend|often|usually|rarely|always|never)\b/i.test(String(value || ''));
  // Preference wording must describe the respondent's own choice. The presence
  // of "我" or an ordinary "请选择" alone is not a self-report instruction.
  const preferenceWording = value => /(?:你|您|自己|本人|我)(?:平时|通常|一般)?更(?:容易)?(?:喜欢|偏好|偏向|倾向|愿意)|(?:更|比较)(?:符合|贴近|接近|像)(?:你|您|我|自己|本人)|(?:which|what)\s+(?:(?:one|word|description|option)\s+)?(?:do|would)\s+you\s+prefer|closer\s+to\s+(?:you|yourself)/i.test(String(value || ''));
  const selfReportInstruction = value => /(?:按|根据|依据|按照)[^。！？\n]{0,20}(?:自己|本人|你的|您的)[^。！？\n]{0,12}(?:实际情况|真实情况|真实想法|日常习惯|行为习惯|性格|偏好)|(?:评价|描述|评估)[^。！？\n]{0,6}(?:自己|你的性格|您的性格)|based\s+on\s+your\s+(?:own\s+)?(?:personality|preferences|habits)|describe\s+(?:yourself|your\s+personality)/i.test(String(value || ''));
  const personalAssertion = value => /(?:我|本人|你|您)(?:是否|是不是|平时|通常|经常|有时|从不|很少|总是|容易|不太|不会|不|非常|比较|很|更)?(?:喜欢|愿意|倾向|偏好|习惯|感到|善于|擅长|乐于|享受|害怕|担心|紧张|焦虑|冷静|外向|内向|乐观|有条理|有计划|粗心|拖延|会按时|能按时|能保持|会坚持|做事)|\bI\s+(?:(?:often|usually|rarely|always|never)\s+)?(?:feel|prefer|like|enjoy|tend|worry|fear)\b|\bdo\s+you\s+(?:(?:often|usually|rarely|always|never)\s+)?(?:feel|prefer|like|enjoy|tend|worry|fear)\b/i.test(String(value || ''));
  const objectiveWording = value => /正确答案|计算(?:结果|下列|题|出)|求(?:值|解)|作者(?:的)?观点|作者认为|文意|根据(?:材料|图表|下表|上表)|资料分析|图形推理|数列|等于多少|共有多少|共有几|下列.{0,20}(?:说法|结论).{0,10}(?:正确|错误)|\d\s*[+*/=]\s*\d/i.test(String(value || ''));
  function supportReason(question) {
    if (!question || !['single_choice','likert','forced_choice','forced_pair','P_LIKERT','P_FORCED'].includes(question.type)) return '当前题型不是已支持的性格自评、量表或双角色迫选题。';
    try { A.validateOptions(question); } catch(error) { return error.message; }
    if (question.images?.length || question.stimulus || question.stimuli?.length || question.options.some(o=>o.images?.length || o.media)) return '图片性格题尚不支持，请手动处理。';
    if (question.options.some(o=>typeof o.text !== 'string' || !normalize(o.text))) return '性格题描述或量表标签不完整。';
    const localContext = [question.stem,question.personalityContext || ''].join(' ');
    const context = [localContext,question.personalitySurveyTitle || ''].join(' ');
    if (!normalize(question.stem) || objectiveWording(context)) return '这是知识/客观问题或缺少自评题干，不能使用性格偏好随机作答。';
    const knownStem = (root.AssessmentPersonalityData || []).some(row=>normalize(row.stem)===normalize(question.stem));
    const self = selfWording(context) || knownStem;
    const descriptive = question.options.filter(o=>selfWording(o.text) || Object.keys(analyzeDescription(o.text).traits).length).length >= 2;
    if (question.type === 'forced_pair') {
      if (question.options.length < 2 || question.options.length > 8) return '双角色迫选只支持 2–8 个文字描述。';
      return self || descriptive ? '' : '双角色迫选缺少明确的主观自我描述说明。';
    }
    const scales = scaleOptions(question);
    if (scales) {
      if (scales[0].scaleFamily === 'binary') return knownStem || personalAssertion(question.stem) || selfReportInstruction(context)
        ? '' : '是／否标签已识别，但缺少明确的性格自述或按本人实际情况作答的说明。';
      return self || Object.keys(analyzeDescription(question.stem).traits).length ? '' : '量表标签已识别，但题干不是明确的主观自我描述。';
    }
    if ((mostWording(localContext) || leastWording(localContext) || question.personalityStructure === 'forced_choice') && (self || descriptive)) return '';
    if (question.options.length === 2 && (preferenceWording(localContext) || (selfReportInstruction(localContext) && /选择|选出|二选一|choose|select/i.test(localContext)))) return '';
    return '没有识别到明确的自评量表或主观迫选结构；不会把普通单选题随机填写。';
  }
  const isSupportedPersonality = question => supportReason(question) === '';
  function config(settings = {}) {
    if (settings.personalityStrategy !== undefined && !Object.hasOwn(strategies, settings.personalityStrategy)) throw Error('答题策略无效，请重新选择积极、平衡、随机或严格匹配');
    const preset = presets[settings.personalityPreset] || presets.outgoing_engineer;
    const traits = { ...preset.traits, ...(settings.personalityPreset === 'custom' ? settings.personalityTraits || {} : {}) };
    for (const key of Object.keys(dimensions)) if (!Number.isInteger(traits[key]) || traits[key] < 1 || traits[key] > 5) throw Error(`${dimensions[key]}请填写 1–5 的整数`);
    const text = settings.personalityPreset === 'custom' ? String(settings.personalityRanking || '').trim() : '';
    const rows = text ? text.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : groups.map(([axis, positive, words], order) => ({ words, order, score: positive ? traits[axis] : 6 - traits[axis] })).sort((a,b) => b.score-a.score || a.order-b.order).map(g => g.words);
    const ranks = new Map();
    rows.forEach((row, i) => row.split('|').forEach(word => {
      const key = normalize(word);
      if (!key || ranks.has(key)) throw Error(`形容词排序存在空项或重复词：${word}`);
      ranks.set(key, i);
    }));
    const answers = new Map();
    for (const line of String(settings.personalityAnswers || '').split(/\r?\n/).filter(s => s.trim())) {
      const parts = line.split('=>');
      if (parts.length !== 2 || !normalize(parts[0]) || !normalize(parts[1])) throw Error('答案表格式应为：完整题干 => 选项文字，每行一题');
      const stem = normalize(parts[0]);
      if (answers.has(stem) && answers.get(stem) !== normalize(parts[1])) throw Error(`答案表有冲突题目：${parts[0]}`);
      answers.set(stem, normalize(parts[1]));
    }
    return { preset, traits, ranks, rows, answers };
  }
  function detect(q) {
    return isSupportedPersonality(q);
  }
  // Inspectable phrase rules, not a language model. Levels describe only matched wording.
  const phraseRules = [
    ['E',5,'善于沟通|主动沟通|主动交流|主动社交|乐于交流|与人交流|与同事交流|与陌生同事交流|与陌生人交流|与人沟通|与同事沟通|与他人沟通|与陌生人沟通|善于表达|擅长表达|乐于表达|喜欢交际|喜欢沟通|乐于沟通|结识新朋友|认识新朋友|活跃气氛|主动发言|外向开朗|开朗外向|外向|健谈'],
    ['E',1,'偏好独处|喜欢独处|独处安静|安静工作|独自工作|独立工作|避免社交|回避社交|害怕社交|内向|沉默寡言'],
    ['A',5,'团队合作|团队协作|与人合作|与他人合作|与同事合作|乐于合作|善于合作|善于协调|协调分歧|尊重他人|尊重别人|体谅他人|体谅别人|善解人意|帮助他人|帮助别人|乐于助人|愿意倾听|倾听他人|倾听别人|接受建议|接受意见|换位思考|有同理心|有耐心|包容|友善'],
    ['A',1,'拒绝合作|拒绝协作|排斥合作|忽视他人|忽视别人|漠视他人|拒绝建议|拒绝意见|固执己见|自我中心|斤斤计较|挑起冲突'],
    ['C',5,'不轻易放弃|不放弃|坚持不懈|坚持到底|有毅力|持之以恒|认真负责|负责任|有责任心|承担责任|说到做到|完成承诺|遵守承诺|按时完成|按期完成|如期完成|期限前完成|截止前完成|提前完成|遵守期限|遵守规则|遵守规范|注重细节|检查细节|核对细节|检查错误|反复检查|认真检查|仔细检查|细致检查|严谨细致|有条理|有计划|制定计划|安排计划|遵循计划|组织有序|自律|踏实|勤奋'],
    ['C',1,'轻易放弃|半途而废|拖延|粗心|敷衍|马虎|逃避责任|推卸责任|缺乏条理|杂乱无章|随意应付|违背承诺|忘记期限'],
    ['S',5,'压力下工作|应对压力|处理压力|承受压力|保持冷静|冷静处理|理性处理|理性地处理|理性思考|客观分析|情绪稳定|控制情绪|管理情绪|从容应对|从容处理|保持乐观|乐观面对|积极心态|恢复心态|从挫折中恢复|沉着|冷静|乐观'],
    ['S',1,'容易焦虑|感到焦虑|焦虑|容易紧张|感到紧张|情绪失控|失控|容易慌乱|慌乱|发脾气|急躁|悲观|容易担心|过度担心'],
    ['O',5,'发现信息间的关联|发现信息之间的关联|发现信息关联|关联信息|发现规律|探索研究|探索新知识|研究新知识|学习新知识|学习新技术|研究新技术|探索新方法|尝试新方法|尝试新事物|接受新事物|探索未知|好奇心|有好奇心|求知欲|持续学习|喜欢学习|勤于学习|富有创造力|创造性|创新|灵活变通|适应变化|打破常规|挑战舒适区'],
    ['O',1,'满足于现状|维持现状|偏好熟悉|喜欢熟悉|墨守成规|拒绝变化|排斥变化|拒绝新事物|排斥新事物|保守']
  ];
  const phraseEntries = phraseRules.flatMap(([axis,level,words]) => words.split('|').map(phrase => ({axis,level,phrase})));
  function analyzeDescription(value) {
    const evidence = [];
    for (const rawClause of String(value || '').normalize('NFKC').split(/[，。；!?！？;,\r\n]|但是|然而|不过(?!度|分|于)|而且|并且|(?<!不)但/)) {
      const clause = A.normalize(rawClause);
      const matches = [];
      for (const entry of phraseEntries) {
        for (let start = clause.indexOf(entry.phrase); start !== -1; start = clause.indexOf(entry.phrase, start + 1)) matches.push({...entry,start,end:start+entry.phrase.length});
      }
      // Longer wording owns an overlapping span: “不轻易放弃” must not also match “轻易放弃”.
      const accepted = [];
      for (const match of matches.sort((a,b) => b.phrase.length-a.phrase.length || a.start-b.start)) {
        if (!accepted.some(other => match.start < other.end && other.start < match.end)) accepted.push(match);
      }
      accepted.sort((a,b) => a.start-b.start);
      let previousNegated = false;
      for (let i=0; i<accepted.length; i++) {
        const match = accepted[i];
        const prefix = clause.slice(i ? accepted[i-1].end : 0, match.start).slice(-12).replace(/不但|不仅|不光|不论|不管/g,'');
        const negations = prefix.match(/不是|并非|而非|不会|不能|不愿意|不愿|不喜欢|不太|很少|从不|难以|缺乏|没有|不/g) || [];
        const sharedNegation = i>0 && /^\s*(和|与|及|以及|或)\s*$/.test(prefix) && previousNegated;
        const negated = Boolean(negations.length % 2 || sharedNegation);
        previousNegated = negated;
        const level = negated ? 6-match.level : match.level;
        const softened = /有时|偶尔|适度/.test(prefix) ? 3+(level-3)*.5 : level;
        if (!evidence.some(e => e.axis===match.axis && e.phrase===match.phrase && e.level===softened)) evidence.push({axis:match.axis,phrase:match.phrase,level:softened,negated});
      }
    }
    const traits = {};
    for (const axis of Object.keys(dimensions)) {
      const values = [...new Set(evidence.filter(e=>e.axis===axis).map(e=>e.level))];
      if (values.length) traits[axis] = values.reduce((sum,value)=>sum+value,0)/values.length;
    }
    return {traits,evidence};
  }
  function stableChooser(question, strategy, traits) {
    const seed = JSON.stringify([normalize(question.stem),question.options.map(o=>normalize(o.text)).sort(),strategy,Object.keys(dimensions).map(axis=>traits[axis])]);
    const hash = text => { let h=2166136261; for (const char of text) { h ^= char.codePointAt(0); h=Math.imul(h,16777619); } h ^= h>>>16; h=Math.imul(h,0x85ebca6b); h ^= h>>>13; return h>>>0; };
    return (rows, role) => [...rows].sort((a,b) => hash(seed+'|'+role+'|'+normalize(a.text))-hash(seed+'|'+role+'|'+normalize(b.text)) || normalize(a.text).localeCompare(normalize(b.text)) || a.key.localeCompare(b.key))[0];
  }
  // This is a small wording heuristic, not a semantic model or a scoring key.
  function negativeWording(stem) {
    const text = A.normalize(stem);
    const bad = '(焦虑|慌乱|失控|拖延|粗心|发脾气|逃避责任)';
    if (new RegExp('(不|不会|从不|很少)[^，。；!?！？;,]{0,6}' + bad).test(text)) return false;
    if (new RegExp(bad).test(text)) return true;
    return /(不(?:太)?(?:善于|喜欢|愿意|能|会)?|很少|难以|缺乏)[^，。；!?！？;,]{0,8}(沟通|交流|合作|倾听|按时|完成|计划|乐观|冷静|主动)/.test(text);
  }
  function strategyAnswer(question, strategy, why, c, candidates = {}) {
    if (strategy === 'strict') throw Error(why + '\n当前为严格匹配，请补充答案／排序或切换答题策略；没有调用 AI。');
    const pair = question.type === 'forced_pair', scales = !pair && scaleOptions(question);
    let keys, mostKey, leastKey, basis, strategyBasis;
    const choose = stableChooser(question,strategy,c.traits);
    if (scales && strategy !== 'random') {
      const analysis = analyzeDescription(question.stem);
      const axes = Object.keys(analysis.traits);
      const preference = axes.length ? axes.reduce((sum,axis)=>sum+(analysis.traits[axis] >= 3 ? c.traits[axis] : 6-c.traits[axis]),0)/axes.length : null;
      const reverse = strategy === 'positive' && negativeWording(question.stem);
      const target = strategy === 'balanced' ? .5 : preference !== null ? (preference-1)/4 : reverse ? .25 : .75;
      const ranked = [...scales].sort((a,b) => Math.abs(a.score-target)-Math.abs(b.score-target) || b.score-a.score);
      keys = [ranked[0].key];
      strategyBasis = 'scale';
      basis = strategy === 'balanced' ? '按量表选项文字选择最接近中间等级的一项。' : preference !== null ? `题干词组：${analysis.evidence.map(e=>`“${e.phrase}”→${dimensions[e.axis]}${e.negated?'（否定反向）':''}`).join('、')}；结合所选倾向，映射到最接近的量表等级。` : reverse ? '题干命中简单反向表达规则，选择接近“不符合”的等级。' : '题干未识别具体维度，沿用积极量表规则，选择接近“符合”的等级。';
    } else {
      const rankedTie = Boolean(candidates.single || candidates.most);
      const rows = question.options.map(option => {
        const analysis = analyzeDescription(option.text), axes = Object.keys(analysis.traits);
        const score = axes.length ? 5-axes.reduce((sum,axis) => {
          const target = strategy==='balanced' ? 3+(c.traits[axis]-3)*.5 : c.traits[axis];
          return sum+Math.abs(target-analysis.traits[axis]);
        },0)/axes.length : null;
        return {...option,analysis,score};
      });
      const recognized = rows.filter(row=>row.score!==null);
      const compare = strategy!=='random' && !rankedTie && recognized.length>=2;
      const scorePool = (pool,least) => {
        const extreme = (least ? Math.min : Math.max)(...pool.map(row=>row.score));
        return pool.filter(row=>Math.abs(row.score-extreme)<1e-9);
      };
      let tied = false;
      const select = (pool,least,role) => { const choices=compare ? scorePool(pool,least) : pool; tied ||= choices.length>1; return choose(choices,role); };
      if (pair) {
        const most = select(candidates.most || (compare ? recognized : rows),false,'most');
        const remaining = (candidates.least || (compare ? recognized : rows)).filter(row=>row.key!==most.key);
        const least = select(remaining,true,'least');
        mostKey=most.key; leastKey=least.key; keys=[mostKey,leastKey];
      } else {
        const least = leastWording(question.stem);
        keys=[select(candidates.single || (compare ? recognized : rows),least,least?'least':'most').key];
      }
      strategyBasis = rankedTie ? 'tie' : strategy==='random' ? 'random' : !compare ? 'unrecognized' : tied ? 'tie' : 'traits';
      if (compare) {
        const axes = Object.keys(dimensions).filter(axis=>recognized.some(row=>Object.hasOwn(row.analysis.traits,axis)));
        basis = `按${c.preset.name}的五项倾向比较可识别描述${strategy==='balanced'?'（平衡策略将倾向向中间等级收敛）':''}：\n所用偏好：${axes.map(axis=>`${dimensions[axis]} ${c.traits[axis]}/5`).join('、')}。\n` + recognized.map(row=>`${row.key} ${row.text}：${row.analysis.evidence.map(e=>`“${e.phrase}”→${dimensions[e.axis]}${e.negated?'（否定反向）':''}`).join('、')}；偏好接近度 ${row.score.toFixed(2)}/5`).join('\n');
        if (recognized.length<rows.length) basis += '\n其余描述未识别，仅在有词组依据的选项内比较；未识别不代表最不符合。';
        if (tied) basis += '\n同分候选随机选择，保留本题结果。';
      } else if (rankedTie) basis = '已有排序等级并列，仅在对应最高／最低等级内随机选择，保留本题结果。';
      else if (strategy==='random') basis = '按随机策略选择，保留本题结果；没有按描述评分。';
      else basis = `未识别，随机选择：${recognized.length ? '仅识别到一个描述，依据不足以进行选项比较' : '这些描述均未命中词组规则'}。保留本题结果；不按固定选项位置选择。`;
      if (pair) basis += '\n最符合与最不符合始终为两个不同选项。';
    }
    return A.parseAnswer({keys,...(pair ? {mostKey,leastKey} : {}),offline:true,confidence:null,source:'离线性格',method:'strategy',strategy,strategyBasis,
      explanation:`${strategies[strategy].name} · 策略推选\n${basis}\n${why}\n本地词组与偏好规则不是完整语义理解，也不是标准正确答案。`},question,true);
  }
  function solve(question, settings = {}, data = root.AssessmentPersonalityData || []) {
    A.validateOptions(question);
    if (!['single_choice','likert','forced_choice','forced_pair','P_LIKERT','P_FORCED'].includes(question.type)) throw Error('当前不是已支持的性格单选或最符合／最不符合题，请手动处理；没有调用 AI。');
    if (question.type === 'forced_pair' && (question.options.length < 2 || question.options.length > 8)) throw Error('双角色迫选需要 2–8 个文字描述，请手动处理。');
    if (question.images?.length || question.options.some(o => o.images?.length)) throw Error('离线性格规则暂不识别图片，请手动处理；没有调用 AI。');
    const unsupported = supportReason(question); if (unsupported) throw Error(unsupported);
    const c = config(settings), stem = normalize(question.stem), pair = question.type === 'forced_pair', strategy = settings.personalityStrategy || 'positive';
    let keys, mostKey, leastKey, reason;
    const mapped = c.answers.get(stem);
    if (mapped && !pair) {
      const matches = question.options.filter(o => normalize(o.text) === mapped);
      if (matches.length !== 1) throw Error('已匹配个人答案表，但当前选项没有唯一对应文字。请检查选项；没有调用 AI。');
      keys = [matches[0].key]; reason = '完整题干匹配个人答案表，并按选项文字定位。';
    } else if (!pair && scaleOptions(question)) {
      const item = data.find(row => normalize(row.stem) === stem);
      if (!item) return strategyAnswer(question, strategy, `性格量表题尚未收录：${question.stem}`, c);
      const target = item.positive ? c.traits[item.axis] : 6 - c.traits[item.axis];
      const ranked = scaleOptions(question).sort((a,b) => Math.abs(a.score-(target-1)/4)-Math.abs(b.score-(target-1)/4) || b.score-a.score);
      keys = [ranked[0].key]; reason = `匹配已标注题干；依据${dimensions[item.axis]} ${c.traits[item.axis]}/5，${item.positive ? '正向' : '反向'}表述，映射到最接近的量表选项。`;
    } else {
      const rows = question.options.map(o => ({ ...o, rank: c.ranks.get(normalize(o.text)) }));
      const unknown = rows.filter(o => o.rank === undefined);
      if (unknown.length) return strategyAnswer(question, strategy, `以下描述尚未加入完整排序：${unknown.map(o => o.text).join('、')}`, c);
      rows.sort((a,b) => a.rank-b.rank);
      const least = leastWording(question.stem) && !pair;
      const first = least ? rows.at(-1) : rows[0];
      if (pair ? rows[0].rank === rows[1].rank || rows.at(-1).rank === rows.at(-2).rank : rows.filter(o => o.rank === first.rank).length !== 1) return strategyAnswer(question, strategy, '候选描述的偏好等级相同，需要在同等级内推选。', c, pair ? { most: rows.filter(o=>o.rank===rows[0].rank), least: rows.filter(o=>o.rank===rows.at(-1).rank) } : { single: rows.filter(o=>o.rank===first.rank) });
      if (pair) { mostKey = rows[0].key; leastKey = rows.at(-1).key; keys = [mostKey, leastKey]; }
      else keys = [first.key];
      reason = `依据${settings.personalityPreset==='custom' && settings.personalityRanking?.trim() ? '个人自定义' : c.preset.name}的描述优先顺序，${pair ? `最符合：${rows[0].text}；最不符合：${rows.at(-1).text}` : `选择${least ? '最不符合' : '最符合'}：${first.text}`}。`;
    }
    return A.parseAnswer({ keys, ...(pair ? { mostKey, leastKey } : {}), confidence: null, offline: true, source: '离线性格', method:'exact', strategy, explanation: reason + '\n精确规则匹配；结果反映所选偏好，不代表标准正确答案。' }, question, true);
  }
  function importConfig(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('配置必须是 JSON 对象');
    const lines = [];
    if (payload.answer_categories) for (const [answer, questions] of Object.entries(payload.answer_categories)) {
      if (!Array.isArray(questions) || questions.some(q => typeof q !== 'string')) throw Error('answer_categories 每类须为题干文字数组');
      questions.forEach(q => lines.push(`${q} => ${answer}`));
    }
    if (payload.question_answers) {
      if (!Array.isArray(payload.question_answers)) throw Error('question_answers 必须为数组');
      payload.question_answers.forEach(q => { if (typeof q.question_text !== 'string' || typeof q.answer !== 'string') throw Error('题目答案字段不完整'); lines.push(`${q.question_text} => ${q.answer}`); });
    }
    const result = { personalityPreset: 'custom' };
    if (payload.adjective_ranking !== undefined) {
      if (!Array.isArray(payload.adjective_ranking) || payload.adjective_ranking.some(s => typeof s !== 'string') || !payload.adjective_ranking.length) throw Error('adjective_ranking 必须为非空文字数组');
      result.personalityRanking = payload.adjective_ranking.join('\n');
    }
    if (lines.length) result.personalityAnswers = lines.join('\n');
    if (Object.keys(result).length === 1) throw Error('未找到 adjective_ranking、answer_categories 或 question_answers');
    config(result); return result;
  }
  root.AssessmentPersonality = { normalize, dimensions, strategies, presets, config, detect, solve, scaleOptions, analyzeDescription, importConfig, forcedRole, leastWording, mostWording, preferenceWording, supportReason, isSupportedPersonality };
  if (typeof module !== 'undefined') module.exports = root.AssessmentPersonality;
})(globalThis);
