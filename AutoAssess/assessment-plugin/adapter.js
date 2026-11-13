(function (root) {
  "use strict";
  const A = root.Assessment;
  const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest('[aria-hidden="true"], #assessment-assistant');
  const clean = value => A.normalize(value).replace(/^[A-Z](?:[.、．]\s*|\s+)/, "");
  function notReady(message) { const error = Error(message); error.code = "QUESTION_NOT_READY"; throw error; }
  function query(scope, selector) {
    try { return [...scope.querySelectorAll(selector)]; } catch { throw Error("页面适配选择器格式错误，请检查完整设置 → 页面适配"); }
  }
  function images(scope) {
    const list = [];
    for (const img of query(scope, "img")) {
      if (!visible(img)) continue;
      if (!img.complete || !img.naturalWidth) notReady("题目图片尚未加载完整，正在等待图片。");
      if (img.naturalWidth < 12 || img.naturalHeight < 12) continue;
      list.push(img.currentSrc || img.src);
    }
    for (const canvas of query(scope, "canvas")) {
      if (!visible(canvas) || canvas.width < 12 || canvas.height < 12) continue;
      try { list.push(canvas.toDataURL("image/png")); } catch { throw Error("当前画布图片无法读取，请检查图片域名权限"); }
    }
    return [...new Set(list)];
  }
  function commonAncestor(nodes) {
    let parent = nodes[0]?.parentElement;
    while (parent && !nodes.every(n => parent.contains(n))) parent = parent.parentElement;
    return parent;
  }
  function surveyTitle(scope) {
    // WJX hides its survey header after page one. That uniquely scoped header
    // remains questionnaire metadata when the browser title corroborates it.
    // This also works when the extension first loads in the middle of a survey.
    const wjxHeaders = query(document, '#toptitle #htitle.htitle');
    const wjxQuestions = query(document, '#divQuestion');
    const browserTitle = A.normalize(document.title).replace(/\s*[-_|—－]\s*问卷星\s*$/, '').trim();
    const pagingHeader = el => wjxHeaders.length === 1 && el === wjxHeaders[0]
      && wjxQuestions.length === 1 && wjxQuestions[0].contains(scope)
      && !wjxQuestions[0].contains(el) && A.normalize(el.textContent) === browserTitle;
    // Other headings still require visibility. Never read body text, hidden
    // question stems, or another survey's title as the current question's role.
    const titles = query(document, '#htitle,.htitle,.wjtitle,[data-role="survey-title"],.survey-title,.questionnaire-title,h1')
      .filter(el => (visible(el) || pagingHeader(el)) && !scope.contains(el) && !el.closest('.field[topic],.div_question')
        && !el.querySelector('input,textarea,select,[role="radio"],[data-role="option"]'))
      .map(el => A.normalize(visible(el) ? el.innerText : el.textContent))
      .filter(value => value && value.length <= 200
        && /(?:性格|人格|个性)(?:自评|测评|测验|测试|问卷|量表|选择练习)|\bpersonality\b|\b(?:MBTI|DISC|big[ -]five)\b.*(?:test|assessment|questionnaire|测评|测试|问卷)/i.test(value));
    return [...new Set(titles)].slice(0, 3).join(' · ');
  }
  function readOne(settings = {}, provided = null) {
    const custom = settings.selectors || {};
    if (visible(document.getElementById("divFengMian"))) notReady("当前是问卷说明页，请在网页上点击“开始作答”。");
    let scope = provided;
    if (custom.question && !scope) {
      const candidates = query(document, custom.question).filter(visible);
      if (!candidates.length) notReady("尚未出现所设置的题目区域。");
      if (candidates.length !== 1) throw Error(`题目区域匹配了 ${candidates.length} 处，请校准为唯一的当前题目区域`);
      scope = candidates[0];
    }
    const shl = root.AssessmentShlAdapter?.read(scope || null, settings);
    if (shl) return shl;
    const disc = root.AssessmentDiscAdapter?.read(scope || null, settings);
    if (disc) return disc;
    const matrix = root.AssessmentPersonalityMatrixAdapter?.read(scope || null, settings);
    if (matrix) return matrix;
    if (!scope) {
      const fields = query(document, '.field[topic],.div_question').filter(visible);
      if (fields.length > 1) throw Error("当前页有多个问卷题组，请在页面适配中指定当前题目容器。");
      const candidates = [...fields, ...query(document, '[data-qid], .question-container, .question-content, .subject-content, .question-box, .question-card, .question').filter(visible)];
      scope = candidates.find(el => el.querySelector('[data-role="option"],input[type="radio"],input[type="checkbox"],[role="radio"],.ant-radio-wrapper,.el-radio,.radio-item'));
    }
    if (["rank","P_RANK","text_input"].includes(scope?.dataset.type)) throw Error("排序、拖拽和文本输入题尚未支持，请手动处理。");
    const pair = root.AssessmentPairAdapter?.read(scope || null, settings);
    if (pair) return pair;
    let options = [];
    const containers = custom.option ? [custom.option] : ['[data-role="option"]', '.ui-radio,.ui-checkbox', '.ant-radio-wrapper,.ant-checkbox-wrapper', '.el-radio,.el-checkbox', '[role="radio"],[role="checkbox"]', '.radio-item,.checkbox-item', 'input[type="radio"],input[type="checkbox"]'];
    for (const selector of containers) {
      options = query(scope || document, selector).map(el => {
        if (el.matches('input')) return el.closest('label') || (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el;
        return el;
      }).filter(visible);
      options = [...new Set(options)];
      if (options.length >= 2) break;
    }
    if (options.length < 2) notReady("尚未识别到完整题目与选项；面板可以保持打开，不必等到答题页才打开插件。");
    if (options.length > 30) throw Error("识别到的选项超过 30 个，请在页面适配中限定单题范围。");
    const names = new Set(options.flatMap(el => [...el.querySelectorAll('input[type="radio"]'), ...(el.matches('input[type="radio"]') ? [el] : [])]).map(el => el.name).filter(Boolean));
    if (names.size > 1) throw Error("检测到多个题组，请将题目选择器限定到当前单题");
    if (!scope) {
      scope = commonAncestor(options);
      while (scope && scope !== document.body && !query(scope, '[data-role="stem"],.question-title,.subject-title,.stem,.question-stem').length) scope = scope.parentElement;
      if (!scope || scope === document.body) throw Error("无法确定题干范围，请在完整设置的页面适配中填写题干和题目选择器");
    }
    const stemNodes = query(scope, custom.stem || '[data-role="stem"],.topichtml,.div_title_question,.question-title,.subject-title,.stem,.question-stem').filter(visible);
    let stem = stemNodes.map(el => el.innerText).join("\n").trim();
    if (!stem) {
      const clone = scope.cloneNode(true);
      for (const selector of [...containers, 'button,script,style,nav,[data-role="countdown"],.countdown,.timer']) query(clone, selector).forEach(el => el.remove());
      stem = clone.textContent.trim();
    }
    if (query(scope,'img,canvas').some(visible)) throw Error("图片性格题尚未支持，请手动处理；不会调用 AI 或猜选项。");
    const allImages = images(scope);
    const mapped = options.map((el, i) => {
      const clone = el.cloneNode(true); clone.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove());
      const raw = clone.textContent || el.getAttribute("aria-label") || el.dataset.alt || "";
      return { key: el.dataset.key || String.fromCharCode(65 + i), text: clean(raw), images: images(el), el };
    });
    const optionImages = new Set(mapped.flatMap(o => o.images));
    const stemImages = allImages.filter(src => !optionImages.has(src));
    if ((!stem && !stemImages.length) || stem.length > 20000) throw Error("题干为空或范围过大，请校准页面适配");
    if (mapped.some(o => !o.text && !o.images.length)) throw Error("有选项没有文字或图片，停止填写并等待检查");
    if (root.AssessmentPersonality.mostWording(stem) && root.AssessmentPersonality.leastWording(stem)) throw Error("已识别双角色迫选题意，但不能确定最像／最不像两类控件，请校准页面适配。");
    let type = scope.dataset.type || (options.some(el => el.matches('[role="checkbox"],input[type="checkbox"]') || el.querySelector('input[type="checkbox"]')) ? "multi_choice" : root.AssessmentPersonality.mostWording(stem) || root.AssessmentPersonality.leastWording(stem) ? "forced_choice" : "single_choice");
    if (type === "single_choice" && root.AssessmentPersonality?.scaleOptions({ options: mapped })) type = "likert";
    const question = { qid: scope.dataset.qid || (scope.getAttribute("topic") ? "wjx-" + scope.getAttribute("topic") : ""), type, stem, images: stemImages, options: mapped.map(({ el, ...o }) => o) };
    question.personalityContext = A.normalize(scope.getAttribute('aria-label') || scope.querySelector('legend,caption')?.textContent || '');
    question.personalitySurveyTitle = surveyTitle(scope);
    const unsupported = root.AssessmentPersonality.supportReason(question); if (unsupported) throw Error(unsupported);
    return { question, scope, options: mapped, fingerprint: A.fingerprint(question) };
  }
  function selected(el) {
    const input = el.matches('input') ? el : el.querySelector('input[type="radio"],input[type="checkbox"]');
    return Boolean(input?.checked || el.querySelector('.jqradio.jqchecked,.jqcheck.jqchecked') || el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-selected") === "true" || el.classList.contains("selected") || el.classList.contains("is-checked") || el.classList.contains("ant-radio-wrapper-checked") || el.classList.contains("ant-checkbox-wrapper-checked"));
  }
  function answered(snapshot) {
    if (snapshot.disc) return snapshot.disc.allAnswered;
    if (snapshot.matrix) return snapshot.matrix.allAnswered;
    if (snapshot.pair) {
      const most = root.AssessmentPairAdapter.assigned(snapshot, 'most');
      const least = root.AssessmentPairAdapter.assigned(snapshot, 'least');
      if (most.length > 1 || least.length > 1 || (most.length && least.length && most[0] === least[0])) throw Error('迫选题已有选择冲突，请先核对页面。');
      return most.length === 1 && least.length === 1;
    }
    const chosen = snapshot.options.filter(o => selected(o.el));
    if (chosen.length > 1) throw Error('性格单选题已有多个选中项，请先核对页面。');
    return chosen.length === 1;
  }
  function pageScopes(settings) {
    if (settings.selectors?.question) return [];
    const fields = query(document, '.field[topic],.div_question').filter(visible);
    const formGroups = query(document, 'form').filter(el => visible(el) && el.querySelector('input[name="RadioGroupm"],input[name="RadioGroupl"]'));
    const candidates = [...new Set([...(fields.length ? fields : query(document, '[data-qid],.question-container,.question-content,.subject-content,.question-box,.question-card,.question').filter(visible)), ...formGroups])];
    const complete = candidates.filter(el => el.matches('table,form,.field[topic],.div_question,[data-qid]')
      || el.querySelector('[data-role="stem"],.question-title,.topichtml,.div_title_question,.subject-title,.stem,.question-stem'));
    const pool = complete.length ? complete : candidates;
    const scopes = pool.filter(el => !pool.some(other => other !== el && el.contains(other)));
    if (scopes.length > 100) throw Error('同页题组超过 100 个，请限定当前页面范围。');
    return scopes;
  }
  function readPage(settings) {
    const scopes = pageScopes(settings);
    if (scopes.length < 2) return null;
    // Inspect the whole page before any write, including non-personality groups.
    const items = scopes.map((scope,index) => {
      const item = readOne(settings, scope);
      if (!item.question.qid) { item.question.qid = 'personality-page-' + index; item.fingerprint = A.fingerprint(item.question); }
      return item;
    });
    const fingerprint = JSON.stringify(items.map((item,index) => [index,item.disc?.pageFingerprint || item.matrix?.groupFingerprint || item.fingerprint]));
    return {items, fingerprint};
  }
  function read(settings = {}) {
    const page = readPage(settings);
    if (!page) { const snapshot = readOne(settings); return {...snapshot, answered:answered(snapshot)}; }
    const pending = page.items.findIndex(item => !answered(item));
    const index = pending < 0 ? page.items.length - 1 : pending;
    const snapshot = page.items[index];
    return {...snapshot, answered:pending < 0, pageGroup:{index,count:page.items.length,fingerprint:page.fingerprint}};
  }
  function currentSnapshot(snapshot, settings) {
    if (snapshot.pageGroup) {
      const page = readPage(settings);
      if (!page || page.fingerprint !== snapshot.pageGroup.fingerprint) throw Error('同页题组或描述已变化，旧答案已作废。');
      return page.items[snapshot.pageGroup.index];
    }
    return snapshot.scope.isConnected ? readOne(settings, snapshot.matrix?.table || snapshot.scope) : read(settings);
  }
  async function apply(snapshot, answer, settings, active) {
    const guardedActive = async () => {
      const running = await active();
      if (running && snapshot.pageGroup) currentSnapshot(snapshot, settings);
      return running;
    };
    if (snapshot?.disc) {
      if(snapshot.pageGroup)currentSnapshot(snapshot, settings);
      const result = await root.AssessmentDiscAdapter.apply(snapshot, answer, settings, guardedActive);
      if (snapshot.pageGroup && read(settings).pageGroup?.index !== snapshot.pageGroup.index) return {advanced:true,withinPage:true};
      return result;
    }
    if (snapshot?.matrix) {
      currentSnapshot(snapshot, settings);
      const result = await root.AssessmentPersonalityMatrixAdapter.apply(snapshot, answer, settings, guardedActive);
      if (snapshot.pageGroup && read(settings).fingerprint !== snapshot.fingerprint) return {advanced:true,withinPage:true};
      return result;
    }
    const reread = () => currentSnapshot(snapshot, settings);
    const current = reread();
    if (current.fingerprint !== snapshot.fingerprint) throw Error("页面题目已变化，旧答案已作废，请重新识别");
    A.parseAnswer(answer, current.question, true);
    if (current.pair) {
      const result = await root.AssessmentPairAdapter.apply(current, answer, settings, active, reread);
      if (snapshot.pageGroup && read(settings).fingerprint !== snapshot.fingerprint) return {advanced:true,withinPage:true};
      return result;
    }
    if (["rank", "text_input"].includes(current.question.type)) throw Error("此题型需要手动处理");
    for (const o of current.options) {
      const desired = answer.keys.includes(o.key);
      if (desired === selected(o.el)) continue;
      if (!desired && current.question.type !== "multi_choice") continue;
      if (!await active()) throw Error("已停止，未继续填写");
      const fresh = reread();
      if (!o.el.isConnected || fresh.fingerprint !== snapshot.fingerprint) throw Error("填写期间题目已变化，已停止");
      if (fresh.options.some(option => selected(option.el) && !answer.keys.includes(option.key))) throw Error('本题已有不同选择，未覆盖已有作答。');
      if (o.el.disabled || o.el.querySelector('input')?.disabled || o.el.getAttribute('aria-disabled') === 'true') throw Error('本题选项不可点击，未填写。');
      o.el.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    let check;
    try { check = reread(); } catch (error) { if (!snapshot.scope.isConnected && error.code === 'QUESTION_NOT_READY') return { advanced:true }; throw error; }
    if (check.fingerprint !== snapshot.fingerprint) return { advanced: true };
    const actual = check.options.filter(o => selected(o.el)).map(o => o.key).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...answer.keys].sort())) throw Error("点击后未检测到预期选中状态，请校准选项选择器；未进入下一题");
    if (snapshot.pageGroup && read(settings).fingerprint !== snapshot.fingerprint) return {advanced:true,withinPage:true};
    return { advanced: false };
  }
  function next(snapshot, settings) {
    if (snapshot.pageGroup) {
      currentSnapshot(snapshot, settings);
      if (!read(settings).answered) return 'changed';
    } else if (snapshot?.disc) return root.AssessmentDiscAdapter.next(snapshot, settings);
    else if (snapshot?.matrix) return root.AssessmentPersonalityMatrixAdapter.next(snapshot, settings);
    if (read(settings).fingerprint !== snapshot.fingerprint) return "changed";
    if (!answered(currentSnapshot(snapshot, settings))) throw Error('本题选择尚未完成或已被清空，未进入下一题。');
    if (snapshot.pair) {
      const current = currentSnapshot(snapshot, settings), most = root.AssessmentPairAdapter.assigned(current, 'most'), least = root.AssessmentPairAdapter.assigned(current, 'least');
      if (most.length !== 1 || least.length !== 1 || most[0] === least[0]) throw Error('三选二尚未完成两项不同选择，未切题。');
      const confirm = query(current.scope, 'button,[role="button"],div.phoenix-button.content').filter(el => visible(el) && !el.disabled && !el.matches(':disabled')
        && el.getAttribute('aria-disabled') !== 'true' && !el.matches('.disabled,.is-disabled,.phoenix-button-disabled')
        && /^(确定|确认选择|确认本题)$/.test(A.normalize(el.innerText)));
      if (confirm.length > 1) throw Error('本题存在多个确认按钮，请手动确认。');
      if (confirm.length === 1) { confirm[0].click(); return 'clicked'; }
    }
    if (!snapshot.pageGroup && snapshot.scope.dataset.next) {
      const u = new URL(snapshot.scope.dataset.next, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith("/q/")) throw Error("下一题地址异常，已停止");
      return { url: u.href };
    }
    const candidates = query(document, settings.selectors?.next || 'button,[role="button"],a').filter(el => visible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true" && /^(下一题|下一页|下一步|继续|Next)$/i.test(A.normalize(el.innerText)));
    if (candidates.length > 1) throw Error("存在多个下一题按钮，请在完整设置中校准下一题选择器");
    if (!candidates.length) return null;
    const el = candidates[0];
    if (/提交|交卷|结束|完成/.test(el.innerText)) throw Error("已到提交环节，请手动处理");
    el.click();
    return "clicked";
  }
  root.AssessmentAdapter = { read, apply, next, selected, surveyTitle };
})(globalThis);
