const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../shared.js');
require('../personality-data.js');
const P=require('../personality.js');
const question=(stem,texts,type='likert')=>({stem,type,options:texts.map((text,i)=>({key:String.fromCharCode(65+i),text}))});
const selected=(q,a)=>q.options.find(o=>o.key===a.keys[0]).text;
const outgoing={personalityPreset:'custom',personalityTraits:{E:5,A:4,C:5,S:5,O:4}};

test('three, four, five and seven-level agreement scales keep meaning when columns reorder',()=>{
  const scales=[
    ['不同意','中立','同意'],
    ['非常不同意','不同意','同意','非常同意'],
    ['非常不同意','不同意','中立','同意','非常同意'],
    ['非常不同意','不同意','有点不同意','中立','有点同意','同意','非常同意']
  ];
  for(const labels of scales){
    const q=question('我善于沟通。',labels), answer=P.solve(q,outgoing);
    assert.equal(selected(q,answer),labels.at(-1));assert.equal(answer.offline,true);assert.equal(answer.confidence,null);
    const reordered={...q,options:[...q.options].reverse().map((o,i)=>({...o,key:String.fromCharCode(65+i)}))};
    assert.equal(selected(reordered,P.solve(reordered,outgoing)),labels.at(-1));
    const negative={...q,stem:'我不善于沟通。'};
    assert.equal(selected(negative,P.solve(negative,outgoing)),labels[0]);
  }
});

test('frequency scales express positive and reverse self descriptions from the selected preferences',()=>{
  for(const labels of [
    ['从不','有时','总是'],['从不','偶尔','经常','总是'],
    ['从不','很少','有时','经常','总是'],['从不','极少','偶尔','有时','经常','通常','总是']
  ]){
    const q=question('我能保持冷静。',labels), negative=question('我容易焦虑。',labels);
    assert.equal(P.scaleOptions(q)[0].scaleFamily,'frequency');
    assert.equal(selected(q,P.solve(q,outgoing)),'总是');
    assert.equal(selected(negative,P.solve(negative,outgoing)),'从不');
    const reordered={...negative,options:[...negative.options].reverse()};
    assert.equal(selected(reordered,P.solve(reordered,outgoing)),'从不');
  }
});

test('scale recognition rejects duplicate meanings, mixed label families and bare numeric columns',()=>{
  for(const labels of [['不同意','不符合','同意'],['从不','中立','总是'],['1','2','3','4','5'],['甲','乙','丙']]){
    const q=question('我对自己的习惯有明确认识。',labels);
    assert.equal(P.scaleOptions(q),null);assert.equal(P.isSupportedPersonality(q),false);assert.throws(()=>P.solve(q));
  }
});

test('two through eight description pairs select distinct roles and preserve content after shuffling',()=>{
  for(let count=2;count<=8;count++)for(const strategy of ['positive','balanced','random']){
    const texts=Array.from({length:count},(_,i)=>'未收录的自我描述'+String.fromCharCode(65+i));
    const q=question('请选择最像和最不像自己的描述',texts,'forced_pair');
    const a=P.solve(q,{personalityStrategy:strategy});
    assert.equal(P.isSupportedPersonality(q),true);assert.notEqual(a.mostKey,a.leastKey);assert.equal(a.confidence,null);
    assert.ok(['unrecognized','random'].includes(a.strategyBasis));
    const reordered=question(q.stem,[...texts].reverse(),'forced_pair'),b=P.solve(reordered,{personalityStrategy:strategy});
    for(const role of ['mostKey','leastKey'])assert.equal(q.options.find(o=>o.key===a[role]).text,reordered.options.find(o=>o.key===b[role]).text);
  }
});

test('out-of-range pairs and strict unmatched descriptions remain explicit stops',()=>{
  for(const count of [1,9])assert.throws(()=>P.solve(question('请选择最像和最不像自己的描述',Array.from({length:count},(_,i)=>'描述'+i),'forced_pair')));
  assert.throws(()=>P.solve(question('请选择最像和最不像自己的描述',['未录入甲','未录入乙','未录入丙','未录入丁'],'forced_pair'),{personalityStrategy:'strict'}));
});

test('Chinese and English role aliases share the same direction including single least choices',()=>{
  for(const alias of ['最像','最像我','最符合自己','Most','Most like me'])assert.equal(P.forcedRole(alias),'most');
  for(const alias of ['最不像','最不像自己','最不符合本人','Least','Least like me'])assert.equal(P.forcedRole(alias),'least');
  const settings={personalityPreset:'custom',personalityRanking:'有计划性的\n焦虑的'};
  for(const stem of ['请选择最不像自己的一项','Select the description least like me']){
    const q=question(stem,['有计划性的','焦虑的'],'forced_choice');
    assert.equal(selected(q,P.solve(q,settings)),'焦虑的');
  }
});

test('unknown personal descriptions can use a disclosed strategy while ordinary unknown single choice cannot',()=>{
  const q=question('请选择最符合自己实际情况的描述',['陌生习惯甲','陌生习惯乙','陌生习惯丙'],'single_choice');
  assert.equal(P.isSupportedPersonality(q),true);
  assert.equal(P.solve(q).strategyBasis,'unrecognized');
  const plain={...q,stem:'请选择一个选项'};
  assert.equal(P.isSupportedPersonality(plain),false);assert.throws(()=>P.solve(plain),/不会把普通单选题随机填写/);
});

test('objective knowledge is rejected even with a personality type or self-report-looking answer labels',()=>{
  for(const q of [
    question('以下哪项最符合作者观点',['甲','乙','丙'],'forced_choice'),
    question('我计算 2 + 2 = 4，正确答案是什么？',['不同意','中立','同意']),
    question('根据图表计算结果',['从不','有时','总是']),
    question('请选择最符合自己的答案：2 + 2 = ?',['甲','乙','丙'],'forced_pair')
  ]){assert.equal(P.isSupportedPersonality(q),false);assert.throws(()=>P.solve(q),/知识|客观/);}
});

test('images, ranking and incomplete options cannot enter the offline strategy path',()=>{
  const base=question('请选择最符合自己的一项',['有计划的','焦虑的'],'forced_choice');
  for(const q of [{...base,images:['figure.png']},{...base,type:'rank'},{...base,type:'text_input'},
    {...base,options:[{key:'A',text:''},{key:'B',text:'焦虑的'}]}]){
    assert.equal(P.isSupportedPersonality(q),false);assert.throws(()=>P.solve(q));
  }
});

test('a matrix row can inherit an explicit self-report instruction without inventing one',()=>{
  const row=question('偏好方案甲',['不同意','中立','同意']);
  assert.equal(P.isSupportedPersonality({...row,personalityContext:'请按自己的实际情况评价以下描述'}),true);
  const objective=question('作者观点',['不同意','中立','同意']);
  assert.equal(P.isSupportedPersonality({...objective,personalityContext:'请按自己的实际情况评价'}),false);
});
