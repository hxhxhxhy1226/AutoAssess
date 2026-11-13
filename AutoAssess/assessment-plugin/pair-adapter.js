// Two to eight descriptions with distinct most/least roles, never plain checkboxes.
(function (root) {
  const A = root.Assessment;
  const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('#assessment-assistant,[aria-hidden="true"]');
  const nodes = (scope, selector) => [...scope.querySelectorAll(selector)].filter(visible);
  const role = value => root.AssessmentPersonality.forcedRole(value);
  const pairHint = value => root.AssessmentPersonality.mostWording(value) && root.AssessmentPersonality.leastWording(value);
  const selected = el => Boolean(el && (el.checked || el.querySelector('input:checked,.jqradio.jqchecked,.jqcheck.jqchecked') || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.classList.contains('selected') || el.classList.contains('is-checked') || el.classList.contains('ant-radio-wrapper-checked')));
  function controlRole(el, scope) {
    const explicit = role(el.dataset.choice || el.dataset.role || el.getAttribute('aria-label') || el.getAttribute('title') || '') || role(el.innerText);
    if (explicit) return explicit;
    const input = el.matches('input') ? el : el.querySelector('input');
    const named = role(input?.name || ''); if (named) return named;
    const cell = el.closest('td,th'), table = el.closest('table');
    return cell && table && scope.contains(table) ? role(table.querySelectorAll('thead tr:last-child > *')[cell.cellIndex]?.textContent) : '';
  }
  function candidates(row) {
    return [...new Set([...row.querySelectorAll('button,[role="radio"],input[type="radio"],input[type="checkbox"]')].map(el => el.matches('input') ? el.closest('label,.ui-radio,.ui-checkbox,.ant-radio-wrapper,.el-radio') || el : el))].filter(visible);
  }
  function sourceBoxRole(el) {
    // Known source boxes sometimes wrap the role label in a span. Inspect only
    // their label children; assigned description text must not change the role.
    if (!el.matches('div[class*="qupWj"],div[class*="kACSf"],div[class*="Lu7d3"]')) return '';
    const roles = [...new Set([...el.childNodes].map(node => role(node.textContent)).filter(Boolean))];
    return roles.length === 1 ? roles[0] : '';
  }
  function read(provided, settings) {
    const roots = provided ? [provided] : nodes(document, '[data-type="forced_pair"],.forced-choice-question,.question-container,.question-content,.subject-content,.question,table');
    if (!provided) for (const content of nodes(document, '[data-cls="tuozhuai-content"]')) {
      let scope = content.parentElement;
      for (let i=0; scope && scope !== document.body && i<4; i++,scope=scope.parentElement) {
        if (pairHint(scope.innerText)) { if (!roots.includes(scope)) roots.push(scope); break; }
      }
    }
    const snapshots = [];
    for (const scope of roots) {
      const hint = pairHint(scope.innerText);
      if (!hint && scope.dataset.type !== 'forced_pair') continue;
      const custom = settings.selectors || {};
      let items = nodes(scope, custom.pairItem || '[data-forced-row],.adjective-row,.forced-choice-row,tbody tr');
      let layout = 'matrix', options = [], buttons = {};
      if (!items.length) { items = nodes(scope, custom.pairItem || '[data-role="adjective"],.adjective-item,.adjective-option'); layout = 'shared'; }
      if (!items.length && !custom.pairItem) { items = nodes(scope, '[data-cls="tuozhuai-content"] span[class*="I6Yvw"]'); layout = 'shared'; }
      if (!items.length) continue;
      if (custom.pairItem && !candidates(items[0]).length) layout = 'shared';
      if (items.length < 2 || items.length > 8) throw Error(`已识别最符合／最不符合结构，但描述有 ${items.length} 项；当前双角色迫选只支持 2–8 项，请手动处理。`);
      if (layout === 'shared') {
        const sourceLayout = Boolean(scope.querySelector('[data-cls="tuozhuai-content"] span[class*="I6Yvw"]'));
        for (const name of ['most','least']) {
          const selector = name === 'most' ? custom.pairMost : custom.pairLeast;
          const candidates = selector ? nodes(scope, selector) : nodes(scope, 'button,[role="button"],div').filter(el => role(el.dataset.choice || el.getAttribute('aria-label') || '') === name || role([...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')) === name || (sourceLayout && sourceBoxRole(el) === name));
          const matches = selector ? candidates : candidates.filter(el => !candidates.some(other => other !== el && other.contains(el)));
          if (matches.length !== 1) throw Error(`三选二的${name === 'most' ? '最符合' : '最不符合'}按钮无法唯一定位，请校准页面适配。`);
          buttons[name] = matches[0];
        }
      }
      for (const [i, el] of items.entries()) {
        const textNode = el.querySelector('[data-role="trait"],.adjective-text,.option-text') || (layout === 'matrix' ? [...el.children].find(n => !n.querySelector('input,button,[role="radio"]')) : null);
        const clone = el.cloneNode(true); clone.querySelectorAll('button,input,[role="radio"],[data-role="assignment"]').forEach(n => n.remove());
        const text = A.normalize(textNode?.textContent || el.dataset.text || clone.textContent).replace(/^[A-Z][.、．]\s*/, '');
        if (!text) throw Error('三选二存在空描述，停止填写。');
        const option = { key: el.dataset.key || String.fromCharCode(65+i), text, images: [], el };
        if (layout === 'matrix') for (const name of ['most','least']) {
          const selector = name === 'most' ? custom.pairMost : custom.pairLeast;
          const matches = selector ? nodes(el, selector) : candidates(el).filter(n => controlRole(n, scope) === name);
          if (matches.length !== 1) throw Error('三选二的最符合／最不符合控件无法唯一定位，请校准页面适配。');
          option[name] = matches[0];
        }
        options.push(option);
      }
      const stemNode = scope.querySelector(custom.stem || '[data-role="stem"],.question-title,.stem,.topichtml');
      const question = { qid: scope.dataset.qid || '', type: 'forced_pair', personalityStructure:'forced_pair',
        personalityContext:A.normalize(scope.querySelector('caption,legend')?.textContent || scope.getAttribute('aria-label') || ''),
        personalitySurveyTitle:root.AssessmentAdapter?.surveyTitle(scope) || '',
        stem: A.normalize(stemNode?.textContent || `从 ${options.length} 个描述中分别选择 Most / Least`), images: [], options: options.map(({key,text,images}) => ({key,text,images})) };
      if (scope.querySelector('img,canvas')) throw Error('三选二包含图片，当前离线规则仅支持文字描述。');
      const unsupported = root.AssessmentPersonality.supportReason(question); if (unsupported) throw Error(unsupported);
      snapshots.push({ scope, question, options, pair: { layout, buttons }, fingerprint: A.fingerprint(question) });
    }
    const unique = snapshots.filter(s => !snapshots.some(other => other !== s && other.scope.contains(s.scope)));
    if (unique.length > 1) throw Error('检测到多个三选二题组，请限定当前题目容器。');
    return unique[0] || null;
  }
  function assigned(snapshot, name) {
    const box = snapshot.pair.buttons?.[name];
    const boxText = A.normalize(box?.innerText || '').replace(/^(?:最不符合|最符合|最不像|最像|最不贴近|最贴近)(?:我|自己|本人)?\s*|^(?:most|least)(?:\s+like\s+(?:me|myself))?\s*/i, '').trim();
    return snapshot.options.filter(o => snapshot.pair.layout === 'matrix' ? selected(o[name]) : role(o.el.dataset.assigned || o.el.dataset.choice || o.el.querySelector('[data-role="assignment"]')?.textContent || '') === name || o.el.classList.contains(name + '-selected') || (boxText && A.normalize(o.text) === boxText)).map(o => o.key);
  }
  function verified(snapshot, answer) {
    return JSON.stringify(assigned(snapshot, 'most')) === JSON.stringify([answer.mostKey]) && JSON.stringify(assigned(snapshot, 'least')) === JSON.stringify([answer.leastKey]);
  }
  async function apply(snapshot, answer, settings, active, reread) {
    A.parseAnswer(answer, snapshot.question, true);
    for (const name of ['most','least']) {
      const existing = assigned(snapshot, name);
      if (existing.length && (existing.length !== 1 || existing[0] !== answer[name+'Key'])) throw Error('迫选题已有不同选择，未覆盖已有作答。');
    }
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    async function before() {
      if (!await active()) throw Error('已停止，未继续填写三选二。');
      const current = reread(settings);
      if (current.fingerprint !== snapshot.fingerprint || !current.pair) throw Error('三选二题目已变化，旧答案已作废。');
      for (const name of ['most','least']) {
        const existing = assigned(current, name);
        if (existing.length && (existing.length !== 1 || existing[0] !== answer[name+'Key'])) throw Error('迫选题选择已由其他操作改变，未覆盖已有作答。');
      }
      return current;
    }
    for (const name of ['most','least']) {
      let current = await before(); const key = answer[name + 'Key'];
      if (JSON.stringify(assigned(current,name)) === JSON.stringify([key])) continue;
      let option = current.options.find(o => o.key === key), target = current.pair.layout === 'matrix' ? option[name] : option.el;
      if (!target.isConnected || target.disabled || target.getAttribute('aria-disabled') === 'true') throw Error('三选二选项不可点击，未继续填写。');
      target.click(); await pause();
      if (current.pair.layout === 'shared') {
        current = await before(); target = current.pair.buttons[name];
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') throw Error('三选二分配按钮不可点击。');
        target.click(); await pause();
      }
      // Do not accept navigation after just the first role has been assigned.
      let check;
      try { check = reread(settings); } catch { throw Error('填写三选二时页面提前切换，未能核对两项结果。'); }
      if (check.fingerprint !== snapshot.fingerprint) {
        if (name === 'least') return { advanced: true };
        throw Error('仅填写最符合后页面就切换，未完成三选二；已停止。');
      }
      if (JSON.stringify(assigned(check, name)) !== JSON.stringify([key])) throw Error(`未检测到${name === 'most' ? '最符合' : '最不符合'}的预期选中状态，未进入下一题。`);
    }
    const check = await before();
    if (!verified(check, answer)) throw Error('三选二两项选择互相覆盖或未成功，未进入下一题。');
    return { advanced: false };
  }
  root.AssessmentPairAdapter = { read, apply, assigned, verified };
})(globalThis);
