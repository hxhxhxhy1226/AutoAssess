const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared.js');
require('../personality-data.js');
const P = require('../personality.js');

const makeQuestion = (texts, type='single_choice', stem='最符合自己的描述是') => ({
  stem, type, options:texts.map((text,index)=>({key:String.fromCharCode(65+index),text}))
});
const firstScreenshot = makeQuestion(['能在压力下工作','能发现信息间的关联','能在期限前完成工作']);
const secondScreenshot = makeQuestion(['面对困难不轻易放弃','能够理性地处理工作','深入探索研究新知识']);
const likert = stem => makeQuestion(['非常不符合','不符合','一般符合','符合','非常符合'],'likert',stem);
const chosenText = (question, answer, role) => question.options.find(option=>option.key===(role ? answer[role] : answer.keys[0])).text;
const shuffled = (question, texts) => makeQuestion(texts,question.type,question.stem);

function checkStrategy(answer, question, basis) {
  assert.equal(answer.source,'离线性格');
  assert.equal(answer.offline,true);
  assert.equal(answer.confidence,null);
  assert.equal(answer.method,'strategy');
  assert.ok(['traits','scale','random','tie','unrecognized'].includes(answer.strategyBasis));
  if(basis) assert.equal(answer.strategyBasis,basis);
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

test('first screenshot scores deadline reliability above stability and information exploration for the default preset',()=>{
  const answer=P.solve(firstScreenshot);
  checkStrategy(answer,firstScreenshot,'traits');
  assert.equal(chosenText(firstScreenshot,answer),'能在期限前完成工作');
});

test('second screenshot recognizes persistence without interpreting not giving up as a negative trait',()=>{
  const answer=P.solve(secondScreenshot);
  checkStrategy(answer,secondScreenshot,'traits');
  assert.equal(chosenText(secondScreenshot,answer),'面对困难不轻易放弃');
});

test('two through five choices preserve chosen content after reordering and reassigning option keys',()=>{
  const pool=['能在期限前完成工作','能在压力下工作','能发现信息间的关联','我性格内向，喜欢独处','工作时经常拖延'];
  for(let count=2;count<=5;count++) {
    const texts=pool.slice(0,count), q=makeQuestion(texts);
    for(const strategy of ['positive','balanced','random']) {
      const settings={personalityStrategy:strategy};
      const first=P.solve(q,settings);
      checkStrategy(first,q);
      for(const reordered of [[...texts].reverse(),[...texts.slice(1),texts[0]]]) {
        const nextQuestion=shuffled(q,reordered);
        const next=P.solve(nextQuestion,settings);
        checkStrategy(next,nextQuestion);
        assert.equal(chosenText(nextQuestion,next),chosenText(q,first));
      }
    }
  }
});

test('four-choice descriptions respond to changing the extroversion preset and remain single choice',()=>{
  const q=makeQuestion(['我性格外向，喜欢主动沟通','我性格内向，喜欢独处','工作时经常拖延','遇到变化容易焦虑']);
  const outgoing=P.solve(q,{personalityPreset:'outgoing_engineer'});
  const careful=P.solve(q,{personalityPreset:'careful'});
  checkStrategy(outgoing,q,'traits');checkStrategy(careful,q,'traits');
  assert.equal(chosenText(q,outgoing),'我性格外向，喜欢主动沟通');
  assert.equal(chosenText(q,careful),'我性格内向，喜欢独处');
});

test('description analysis exposes matched traits and evidence instead of a bare option position',()=>{
  const cases=[['能在压力下工作','S',5],['能发现信息间的关联','O',5],['能在期限前完成工作','C',5]];
  for(const [text,axis,level] of cases) {
    const result=P.analyzeDescription(text);
    assert.equal(result.traits[axis],level);
    assert.ok(Array.isArray(result.evidence));
    assert.ok(result.evidence.some(item=>item.axis===axis && item.level===level && typeof item.phrase==='string' && item.phrase.length>0));
    for(const value of Object.values(result.traits)) assert.ok(Number.isFinite(value) && value>=1 && value<=5);
  }
});

test('simple and double negation change communication direction while not only stays affirmative',()=>{
  for(const [text,expected] of [
    ['善于沟通',5],['不善于沟通',1],['不是不善于沟通',5],['不但善于沟通，而且愿意倾听',5]
  ]) assert.equal(P.analyzeDescription(text).traits.E,expected,text);
});

test('negating anxiety and procrastination reverses their negative trait directions',()=>{
  for(const [text,axis,expected] of [
    ['容易焦虑','S',1],['不容易焦虑','S',5],['经常拖延','C',1],['从不拖延','C',5],['面对困难不轻易放弃','C',5]
  ]) assert.equal(P.analyzeDescription(text).traits[axis],expected,text);
});

test('not worrying excessively remains a negated stability phrase instead of a contrast clause',()=>{
  assert.equal(P.analyzeDescription('过度担心').traits.S,1);
  for(const text of ['不过度担心','从不过度担心']) {
    assert.equal(P.analyzeDescription(text).traits.S,5,text);
  }
});

test('a newline ends the previous clause before normalization can spread its negation',()=>{
  for(const text of ['我不这样\n善于沟通','我不这样\r\n善于沟通']) {
    assert.equal(P.analyzeDescription(text).traits.E,5,text);
  }
});

test('contrast and additive clauses do not carry a prior negation into an affirmative trait',()=>{
  for(const text of ['我不喜欢打断别人但善于沟通','我不会被困难吓倒而且善于沟通']) {
    assert.equal(P.analyzeDescription(text).traits.E,5,text);
  }
  const notOnly=P.analyzeDescription('不但善于沟通而且愿意倾听');
  assert.equal(notOnly.traits.E,5);
  assert.equal(notOnly.traits.A,5);
});

test('simple coordinated traits inherit shared negation while an affirmative pair stays positive',()=>{
  for(const text of ['不善于沟通和团队合作','不善于沟通与团队合作','不善于沟通及团队合作']) {
    const result=P.analyzeDescription(text);
    assert.equal(result.traits.E,1,text);
    assert.equal(result.traits.A,1,text);
  }
  const affirmative=P.analyzeDescription('善于沟通和团队合作');
  assert.equal(affirmative.traits.E,5);
  assert.equal(affirmative.traits.A,5);
});

test('balanced unknown likert policy moves closer to the middle than a strong conscientiousness preference',()=>{
  const q=likert('我能在期限前完成工作');
  const positive=P.solve(q,{personalityPreset:'outgoing_engineer',personalityStrategy:'positive'});
  const balanced=P.solve(q,{personalityPreset:'outgoing_engineer',personalityStrategy:'balanced'});
  checkStrategy(positive,q,'scale');checkStrategy(balanced,q,'scale');
  const level=answer=>P.scaleOptions(q).find(option=>option.key===answer.keys[0]).score;
  assert.ok(Math.abs(level(balanced)-0.5)<Math.abs(level(positive)-0.5));
});

test('most unlike selects the least matching recognized description instead of the most matching one',()=>{
  const q=makeQuestion(['能在期限前完成工作','能在压力下工作','工作时经常拖延'],'single_choice','最不符合选项是');
  const answer=P.solve(q);
  checkStrategy(answer,q,'traits');
  assert.equal(chosenText(q,answer),'工作时经常拖延');
});

test('three-choice two-role scoring keeps distinct best and worst content after row reordering',()=>{
  const q=makeQuestion(['能在期限前完成工作','能在压力下工作','工作时经常拖延'],'forced_pair','选择最符合和最不符合的描述');
  const first=P.solve(q);
  checkStrategy(first,q,'traits');
  assert.equal(chosenText(q,first,'mostKey'),'能在期限前完成工作');
  assert.equal(chosenText(q,first,'leastKey'),'工作时经常拖延');
  const reordered=shuffled(q,[...q.options].reverse().map(option=>option.text));
  const next=P.solve(reordered);
  checkStrategy(next,reordered,'traits');
  assert.equal(chosenText(reordered,next,'mostKey'),chosenText(q,first,'mostKey'));
  assert.equal(chosenText(reordered,next,'leastKey'),chosenText(q,first,'leastKey'));
});

test('a mixed unknown description is not automatically assigned the least fitting role',()=>{
  const texts=['能在期限前完成工作','能在压力下工作','未登记甲壹'];
  const pair=makeQuestion(texts,'forced_pair','选择最符合和最不符合的描述');
  const pairAnswer=P.solve(pair);
  checkStrategy(pairAnswer,pair,'traits');
  assert.equal(chosenText(pair,pairAnswer,'mostKey'),texts[0]);
  assert.equal(chosenText(pair,pairAnswer,'leastKey'),texts[1]);
  const single=makeQuestion(texts,'single_choice','最不符合选项是');
  const singleAnswer=P.solve(single);
  checkStrategy(singleAnswer,single,'traits');
  assert.equal(chosenText(single,singleAnswer),texts[1]);
});

test('fewer than two recognized descriptions use an explicitly unrecognized fallback with legal roles',()=>{
  for(const type of ['single_choice','forced_pair']) {
    for(const texts of [['能在期限前完成工作','未登记甲壹','未登记乙贰'],['未登记甲壹','未登记乙贰','未登记丙叁']]) {
      const q=makeQuestion(texts,type);
      const first=P.solve(q);
      checkStrategy(first,q,'unrecognized');
      const again=P.solve(q);
      assert.deepEqual(again.keys,first.keys);
      const nextQuestion=shuffled(q,[...texts].reverse());
      const next=P.solve(nextQuestion);
      checkStrategy(next,nextQuestion,'unrecognized');
      for(const role of type==='forced_pair' ? ['mostKey','leastKey'] : [null]) {
        assert.equal(chosenText(nextQuestion,next,role),chosenText(q,first,role));
      }
    }
  }
});

test('unrecognized descriptions across thirty different questions are not forced to the second position',()=>{
  const positions=new Set();
  for(let index=0;index<30;index++) {
    const q=makeQuestion(['未登记甲壹','未登记乙贰','未登记丙叁'],'single_choice',`第${index+1}题：最符合自己的描述是`);
    const answer=P.solve(q);
    checkStrategy(answer,q,'unrecognized');
    positions.add(q.options.findIndex(option=>option.key===answer.keys[0]));
  }
  assert.ok(positions.size>1,'different question identities should not all collapse to one fixed position');
});

test('ties in a complete custom ranking stay within the permitted rank groups with stable role selection',()=>{
  const q=makeQuestion(['甲壹描述','乙贰描述','丙叁描述'],'forced_pair','选择最符合和最不符合自己的描述');
  const settings={personalityPreset:'custom',personalityRanking:'甲壹描述|乙贰描述\n丙叁描述'};
  const first=P.solve(q,settings);
  checkStrategy(first,q,'tie');
  assert.ok(['甲壹描述','乙贰描述'].includes(chosenText(q,first,'mostKey')));
  assert.equal(chosenText(q,first,'leastKey'),'丙叁描述');
  const nextQuestion=shuffled(q,['丙叁描述','乙贰描述','甲壹描述']);
  const next=P.solve(nextQuestion,settings);
  checkStrategy(next,nextQuestion,'tie');
  assert.equal(chosenText(nextQuestion,next,'mostKey'),chosenText(q,first,'mostKey'));
  assert.equal(chosenText(nextQuestion,next,'leastKey'),chosenText(q,first,'leastKey'));
});

test('exact personal answers and complete custom rankings retain precedence over content scoring',()=>{
  for(const strategy of ['positive','balanced','random','strict']) {
    const personal=P.solve(firstScreenshot,{personalityStrategy:strategy,personalityAnswers:'最符合自己的描述是 => 能在压力下工作'});
    assert.equal(personal.method,'exact');
    assert.equal(chosenText(firstScreenshot,personal),'能在压力下工作');
    const ranked=P.solve(firstScreenshot,{
      personalityStrategy:strategy,personalityPreset:'custom',
      personalityRanking:'能发现信息间的关联\n能在压力下工作\n能在期限前完成工作'
    });
    assert.equal(ranked.method,'exact');
    assert.equal(chosenText(firstScreenshot,ranked),'能发现信息间的关联');
  }
});

test('strict mode stays exact only even when new phrase scoring recognizes the descriptions',()=>{
  assert.throws(()=>P.solve(firstScreenshot,{personalityStrategy:'strict'}),/严格|匹配|排序/);
  assert.throws(()=>P.solve(secondScreenshot,{personalityStrategy:'strict'}),/严格|匹配|排序/);
  assert.throws(()=>P.solve(likert('我能在期限前完成工作'),{personalityStrategy:'strict'}),/严格|匹配|收录/);
});

test('strategy basis survives answer validation without inventing a model confidence',()=>{
  const answer=P.solve(firstScreenshot);
  const parsed=A.parseAnswer(answer,firstScreenshot,true);
  assert.equal(parsed.strategyBasis,'traits');
  assert.equal(parsed.method,'strategy');
  assert.equal(parsed.offline,true);
  assert.equal(parsed.confidence,null);
});
