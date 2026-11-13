const demo = {
  index:0, focus:'', most:'', least:'', history:[], completed:false, scaleResponses:{},
  questions:[], scaleRows:['我会按时完成任务。','我容易紧张。']
};
const demoEl = id => document.getElementById(id);
const demoParams = new URLSearchParams(location.search);
demoEl('layout').value = ['matrix','shared','scale','page'].includes(demoParams.get('layout')) ? demoParams.get('layout') : 'matrix';
demoEl('choiceCount').value = demoParams.get('size') === '4' ? '4' : '3';
function demoQuestions() {
  return demoEl('choiceCount').value === '4'
    ? [['善于沟通的','有计划性的','乐观的','焦虑的'],['焦虑的','乐观的','善于沟通的','有计划性的'],['乐观的','严谨的','内向的','友善的']]
    : [['善于沟通的','有计划性的','焦虑的'],['焦虑的','善于沟通的','有计划性的'],['乐观的','严谨的','内向的']];
}
function completeDemo() {
  if (demo.completed) return;
  demo.completed = true;
  const message = demoEl('demoMessage');
  message.textContent = '本场性格练习已完成，仅保存在当前页面。可点击“重新练习”开始新的一轮。';
  message.dataset.personalityComplete = 'true';
  demoEl('demoQuestion').querySelectorAll('input,button').forEach(control => control.disabled = true);
  demoEl('demoProgress').textContent = `已确认 ${demo.history.length} ${demoEl('layout').value === 'scale' ? '行' : '题'} · 本场完成`;
}
function assignDemo(role,key) {
  if (demo.completed) return;
  demo[role] = key;
  const opposite = role === 'most' ? 'least' : 'most';
  if (demo[opposite] === key) demo[opposite] = '';
  for (const item of document.querySelectorAll('[data-forced-row],.adjective-item')) {
    const assigned = demo.most === item.dataset.key ? 'most' : demo.least === item.dataset.key ? 'least' : '';
    if (assigned) item.dataset.assigned = assigned; else delete item.dataset.assigned;
    item.querySelectorAll('input').forEach(input => input.checked = input.dataset.choice === assigned);
    const label = item.querySelector('[data-role="assignment"]');
    if (label) label.textContent = assigned === 'most' ? '最符合' : assigned === 'least' ? '最不符合' : '';
  }
}
function renderScale(area) {
  area.dataset.qid = 'frequency-demo'; area.dataset.type = 'likert_matrix';
  const title = document.createElement('h2'); title.className = 'question-title';
  title.textContent = '请按自己的实际情况，逐行选择发生频率'; area.append(title);
  const levels = ['从不','很少','有时','经常','总是'];
  const table = document.createElement('table'); table.className = 'likert-matrix';
  table.dataset.personalityMatrix = ''; table.dataset.qid = 'frequency-demo';
  table.innerHTML = '<caption>请按自己的实际情况，分别评价以下描述。每行只选一个频率。</caption><thead><tr><th>描述</th>'
    + levels.map(level=>'<th>'+level+'</th>').join('') + '</tr></thead><tbody></tbody>';
  demo.scaleRows.forEach((stem,index) => {
    const row = document.createElement('tr'); row.dataset.rowId = String(index+1);
    const description = document.createElement('td'); description.textContent = stem; row.append(description);
    levels.forEach((level,position) => {
      const cell = document.createElement('td'), label = document.createElement('label'), input = document.createElement('input');
      input.type = 'radio'; input.name = 'frequency-'+(index+1); input.value = String.fromCharCode(65+position);
      input.setAttribute('aria-label',level);
      input.addEventListener('click',()=>{
        if (demo.completed) return;
        demo.scaleResponses[index+1] = input.value;
        demoEl('demoProgress').textContent = `共 ${demo.scaleRows.length} 行 · 已选择 ${Object.keys(demo.scaleResponses).length} 行`;
      });
      label.append(input); cell.append(label); row.append(cell);
    });
    table.querySelector('tbody').append(row);
  });
  area.append(table);
  const next = document.createElement('button'); next.id = 'confirmDemo'; next.className = 'button primary'; next.textContent = '下一页';
  next.addEventListener('click',()=>{
    if (demo.completed) return;
    const rows = [...table.querySelectorAll('tbody tr')];
    if (rows.some(row=>row.querySelectorAll('input:checked').length!==1)) {
      demoEl('demoMessage').textContent = '请先为每一行选择一个频率，再进入下一页。'; return;
    }
    demo.history = rows.map((row,index)=>({qid:'frequency-demo::row-'+(index+1),key:row.querySelector('input:checked').value}));
    completeDemo();
  });
  area.append(next); demoEl('demoProgress').textContent = `共 ${demo.scaleRows.length} 行 · 已选择 0 行`;
}
function renderPage(area) {
  delete area.dataset.qid; delete area.dataset.type;
  const questions = [
    {qid:'page-demo-1',type:'likert',stem:'我会按时完成任务。',options:['非常不符合','不符合','一般符合','符合','非常符合']},
    {qid:'page-demo-2',type:'likert',stem:'我容易焦虑。',options:['总是','经常','偶尔','从不']},
    {qid:'page-demo-3',type:'forced_choice',stem:'下面哪条更符合你？',options:['我喜欢主动沟通和团队合作。','我喜欢独立工作和安静思考。']}
  ];
  const progress = () => {
    const answered = area.querySelectorAll('.page-question input:checked').length;
    demoEl('demoProgress').textContent = `同页共 ${questions.length} 题 · 已选择 ${answered} 题`;
  };
  questions.forEach((question,index) => {
    const section = document.createElement('section'); section.className = 'page-question question-container';
    section.dataset.qid = question.qid; section.dataset.type = question.type;
    const number = document.createElement('p'); number.className = 'hint'; number.textContent = `第 ${index+1} 题`;
    const title = document.createElement('h3'); title.className = 'question-title'; title.textContent = question.stem;
    section.append(number,title);
    question.options.forEach((text,position) => {
      const label = document.createElement('label'); label.className = 'practice-option';
      label.dataset.role = 'option'; label.dataset.key = String.fromCharCode(65+position);
      const input = document.createElement('input'); input.type = 'radio'; input.name = question.qid; input.value = label.dataset.key;
      input.addEventListener('change',()=>{ if (!demo.completed) { progress(); demoEl('demoMessage').textContent = ''; } });
      const span = document.createElement('span'); span.textContent = text; label.append(input,span); section.append(label);
    });
    area.append(section);
  });
  const next = document.createElement('button'); next.id = 'confirmDemo'; next.className = 'button primary'; next.textContent = '下一页';
  next.addEventListener('click',()=>{
    if (demo.completed) return;
    const sections = [...area.querySelectorAll('.page-question')];
    if (sections.some(section=>section.querySelectorAll('input:checked').length!==1)) {
      demoEl('demoMessage').textContent = '请先完成本页全部三道题，再进入下一页。'; return;
    }
    demo.history = sections.map(section=>({qid:section.dataset.qid,key:section.querySelector('input:checked').value}));
    completeDemo();
  });
  area.append(next); progress();
}
function renderDemo() {
  const area = demoEl('demoQuestion'), message = demoEl('demoMessage');
  area.replaceChildren(); message.textContent = ''; delete message.dataset.personalityComplete;
  demo.completed = false; demo.focus = demo.most = demo.least = ''; demo.scaleResponses = {};
  const scale = demoEl('layout').value === 'scale', page = demoEl('layout').value === 'page';
  demoEl('choiceCountField').hidden = scale || page; area.classList.toggle('question-container',!page);
  if (page) { renderPage(area); return; }
  if (scale) { renderScale(area); return; }
  demo.questions = demoQuestions(); area.dataset.qid = 'forced-demo-'+(demo.index+1); area.dataset.type = 'forced_pair';
  demoEl('demoProgress').textContent = `第 ${demo.index+1} / ${demo.questions.length} 题 · 已确认 ${demo.history.length} 题`;
  const title = document.createElement('h2'); title.className = 'question-title'; title.textContent = '请选择最符合和最不符合自己的描述'; area.append(title);
  const rows = demo.questions[demo.index];
  if (demoEl('layout').value === 'matrix') {
    const order = demo.index % 2 ? ['least','most'] : ['most','least'];
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>描述</th>${order.map(role=>`<th>${role==='most'?'最符合':'最不符合'}</th>`).join('')}</tr></thead><tbody></tbody>`;
    rows.forEach((text,index) => {
      const row = document.createElement('tr'); row.dataset.forcedRow = ''; row.dataset.key = String.fromCharCode(65+index);
      const cell = document.createElement('td'); cell.dataset.role = 'trait'; cell.textContent = text; row.append(cell);
      for (const role of order) {
        const td = document.createElement('td'), label = document.createElement('label'), input = document.createElement('input');
        input.type = 'radio'; input.name = role; input.dataset.choice = role; input.value = row.dataset.key;
        input.setAttribute('aria-label',role==='most'?'最符合':'最不符合');
        input.addEventListener('click',()=>assignDemo(role,row.dataset.key)); label.append(input); td.append(label); row.append(td);
      }
      table.querySelector('tbody').append(row);
    }); area.append(table);
  } else {
    rows.forEach((text,index)=>{
      const card = document.createElement('div'); card.className = 'adjective-item'; card.dataset.key = String.fromCharCode(65+index); card.tabIndex = 0;
      const word = document.createElement('span'); word.className = 'adjective-text'; word.textContent = text;
      const assigned = document.createElement('span'); assigned.dataset.role = 'assignment'; card.append(word,assigned);
      card.addEventListener('click',()=>{
        if (demo.completed) return;
        demo.focus = card.dataset.key; document.querySelectorAll('.adjective-item').forEach(node=>node.classList.toggle('focus',node===card));
      }); area.append(card);
    });
    const controls = document.createElement('div'); controls.className = 'pair-actions';
    for (const role of ['most','least']) {
      const button = document.createElement('button'); button.className = 'button light'; button.textContent = role==='most'?'最符合':'最不符合';
      button.addEventListener('click',()=>{if(demo.focus)assignDemo(role,demo.focus);}); controls.append(button);
    } area.append(controls);
  }
  const next = document.createElement('button'); next.id = 'confirmDemo'; next.className = 'button primary'; next.textContent = '确认本题';
  next.addEventListener('click',()=>{
    if (demo.completed) return;
    if (!demo.most || !demo.least || demo.most===demo.least) { message.textContent='请先完成两个不同的选择。'; return; }
    demo.history.push({qid:area.dataset.qid,most:demo.most,least:demo.least});
    if (demo.index<demo.questions.length-1) { demo.index++; renderDemo(); } else completeDemo();
  }); area.append(next);
}
function resetPersonalityDemo() {
  demo.index=0; demo.history=[]; renderDemo();
}
demoEl('layout').addEventListener('change',resetPersonalityDemo);
demoEl('choiceCount').addEventListener('change',resetPersonalityDemo);
demoEl('resetDemo').addEventListener('click',resetPersonalityDemo);
renderDemo();
