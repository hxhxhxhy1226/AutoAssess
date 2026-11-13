const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared.js');
require('../personality-data.js');
const P = require('../personality.js');
const question = (texts, stem='请选择最符合和最不符合自己的描述', type='forced_pair') => ({stem,type,options:texts.map((text,i)=>({key:String.fromCharCode(65+i),text}))});
const custom = {personalityPreset:'custom',personalityRanking:'善于沟通的\n有计划性的\n焦虑的'};
const scale = stem => question(['非常不符合','不符合','一般符合','符合','非常符合'],stem,'likert');
test('three-choice assigns two distinct roles by description, independent of row order',()=>{
  const a=P.solve(question(['焦虑的','善于沟通的','有计划性的']),custom);
  assert.equal(a.mostKey,'B');assert.equal(a.leastKey,'A');assert.equal(a.offline,true);assert.equal(a.confidence,null);
  const b=P.solve(question(['有计划性的','焦虑的','善于沟通的']),custom);
  assert.equal(b.mostKey,'C');assert.equal(b.leastKey,'B');
});
test('most and least may not be equal, missing, or passed as an ordinary multi-choice answer',()=>{
  const q=question(['甲','乙','丙']);
  for(const data of [{keys:['A','B']},{keys:['A','B'],mostKey:'A',leastKey:'A'},{keys:['A','B'],mostKey:'A',leastKey:'C'}]) assert.throws(()=>A.parseAnswer({...data,confidence:1},q));
});
test('strict mode rejects unknown, negated and ambiguous phrases rather than assuming their rank',()=>{
  for(const texts of [['善于沟通的','有计划性的','未知描述'],['不善于沟通的','有计划性的','焦虑的']]) assert.throws(()=>P.solve(question(texts),{...custom,personalityStrategy:'strict'}),/尚未加入/);
  assert.throws(()=>P.solve(question(['沟通','善沟通','焦虑的']),{personalityStrategy:'strict',personalityPreset:'custom',personalityRanking:'沟通|善沟通\n焦虑的'}),/相同/);
});
test('single most-unlike question uses the least-ranked item; ordinary most-like uses first',()=>{
  const opts=['有计划性的','焦虑的','善于沟通的'];
  assert.deepEqual(P.solve(question(opts,'请选择最不符合自己的一项','forced_choice'),custom).keys,['B']);
  assert.deepEqual(P.solve(question(opts,'请选择更贴近你的一项','forced_choice'),custom).keys,['C']);
});
test('known likert positive and reverse items follow chosen traits rather than option position',()=>{
  const outgoing={personalityPreset:'custom',personalityTraits:{E:5,A:4,C:5,S:5,O:4}};
  assert.deepEqual(P.solve(scale('性格外向，喜欢交际'),outgoing).keys,['E']);
  const reversed=scale('性格外向，喜欢交际');reversed.options.reverse();
  assert.deepEqual(P.solve(reversed,outgoing).keys,['E']);
  assert.deepEqual(P.solve(scale('从容，善于处理压力'),outgoing).keys,['E']);
  assert.deepEqual(P.solve(scale('经历挫折后仍能保持积极心态'),outgoing).keys,['E']);
  assert.deepEqual(P.solve(scale('当众发言会让我十分紧张。'),outgoing).keys,['A']);
});
test('all 60 existing BFI questions have a matching explicit rule',()=>{
  const bank=require('../question-bank/questions.json');
  const bfi=bank.questions.filter(q=>q.qid.startsWith('bfi2-'));assert.equal(bfi.length,60);
  for(const q of bfi) assert.equal(P.solve(q,{personalityPreset:'outgoing_engineer'}).offline,true);
});
test('strict mode stops unlisted likert questions until an exact personal answer is configured',()=>{
  const q=scale('我偏好每周安排一天独立研究。');
  assert.throws(()=>P.solve(q,{personalityStrategy:'strict'}),/尚未收录/);
  assert.deepEqual(P.solve(q,{personalityStrategy:'strict',personalityAnswers:'我偏好每周安排一天独立研究。 => 符合'}).keys,['D']);
  assert.throws(()=>P.solve({...q,stem:'我不偏好每周安排一天独立研究。'},{personalityStrategy:'strict',personalityAnswers:'我偏好每周安排一天独立研究。 => 符合'}),/尚未收录/);
});
test('upstream adjective and categorized answer formats import without default fallback or test URL',()=>{
  const data=P.importConfig({test_url:'https://example.test',default_answer:'非常不符合',adjective_ranking:['有计划性的','焦虑的'],answer_categories:{符合:['我的测试题']}});
  assert.equal(data.personalityPreset,'custom');assert.equal(data.personalityAnswers,'我的测试题 => 符合');assert.equal(data.personalityRanking,'有计划性的\n焦虑的');
  assert.equal(data.test_url,undefined);assert.equal(data.default_answer,undefined);
  assert.equal(P.importConfig({question_answers:[{question_text:'测试',answer:'符合'}]}).personalityAnswers,'测试 => 符合');
});
test('invalid, conflicting or duplicated offline configuration is rejected',()=>{
  for(const c of [{personalityPreset:'custom',personalityTraits:{E:9}},{personalityPreset:'custom',personalityRanking:'外向\n外向'},{personalityAnswers:'题目 => 符合\n题目 => 不符合'},{personalityAnswers:'malformed'}]) assert.throws(()=>P.config(c));
  assert.throws(()=>P.importConfig({default_answer:'符合'}));
  assert.throws(()=>P.importConfig({answer_categories:{符合:'bad'}}));
});
test('offline answer cannot bypass model confidence validation unless explicitly allowed',()=>{
  const q=scale('性格外向，喜欢交际'),answer=P.solve(q,{});
  assert.throws(()=>A.parseAnswer(answer,q),/置信度/);
  assert.equal(A.parseAnswer(answer,q,true).offline,true);
});
test('semantic scale detection supports four or five choices and rejects arbitrary options',()=>{
  assert.ok(P.detect(question(['非常不同意','不同意','同意','非常同意'],'一个自我描述','single_choice')));
  assert.equal(P.detect(question(['甲','乙'],'计算题','single_choice')),false);
});
