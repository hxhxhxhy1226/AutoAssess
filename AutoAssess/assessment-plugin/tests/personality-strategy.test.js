const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared.js');
require('../personality-data.js');
const P = require('../personality.js');

const strategies = ['positive','balanced','random'];
const makeQuestion = (texts, type='single_choice', stem='最符合自己的描述是') => ({
  stem, type, options:texts.map((text,index)=>({key:String.fromCharCode(65+index),text}))
});
const likert = stem => makeQuestion(['非常不符合','不符合','一般符合','符合','非常符合'],'likert',stem);
const screenshotQuestion = makeQuestion(['能在压力下工作','能发现信息间的关联','能在期限前完成工作']);
const unrelatedRanking = {personalityPreset:'custom',personalityRanking:'善于沟通的\n有计划性的\n焦虑的'};

function validStrategyResult(answer, question, strategy) {
  assert.equal(answer.source,'离线性格');
  assert.equal(answer.offline,true);
  assert.equal(answer.confidence,null);
  assert.equal(answer.method,'strategy');
  assert.equal(answer.strategy,strategy);
  assert.ok(answer.explanation.trim());
  assert.equal(new Set(answer.keys).size,answer.keys.length);
  for(const key of answer.keys) assert.ok(question.options.some(option=>option.key===key));
  if(question.type==='forced_pair') {
    assert.equal(answer.keys.length,2);
    assert.notEqual(answer.mostKey,answer.leastKey);
    assert.ok(answer.keys.includes(answer.mostKey));
    assert.ok(answer.keys.includes(answer.leastKey));
  } else assert.equal(answer.keys.length,1);
}

test('default positive strategy answers the screenshot question without a matching answer or description',()=>{
  assert.equal(A.defaults.personalityStrategy,'positive');
  validStrategyResult(P.solve(screenshotQuestion,unrelatedRanking),screenshotQuestion,'positive');
});

test('each strategy supplies a legal single answer when every option is outside the rule vocabulary',()=>{
  for(const strategy of strategies) for(const type of ['single_choice','forced_choice']) {
    const q=makeQuestion(['未知描述甲壹','未知描述乙贰','未知描述丙叁'],type);
    validStrategyResult(P.solve(q,{personalityStrategy:strategy}),q,strategy);
  }
});

test('unlisted neutral likert statement uses affirmative positive and middle balanced policy',()=>{
  const q=likert('我对日常安排有自己的习惯。');
  const positive=P.solve(q,{personalityStrategy:'positive'});
  const balanced=P.solve(q,{personalityStrategy:'balanced'});
  validStrategyResult(positive,q,'positive');validStrategyResult(balanced,q,'balanced');
  assert.ok(['D','E'].includes(positive.keys[0]));
  assert.deepEqual(balanced.keys,['C']);
});

test('positive policy handles a simple negation without blindly agreeing with both statements',()=>{
  const positiveQuestion=likert('我善于沟通。');
  const negativeQuestion=likert('我不善于沟通。');
  const positive=P.solve(positiveQuestion,{personalityStrategy:'positive'});
  const negative=P.solve(negativeQuestion,{personalityStrategy:'positive'});
  validStrategyResult(positive,positiveQuestion,'positive');validStrategyResult(negative,negativeQuestion,'positive');
  const score=answer=>positiveQuestion.options.findIndex(option=>option.key===answer.keys[0]);
  assert.ok(score(positive)>score(negative));
});

test('likert strategy uses option meanings when their display order changes',()=>{
  const q=likert('我对日常安排有自己的习惯。');
  const shuffled={...q,options:[q.options[4],q.options[0],q.options[3],q.options[1],q.options[2]]};
  for(const strategy of ['positive','balanced']) {
    const first=P.solve(q,{personalityStrategy:strategy});
    const reordered=P.solve(shuffled,{personalityStrategy:strategy});
    assert.deepEqual(reordered.keys,first.keys);
  }
});

test('unknown three-choice descriptions always produce distinct most and least roles',()=>{
  for(const strategy of strategies) {
    for(const texts of [['未知描述甲壹','未知描述乙贰','未知描述丙叁'],['未知描述甲壹','善于沟通的','未知描述乙贰']]) {
      const q=makeQuestion(texts,'forced_pair','请选择最符合和最不符合自己的描述');
      for(let i=0;i<12;i++) validStrategyResult(P.solve(q,{...unrelatedRanking,personalityStrategy:strategy}),q,strategy);
    }
  }
});

test('explicit strict strategy keeps the original unknown-question stopping behavior',()=>{
  assert.throws(()=>P.solve(screenshotQuestion,{...unrelatedRanking,personalityStrategy:'strict'}));
  assert.throws(()=>P.solve(likert('一个全新的量表自述。'),{personalityStrategy:'strict'}));
  assert.throws(()=>P.solve(makeQuestion(['未知描述甲壹','未知描述乙贰','未知描述丙叁'],'forced_pair'),{personalityStrategy:'strict'}));
});

test('exact personal answer overrides positive, balanced and random fallback',()=>{
  for(const strategy of strategies) {
    const answer=P.solve(screenshotQuestion,{personalityStrategy:strategy,personalityAnswers:'最符合自己的描述是 => 能在期限前完成工作'});
    assert.deepEqual(answer.keys,['C']);assert.equal(answer.method,'exact');assert.equal(answer.strategy,strategy);
    assert.equal(answer.offline,true);assert.equal(answer.confidence,null);
  }
});

