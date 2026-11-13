// The published SHL example uses separate forms, a tbody M/L heading,
// and RadioGroupm / RadioGroupl controls. These aliases are local to this
// verified structure; M and L do not become global personality role names.
(function (root) {
  'use strict';
  const A = root.Assessment, P = root.AssessmentPersonality;
  const visible = el => Boolean(el?.isConnected && el.getClientRects().length
    && getComputedStyle(el).visibility !== 'hidden'
    && !el.closest('[aria-hidden="true"],#assessment-assistant'));
  const text = el => A.normalize(el?.textContent || '');
  const roleName = name => name === 'RadioGroupm' ? 'most' : name === 'RadioGroupl' ? 'least' : '';
  const clickable = input => input.closest('label,[role="radio"],.ui-radio,.ant-radio-wrapper,.el-radio') || input;
  const identities = new WeakMap(); let sequence = 0;
  const identity = form => { if (!identities.has(form)) identities.set(form, 'ml-form-' + ++sequence); return identities.get(form); };

  function inspect(form) {
    if (!visible(form)) return null;
    const controls = [...form.querySelectorAll('input[type="radio"]')];
    const named = controls.filter(input => roleName(input.name));
    if (!named.length) return null;
    if (named.length !== 6 || controls.length !== 6
      || named.some(input => input.form !== form || !visible(clickable(input)))) {
      throw Error('M/L 双列题须在独立表单内包含三个描述的完整可见角色控件。');
    }
    for (const name of ['RadioGroupm', 'RadioGroupl']) {
      const owned = [...form.elements].filter(input => input.matches('input[type="radio"]') && input.name === name);
      if (owned.length !== 3 || owned.some(input => !named.includes(input))) throw Error('M/L 控件在表单外关联或分组不完整，未填写。');
    }
    const table = named[0].closest('table');
    if (!table || !form.contains(table) || named.some(input => input.closest('table') !== table)) {
      throw Error('M/L 角色控件不在同一题组表格，未填写。');
    }
    const rows = [...table.rows].filter(row => row.closest('table') === table && visible(row));
    if (rows.length !== 4) throw Error('M/L 双列题需要一个表头和三个完整描述行。');
    const header = rows[0], expanded = [];
    for (const cell of header.cells) {
      if (!visible(cell) || cell.rowSpan !== 1 || cell.colSpan < 1 || cell.colSpan > 3
        || cell.querySelector('input,button,table')) throw Error('M/L 表头结构无法确认。');
      for (let i = 0; i < cell.colSpan; i++) expanded.push(cell);
    }
    const roles = expanded.map(cell => text(cell).toUpperCase());
    if (expanded.length !== 5 || new Set(roles.slice(3)).size !== 2
      || !roles.slice(3).includes('M') || !roles.slice(3).includes('L')
      || roles.slice(0,3).some(value => value === 'M' || value === 'L')
      || expanded.slice(3).some(cell => cell.colSpan !== 1)) throw Error('M/L 双列题缺少明确且不同的 M、L 表头，未填写。');
    const columns = { most: roles.indexOf('M'), least: roles.indexOf('L') };
    const options = rows.slice(1).map(row => {
      const cells = [...row.cells];
      if (cells.length !== 5 || cells.some(cell => !visible(cell) || cell.colSpan !== 1 || cell.rowSpan !== 1)) {
        throw Error('M/L 描述行与题号、字母、描述及两个角色列不能对应。');
      }
      const key = text(cells[1]).toUpperCase(), description = text(cells[2]);
      if (!/^[ABC]$/.test(key) || !description || cells.slice(0,3).some(cell => cell.querySelector('input,button,table,img,canvas'))) {
        throw Error('M/L 题的描述和 A/B/C 标识必须完整且仅含文字。');
      }
      const option = { key, text:description, images:[], el:row };
      for (const role of ['most','least']) {
        const inputs = [...cells[columns[role]].querySelectorAll('input[type="radio"]')];
        if (inputs.length !== 1 || roleName(inputs[0].name) !== role || inputs[0].form !== form
          || inputs[0].value.toUpperCase() !== key) throw Error('M/L 角色表头、控件组名与描述标识不一致，未填写。');
        option[role] = clickable(inputs[0]);
      }
      return option;
    });
    if (new Set(options.map(option => option.key)).size !== 3) throw Error('M/L 题存在重复描述标识，未填写。');
    const localStem = form.querySelector('[data-role="stem"],.question-title,legend');
    const context = [form.getAttribute('aria-label') || '', text(table.caption), text(localStem)].filter(Boolean).join(' ');
    const question = {
      qid:form.dataset.qid || form.id || identity(form), type:'forced_pair', personalityStructure:'forced_pair',
      stem:text(localStem) || text(table.caption) || roles.slice(3).join(' / '),
      personalityContext:A.normalize(context), personalitySurveyTitle:root.AssessmentAdapter?.surveyTitle(form) || '',
      images:[], options:options.map(({key,text,images}) => ({key,text,images}))
    };
    const unsupported = P.supportReason(question); if (unsupported) throw Error(unsupported);
    return { question, scope:form, options, pair:{layout:'matrix',buttons:{}}, fingerprint:A.fingerprint(question) };
  }

  function read(provided, _settings = {}) {
    let forms;
    if (!provided) forms = [...document.forms];
    else if (provided.matches('form')) forms = [provided];
    else if (provided.matches('table') && provided.closest('form')) forms = [provided.closest('form')];
    else forms = [...provided.querySelectorAll('form')];
    const snapshots = forms.map(inspect).filter(Boolean);
    if (snapshots.length > 1) throw Error('当前范围内有多个 M/L 题组，请按独立表单逐组处理。');
    return snapshots[0] || null;
  }
  root.AssessmentShlAdapter = { read };
})(globalThis);
