const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const A=require('../shared.js');
require('../personality-data.js');
require('../personality-open-data.js');
const P=require('../personality.js');
const original=require('../question-bank/questions.json');
const open=require('../question-bank/personality-open.json');
const sourcePath=path.resolve(__dirname,'../vendor/bigfive-source/ipip120-zh-cn-parsed.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sourceById=new Map(source.map(row=>[row.id,row]));

test('the active bank contains 100 legacy and 120 open self-report items, all accepted by the gate',()=>{
  assert.equal(original.questions.length,100);assert.equal(open.questions.length,120);
  const active=[...original.questions,...open.questions];
  A.validateBank({questions:active});
  assert.equal(new Set(active.map(q=>q.qid)).size,220);
  assert.ok(active.every(q=>A.isPersonality(q)));
  const rejected=active.filter(q=>!P.isSupportedPersonality(q)).map(q=>({qid:q.qid,reason:P.supportReason(q)}));
  assert.deepEqual(rejected,[], 'Active self-report items must either be supported or explicitly removed from the usable collection.');
});

test('all 120 imported texts and preference rules correspond to the fixed source records',()=>{
  assert.equal(source.length,120);
  const domains={};
  for(const q of open.questions){
    const upstream=sourceById.get(q.sourceQuestionId);
    assert.ok(upstream,q.qid);
    assert.equal(q.stem,upstream.text,q.qid);
    assert.equal(q.sourceDomain,upstream.domain,q.qid);
    assert.equal(q.keyed,upstream.keyed,q.qid);
    assert.equal(q.facet,upstream.facet,q.qid);
    assert.deepEqual(q.personalityRule,{axis:upstream.domain==='N'?'S':upstream.domain,
      positive:upstream.domain==='N'?upstream.keyed==='minus':upstream.keyed==='plus'},q.qid);
    assert.equal(q.answer,undefined,q.qid+' must not invent a correct answer');
    domains[upstream.domain]=(domains[upstream.domain]||0)+1;
  }
  assert.deepEqual(domains,{N:24,E:24,O:24,A:24,C:24});
});

test('neuroticism items invert their keyed direction when expressed as emotional stability',()=>{
  const rows=open.questions.filter(q=>q.sourceDomain==='N');
  assert.equal(rows.length,24);
  for(const q of rows){
    assert.equal(q.personalityRule.axis,'S');
    const upstream=sourceById.get(q.sourceQuestionId);
    assert.equal(q.personalityRule.positive,upstream.keyed!=='plus',q.qid);
  }
});

test('every open item maps both preference extremes through its exact positive or reverse rule',()=>{
  for(const q of open.questions)for(const level of [1,5]){
    const traits={E:3,A:3,C:3,S:3,O:3,[q.personalityRule.axis]:level};
    const answer=P.solve(q,{personalityPreset:'custom',personalityTraits:traits,personalityStrategy:'strict'});
    const expected=q.personalityRule.positive?level:6-level;
    assert.deepEqual(answer.keys,[expected===1?'A':'E'],q.qid+' at preference '+level);
    assert.equal(answer.method,'exact');assert.equal(answer.offline,true);assert.equal(answer.confidence,null);
    assert.equal(answer.source,'离线性格');
  }
});

test('all open-item extreme choices survive reversing the scale and changing displayed keys',()=>{
  for(const q of open.questions){
    const reordered={...q,options:[...q.options].reverse().map((option,index)=>({...option,key:'K'+index}))};
    const traits={E:3,A:3,C:3,S:3,O:3,[q.personalityRule.axis]:5};
    const settings={personalityPreset:'custom',personalityTraits:traits,personalityStrategy:'strict'};
    const old=P.solve(q,settings), changed=P.solve(reordered,settings);
    assert.equal(q.options.find(option=>option.key===old.keys[0]).text,
      reordered.options.find(option=>option.key===changed.keys[0]).text,q.qid);
  }
});

test('loading new metadata grows 80 rules to 200 once and preserves every original rule',()=>{
  const oldSource=fs.readFileSync(path.join(__dirname,'../personality-data.js'),'utf8');
  const newSource=fs.readFileSync(path.join(__dirname,'../personality-open-data.js'),'utf8');
  const context=vm.createContext({});
  vm.runInContext(oldSource,context);
  const before=JSON.parse(JSON.stringify(context.AssessmentPersonalityData));
  assert.equal(before.length,80);
  vm.runInContext(newSource,context);
  assert.equal(context.AssessmentPersonalityData.length,200);
  assert.deepEqual(JSON.parse(JSON.stringify(context.AssessmentPersonalityData.slice(0,80))),before);
  vm.runInContext(newSource,context);
  assert.equal(context.AssessmentPersonalityData.length,200);
  assert.equal(new Set(context.AssessmentPersonalityData.map(row=>row.qid)).size,200);
  const additions=context.AssessmentPersonalityData.slice(80);
  for(const q of open.questions){
    const row=additions.find(item=>item.qid===q.qid);
    assert.ok(row,q.qid);assert.equal(row.stem,q.stem);assert.equal(row.axis,q.personalityRule.axis);assert.equal(row.positive,q.personalityRule.positive);
  }
});