test('complete explicit ranking keeps its exact roles even when random fallback is selected',()=>{
  const q=makeQuestion(['有计划性的','焦虑的','善于沟通的'],'forced_pair');
  for(const strategy of strategies) {
    const answer=P.solve(q,{...unrelatedRanking,personalityStrategy:strategy});
    assert.equal(answer.mostKey,'C');assert.equal(answer.leastKey,'B');
    assert.equal(answer.method,'exact');assert.equal(answer.strategy,strategy);
  }
});

test('a tied exact ranking can use strategy fallback but must report it as a strategy',()=>{
  const q=makeQuestion(['沟通','善沟通','谨慎'],'forced_pair');
  for(const strategy of strategies) {
    const settings={personalityPreset:'custom',personalityRanking:'沟通|善沟通\n谨慎',personalityStrategy:strategy};
    validStrategyResult(P.solve(q,settings),q,strategy);
    assert.throws(()=>P.solve(q,{...settings,personalityStrategy:'strict'}));
  }
});

test('an explicit personal answer that is absent from the page is not silently replaced by a strategy',()=>{
  for(const strategy of strategies) assert.throws(()=>P.solve(screenshotQuestion,{
    personalityStrategy:strategy,personalityAnswers:'最符合自己的描述是 => 页面没有的选项'
  }));
});

test('strategy fallback does not turn unsupported or image questions into blind clicks',()=>{
  for(const strategy of strategies) {
    const settings={personalityStrategy:strategy};
    assert.throws(()=>P.solve({...screenshotQuestion,images:['https://example.test/image.png']},settings));
    for(const type of ['multi_choice','rank','text_input']) assert.throws(()=>P.solve({...screenshotQuestion,type},settings));
    assert.throws(()=>P.solve(makeQuestion(['甲','乙','丙','丁','戊','己','庚','辛','壬'],'forced_pair'),settings));
  }
});

test('unknown or ambiguous question types cannot reach fallback or a personal exact answer',()=>{
  for(const type of [undefined,'future_multi_step','P_FORCED_PAIR','sjt']) {
    const q={...screenshotQuestion,type};
    for(const strategy of strategies) {
      assert.throws(()=>P.solve(q,{personalityStrategy:strategy}),/题型|支持/);
      assert.throws(()=>P.solve(q,{
        personalityStrategy:strategy,personalityAnswers:'最符合自己的描述是 => 能在期限前完成工作'
      }),/题型|支持/);
    }
  }
});

test('supported legacy personality types still produce a legal single answer',()=>{
  for(const strategy of strategies) {
    for(const q of [{...screenshotQuestion,type:'P_FORCED'},{...likert('一个新的量表自述。'),type:'P_LIKERT'}]) {
      validStrategyResult(P.solve(q,{personalityStrategy:strategy}),q,strategy);
    }
  }
});

test('duplicate option keys are rejected before solving or applying single and pair answers',()=>{
  for(const type of ['single_choice','forced_pair']) {
    const q={...screenshotQuestion,type,options:[
      {key:'A',text:'未知甲'},{key:'A',text:'未知乙'},{key:'C',text:'未知丙'}
    ]};
    for(const strategy of strategies) assert.throws(()=>P.solve(q,{personalityStrategy:strategy}),/选项/);
    const answer=type==='forced_pair'
      ? {keys:['A','C'],mostKey:'A',leastKey:'C',confidence:1}
      : {keys:['A'],confidence:1};
    assert.throws(()=>A.parseAnswer(answer,q),/选项/);
    assert.throws(()=>A.parseAnswer({...answer,offline:true,source:'离线性格',confidence:null},q,true),/选项/);
  }
});

test('incomplete option sets and invalid keys cannot be accepted as strategy answers',()=>{
  const validOptions=screenshotQuestion.options;
  const malformedSets=[
    [],validOptions.slice(0,1),
    Array.from({length:31},(_,i)=>({key:`option-${i}`,text:`描述 ${i}`})),
    ...['',' ',42,null,undefined].map(key=>[{...validOptions[0],key},...validOptions.slice(1)]),
    [null,...validOptions.slice(1)]
  ];
  for(const options of malformedSets) {
    const q={...screenshotQuestion,options};
    assert.throws(()=>P.solve(q),/选项/);
    assert.throws(()=>A.parseAnswer({keys:['B'],confidence:1},q),/选项/);
  }
});

test('repeated descriptions with distinct controls allow strategy but not ambiguous exact matching',()=>{
  for(const type of ['single_choice','forced_pair']) {
    const q=makeQuestion(['未收录的相同描述','未收录的相同描述','未收录的相同描述'],type);
    for(const strategy of strategies) validStrategyResult(P.solve(q,{personalityStrategy:strategy}),q,strategy);
  }
  const q=makeQuestion(['未收录的相同描述','未收录的相同描述','其他描述']);
  assert.throws(()=>P.solve(q,{personalityAnswers:'最符合自己的描述是 => 未收录的相同描述'}),/唯一/);
});
