// Row-by-row self-report scales. A page navigation is allowed only after every
// row has exactly one confirmed selection; there are no model or network calls.
(function (root) {
  'use strict';
  const A = root.Assessment, P = root.AssessmentPersonality;
  const visible = el => Boolean(el?.isConnected && el.getClientRects().length
    && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"],#assessment-assistant'));
  const text = el => A.normalize(el?.textContent || '');
  const nodes = (scope, selector) => [...scope.querySelectorAll(selector)].filter(visible);
  const selected = el => Boolean(el?.checked || el?.querySelector('input:checked,.jqradio.jqchecked')
    || el?.getAttribute('aria-checked') === 'true' || el?.getAttribute('aria-selected') === 'true'
    || el?.classList.contains('selected') || el?.classList.contains('is-checked') || el?.classList.contains('ant-radio-wrapper-checked'));

  function control(cell) {
    const raw = [...cell.querySelectorAll('input[type="radio"],[role="radio"],.ant-radio-wrapper,.el-radio,.ui-radio')];
    const controls = [...new Set(raw.map(el => el.matches('input')
      ? el.closest('label,[role="radio"],.ant-radio-wrapper,.el-radio,.ui-radio') || el : el))].filter(visible);
    const outer = controls.filter(el => !controls.some(other => other !== el && other.contains(el)));
    if (outer.length !== 1) throw Error('矩阵量表的每个单元格必须有一个可确认的单选控件。');
    return outer[0];
  }

  function inspect(table, tableIndex) {
    const marked = table.matches('[data-personality-matrix],.likert-matrix') || table.closest('[data-type="likert_matrix"]');
    const header = table.querySelector('thead tr:last-child') || table.rows?.[0];
    if (!header) return null;
    const headers = [...header.cells].filter(visible);
    const labels = headers.slice(1).map((cell,index)=>({key:String.fromCharCode(65+index),text:text(cell)}));
    if (!P.scaleOptions({options:labels})) {
      if (marked) throw Error('矩阵量表表头不是支持的 2–7 级自评或频率标签。');
      return null;
    }
    if (headers.some(cell=>cell.colSpan !== 1 || cell.rowSpan !== 1)) throw Error('合并单元格的矩阵量表尚未支持，请手动处理。');
    const bodyRows = [...table.querySelectorAll('tbody > tr')].filter(row=>row.closest('table')===table && visible(row) && row!==header);
    if (bodyRows.length < 2) return null;
    if (bodyRows.length > 100) throw Error('矩阵量表超过 100 行，请限定当前题组。');
    const container = table.closest('[data-qid],.question-container,.question-content,.field,.div_question,fieldset') || table;
    const contextNode = container.querySelector('[data-role="stem"],.question-title,.topichtml,legend');
    const context = [text(table.querySelector('caption')),table.getAttribute('aria-label') || '',text(contextNode)].filter(Boolean).join(' ');
    const groupKey = table.dataset.qid || table.id || container.dataset.qid || 'personality-matrix-' + [...document.querySelectorAll('table')].indexOf(table);
    const rows = bodyRows.map((row,index) => {
      const cells = [...row.cells].filter(visible);
      if (cells.length !== headers.length || cells.some(cell=>cell.colSpan !== 1 || cell.rowSpan !== 1)) throw Error('矩阵量表的行列数量不一致，请手动校准。');
      if (nodes(row,'img,canvas').length || row.querySelector('input[type="checkbox"]')) throw Error('图片或多选矩阵尚未支持；当前仅处理文字单选自评量表。');
      const stem = text(cells[0]);
      const options = cells.slice(1).map((cell,i)=>({...labels[i],images:[],el:control(cell)}));
      const question = {qid:groupKey+'::row-'+(row.dataset.rowId || row.id || index+1),type:'likert',
        personalityStructure:'likert_matrix',personalityContext:context,personalitySurveyTitle:root.AssessmentAdapter?.surveyTitle(container) || '',stem,images:[],options:options.map(({el,...option})=>option)};
      const reason = P.supportReason(question); if(reason) throw Error('矩阵第 '+(index+1)+' 行：'+reason);
      const selectedKeys = options.filter(option=>selected(option.el)).map(option=>option.key);
      if (selectedKeys.length > 1) throw Error('矩阵量表同一行存在多个已选项，请先人工确认。');
      return {question,scope:row,options,selectedKeys,fingerprint:A.fingerprint(question)};
    });
    const groupFingerprint = JSON.stringify([groupKey,labels.map(o=>o.text),rows.map(row=>row.fingerprint)]);
    return {table,groupKey,groupFingerprint,rows};
  }

  function scan(provided) {
    const tables = provided ? (provided.matches('table') ? [provided] : nodes(provided,'table')) : nodes(document,'table');
    return tables.map((table,index)=>inspect(table,index)).filter(Boolean);
  }

  function rowSnapshot(group, index) {
    return {...group.rows[index],matrix:{table:group.table,groupKey:group.groupKey,groupFingerprint:group.groupFingerprint,
      rowIndex:index,rowCount:group.rows.length,allAnswered:group.rows.every(row=>row.selectedKeys.length===1)}};
  }

  function read(provided, _settings) {
    const groups = scan(provided);
    if (groups.length > 1) throw Error('当前页有多个矩阵量表，请在页面适配中限定当前题组。');
    if (!groups.length) return null;
    const group = groups[0], pending = group.rows.findIndex(row=>row.selectedKeys.length===0);
    return rowSnapshot(group,pending < 0 ? group.rows.length-1 : pending);
  }

  function currentGroup(snapshot) {
    if (!snapshot?.matrix) throw Error('缺少矩阵题组快照，未填写。');
    const groups = scan(snapshot.matrix.table).filter(group=>group.groupKey===snapshot.matrix.groupKey);
    if (groups.length !== 1 || groups[0].groupFingerprint!==snapshot.matrix.groupFingerprint) throw Error('矩阵题组、描述或量表列已变化，旧答案已作废。');
    return groups[0];
  }

  function outcome(group) {
    return group.rows.some(row=>row.selectedKeys.length===0) ? {advanced:true,withinPage:true} : {advanced:false};
  }

  async function apply(snapshot, answer, _settings, active) {
    const ready = async () => { if(typeof active!=='function' || !await active()) throw Error('已停止，未继续填写矩阵量表。'); };
    const assertRow = group => {
      const row=group.rows[snapshot.matrix.rowIndex];
      if(!row || row.fingerprint!==snapshot.fingerprint) throw Error('矩阵当前行已变化，旧答案已作废。');
      return row;
    };
    await ready();
    let group=currentGroup(snapshot), row=assertRow(group);
    A.parseAnswer(answer,row.question,true);
    if(answer.keys.length!==1) throw Error('矩阵量表每行只能选择一项。');
    if(row.selectedKeys.length) {
      if(row.selectedKeys[0]!==answer.keys[0]) throw Error('矩阵当前行已有不同选择，未覆盖已有作答。');
      return outcome(group);
    }
    await ready(); group=currentGroup(snapshot); row=assertRow(group);
    if(row.selectedKeys.length) {
      if(row.selectedKeys[0]!==answer.keys[0]) throw Error('矩阵当前行已由其他操作填写，未覆盖。');
      return outcome(group);
    }
    const target=row.options.find(option=>option.key===answer.keys[0])?.el;
    if(!target?.isConnected || target.disabled || target.querySelector('input')?.disabled || target.getAttribute('aria-disabled')==='true') throw Error('矩阵当前行的选项不可点击，未填写。');
    target.click();
    await new Promise(resolve=>setTimeout(resolve,100));
    await ready(); group=currentGroup(snapshot); row=assertRow(group);
    if(JSON.stringify(row.selectedKeys)!==JSON.stringify(answer.keys)) throw Error('矩阵当前行未确认预期选中状态，未切换下一行或翻页。');
    return outcome(group);
  }

  function next(snapshot, settings={}) {
    const group=currentGroup(snapshot);
    if(group.rows.some(row=>row.selectedKeys.length!==1)) return 'changed';
    let buttons;
    try { buttons=nodes(document,settings.selectors?.next || 'button,[role="button"],a'); }
    catch { throw Error('下一页选择器无效，请检查页面适配。'); }
    buttons=buttons.filter(el=>!el.disabled && el.getAttribute('aria-disabled')!=='true' && /^(下一页|下一题|下一步|继续|Next)$/i.test(text(el)));
    if(buttons.length>1) throw Error('存在多个下一页按钮，矩阵已完成但未翻页，请校准页面适配。');
    if(!buttons.length) return null;
    buttons[0].click();
    return 'clicked';
  }

  root.AssessmentPersonalityMatrixAdapter={read,apply,next};
})(globalThis);
