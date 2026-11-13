// DISC-style horizontal four-description groups. Only explicit m[group] /
// l[group] radio names AND matching Most / Least column labels are accepted.
(function (root) {
  'use strict';
  const A = root.Assessment, P = root.AssessmentPersonality;
  const visible = el => Boolean(el?.isConnected && el.getClientRects().length
    && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"],#assessment-assistant'));
  const text = el => A.normalize(el?.textContent || '');
  const named = input => /^(m|l)\[([^\[\]\s]{1,80})\]$/.exec(input.name || '');
  const target = input => input?.closest('label') || input;
  const identities = new WeakMap(); let sequence = 0;
  const identity = table => { if (!identities.has(table)) identities.set(table, 'disc-table-' + ++sequence); return identities.get(table); };

  // Expand rowspan/colspan once so the second through fourth rows retain their
  // physical columns even though their number cell is inherited from row one.
  function grid(table) {
    const rows = [...table.rows].filter(row => row.closest('table') === table);
    const cells = new Map(), matrix = [];
    if (rows.length > 500) throw Error('DISC 表格过大，请限定当前题组。');
    rows.forEach((row, r) => {
      matrix[r] ||= []; let c = 0;
      for (const cell of row.cells) {
        while (matrix[r][c]) c++;
        const height = cell.rowSpan || 1, width = cell.colSpan || 1;
        if (height > 100 || width > 100 || c + width > 200) throw Error('DISC 表格合并范围无法确认。');
        cells.set(cell, { r, c, height, width });
        for (let rr = r; rr < r + height; rr++) {
          matrix[rr] ||= [];
          for (let cc = c; cc < c + width; cc++) {
            if (matrix[rr][cc]) throw Error('DISC 表格存在重叠的合并单元格。');
            matrix[rr][cc] = cell;
          }
        }
        c += width;
      }
    });
    return { rows, cells, matrix };
  }

  function inspect(table) {
    if (!visible(table)) return null;
    const inputs = [...table.querySelectorAll('input[type="radio"]')].filter(input => input.closest('table') === table && named(input));
    if (!inputs.length) return null;
    const header = table.tHead?.rows[table.tHead.rows.length - 1] || table.rows[0];
    const headerRoles = [...header.cells].filter(visible).map(cell => P.forcedRole(text(cell)));
    if (!headerRoles.includes('most') || !headerRoles.includes('least')) {
      if (table.hasAttribute('data-disc-grid')) throw Error('DISC 表格缺少明确的 Most / Least 表头，未填写。');
      return null;
    }
    const layout = grid(table), headerRow = layout.rows.indexOf(header), groups = new Map();
    for (const input of inputs) {
      const match = named(input), name = match[1] === 'm' ? 'most' : 'least', id = match[2];
      if (!groups.has(id)) groups.set(id, { id, most: [], least: [] });
      groups.get(id)[name].push(input);
    }
    if (groups.size > 100) throw Error('DISC 表格超过 100 组，请限定当前题组。');
    const formGroups = new Map();
    for (const input of document.querySelectorAll('input[type="radio"]')) {
      if (!formGroups.has(input.form)) formGroups.set(input.form, new Map());
      const names = formGroups.get(input.form);
      if (!names.has(input.name)) names.set(input.name, []);
      names.get(input.name).push(input);
    }
    const container = table.closest('[data-qid],.question-container,.question-content,fieldset,form') || table;
    const context = [text(table.caption), table.getAttribute('aria-label') || '',
      text(container.querySelector('[data-role="stem"],.question-title,legend'))].filter(Boolean).join(' ');
    const tableId = identity(table), snapshots = [];
    for (const group of groups.values()) {
      const all = [...group.most, ...group.least];
      if (!all.some(input => visible(target(input)))) continue;
      if (group.most.length !== 4 || group.least.length !== 4 || all.some(input => !visible(target(input)))) throw Error('DISC 每组须有四个可见描述和各四个 Most / Least 控件。');
      const entries = new Map(); let mostColumn, leastColumn;
      for (const name of ['most', 'least']) for (const input of group[name]) {
        const cell = input.closest('td,th'), position = layout.cells.get(cell);
        if (!position || position.width !== 1 || position.height !== 1 || cell.querySelectorAll('input[type="radio"]').length !== 1) throw Error('DISC 角色单元格不能包含多个控件或合并单元格。');
        const label = layout.matrix[headerRow]?.[position.c];
        if (P.forcedRole(text(label)) !== name) throw Error('DISC 控件组名与 Most / Least 表头不一致，未填写。');
        if (name === 'most') { mostColumn ??= position.c; if (mostColumn !== position.c) throw Error('DISC 同组 Most 列不一致。'); }
        else { leastColumn ??= position.c; if (leastColumn !== position.c) throw Error('DISC 同组 Least 列不一致。'); }
        if (!entries.has(position.r)) entries.set(position.r, {});
        const entry = entries.get(position.r);
        if (entry[name]) throw Error('DISC 同一描述有重复的角色控件。');
        entry[name] = input;
        const related = formGroups.get(input.form).get(input.name);
        if (related.length !== 4 || related.some(other => !table.contains(other))) throw Error('DISC 单选组名在题组外重复，可能覆盖其他作答。');
      }
      const rowIndices = [...entries.keys()].sort((a, b) => a - b);
      if (Math.abs(mostColumn - leastColumn) !== 1 || rowIndices.length !== 4 || rowIndices.some((r, i) => i && r !== rowIndices[i - 1] + 1)) throw Error('DISC 四个描述与两列角色无法对应。');
      const descriptionColumn = Math.min(mostColumn, leastColumn) - 1;
      const options = rowIndices.map((r, index) => {
        const entry = entries.get(r), cell = layout.matrix[r]?.[descriptionColumn], position = layout.cells.get(cell);
        if (!entry.most || !entry.least || !cell || !visible(cell) || !position || position.r !== r || position.width !== 1 || position.height !== 1
          || cell.querySelector('input,button,table,img,canvas') || !text(cell)) throw Error('DISC 描述必须是独立、完整的文字单元格。');
        return { key: String.fromCharCode(65 + index), text: text(cell), images: [], el: cell, most: entry.most, least: entry.least };
      });
      const question = { qid: tableId + '::' + group.id, type: 'forced_pair', personalityStructure: 'forced_pair',
        personalityContext: context, personalitySurveyTitle:root.AssessmentAdapter?.surveyTitle(container) || '',stem: `${context ? context + ' · ' : ''}第 ${group.id} 组：Most / Least`, images: [],
        options: options.map(({ key, text, images }) => ({ key, text, images })) };
      const reason = P.supportReason(question); if (reason) throw Error('DISC 第 ' + group.id + ' 组：' + reason);
      const selected = Object.fromEntries(['most', 'least'].map(name => [name, options.filter(option => option[name].checked).map(option => option.key)]));
      if (selected.most.length > 1 || selected.least.length > 1 || (selected.most.length && selected.most[0] === selected.least[0])) throw Error('DISC 同组已有重复或冲突选择，请先人工确认。');
      snapshots.push({ question, scope: table, options, fingerprint: A.fingerprint(question),
        answered: selected.most.length === 1 && selected.least.length === 1, selected,
        disc: { table, tableId, groupId: group.id, row: rowIndices[0], column: descriptionColumn } });
    }
    if (!snapshots.length) return null;
    snapshots.sort((a, b) => a.disc.row - b.disc.row || a.disc.column - b.disc.column);
    const pageFingerprint = JSON.stringify(snapshots.map(snapshot => [snapshot.fingerprint, snapshot.disc.row, snapshot.disc.column]));
    snapshots.forEach((snapshot, groupIndex) => Object.assign(snapshot.disc, {
      groupIndex, groupCount: snapshots.length, pageFingerprint, allAnswered: snapshots.every(item => item.answered)
    }));
    return snapshots;
  }

  function read(provided, _settings = {}) {
    const tables = provided ? (provided.matches('table') ? [provided] : [...provided.querySelectorAll('table')]) : [...document.querySelectorAll('table')];
    const pages = tables.map(inspect).filter(Boolean);
    if (pages.length > 1) throw Error('当前页有多个 DISC 表格，请在页面适配中限定一个表格。');
    return pages.length ? pages[0].find(snapshot => !snapshot.answered) || pages[0].at(-1) : null;
  }

  function current(snapshot) {
    if (!snapshot?.disc?.table?.isConnected) throw Error('DISC 表格已变化，旧答案已作废。');
    const rows = inspect(snapshot.disc.table), item = rows?.find(row => row.disc.groupId === snapshot.disc.groupId);
    if (!item || item.fingerprint !== snapshot.fingerprint || item.disc.pageFingerprint !== snapshot.disc.pageFingerprint) throw Error('DISC 题组、描述或布局已变化，旧答案已作废。');
    return { rows, item };
  }
  const outcome = rows => rows.some(row => !row.answered) ? { advanced: true, withinPage: true } : { advanced: false };

  async function apply(snapshot, answer, _settings, active) {
    const ready = async () => { if (typeof active !== 'function' || !await active()) throw Error('已停止，未继续填写 DISC。'); };
    const preserve = item => {
      for (const name of ['most', 'least']) if (item.selected[name].length && item.selected[name][0] !== answer[name + 'Key']) {
        throw Error('DISC 本组已有不同的角色选择，已保留，请核对后继续。');
      }
    };
    await ready(); let state = current(snapshot);
    A.parseAnswer(answer, state.item.question, true);
    if (state.item.answered) return outcome(state.rows);
    preserve(state.item);
    for (const name of ['most', 'least']) {
      await ready(); state = current(snapshot);
      preserve(state.item);
      const key = answer[name + 'Key'], selected = state.item.selected[name];
      if (selected.length) {
        if (selected[0] !== key) throw Error('DISC 本组已有不同的角色选择，已保留，请核对后继续。');
        continue;
      }
      const opposite = name === 'most' ? 'least' : 'most';
      if (state.item.selected[opposite][0] === key) throw Error('DISC 最符合与最不符合不能是同一描述，已保留已有选择。');
      const input = state.item.options.find(option => option.key === key)?.[name], control = target(input);
      if (!input?.isConnected || !visible(control) || input.disabled || input.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') throw Error('DISC 选项已禁用或不可见，未填写。');
      control.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      await ready(); state = current(snapshot);
      if (JSON.stringify(state.item.selected[name]) !== JSON.stringify([key])) throw Error('DISC 角色选择未成功回读，未进入下一组。');
    }
    state = current(snapshot);
    if (!state.item.answered || state.item.selected.most[0] !== answer.mostKey || state.item.selected.least[0] !== answer.leastKey) throw Error('DISC 两项选择未确认，未进入下一组。');
    return outcome(state.rows);
  }

  function next(snapshot, settings = {}) {
    const { rows } = current(snapshot);
    if (rows.some(row => !row.answered)) return 'changed';
    let buttons;
    try { buttons = [...document.querySelectorAll(settings.selectors?.next || 'button,[role="button"],a')]; }
    catch { throw Error('下一页选择器无效，请检查页面适配。'); }
    buttons = buttons.filter(button => visible(button) && !button.disabled && !button.matches(':disabled') && button.getAttribute('aria-disabled') !== 'true'
      && /^(下一页|下一题|下一步|继续|Next)$/i.test(text(button)));
    if (buttons.length > 1) throw Error('存在多个下一页按钮，DISC 已完成但未翻页，请校准页面适配。');
    if (!buttons.length) return null;
    buttons[0].click(); return 'clicked';
  }
  root.AssessmentDiscAdapter = { read, apply, next };
})(globalThis);
