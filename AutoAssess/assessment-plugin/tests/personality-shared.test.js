const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared.js');

const question = {
  type: 'forced_pair', stem: '请选择最像和最不像自己的描述',
  options: [{key:'A',text:'有计划的'},{key:'B',text:'焦虑的'},{key:'C',text:'善于沟通的'}]
};
const answer = {keys:['A','B'],mostKey:'A',leastKey:'B',source:'离线性格',offline:true,confidence:null};

test('upgrading obsolete settings preserves personal preferences without restoring providers or remote banks', () => {
  const stored = {
    taskMode:'auto', bankSource:'local', mode:'auto',
    apiBase:'https://obsolete.example/v1', apiKey:'old-test-credential', model:'retired',
    apiProfiles:[{id:'old',apiKey:'old-test-credential'}], confidence:.9,
    bankUrl:'http://127.0.0.1:8765/api/questions', mobileEnabled:true,
    personalityPreset:'custom', personalityTraits:{E:2,A:4,C:5,S:3,O:4},
    personalityAnswers:'我喜欢独处 => 符合', personalityRanking:'有计划的\n焦虑的',
    selectors:{question:'.current-question',obsolete:'unused'}
  };
  const original = structuredClone(stored), current = A.settings(stored);
  assert.equal(current.taskMode,'personality'); assert.equal(current.bankSource,'bundled');
  assert.equal(current.mode,'auto'); assert.deepEqual(current.personalityTraits,stored.personalityTraits);
  assert.equal(current.personalityAnswers,stored.personalityAnswers);
  assert.equal(current.personalityRanking,stored.personalityRanking);
  assert.equal(current.selectors.question,'.current-question');
  for(const field of ['apiBase','apiKey','model','apiProfiles','confidence','bankUrl','mobileEnabled']) {
    assert.equal(Object.hasOwn(current,field),false);
    assert.equal(Object.hasOwn(A.defaults,field),false);
  }
  assert.equal(Object.hasOwn(current.selectors,'obsolete'),false);
  current.personalityTraits.E=5; current.selectors.question='.different';
  assert.deepEqual(stored,original);
});

test('malformed saved settings do not break defaults or share mutable settings across runs', () => {
  for(const value of [null,[],42,'obsolete']) assert.equal(A.settings(value).taskMode,'personality');
  const current=A.settings({mode:'retired',dwellSec:NaN,personalityTraits:null,selectors:{question:12}});
  assert.equal(current.mode,'manual'); assert.equal(current.dwellSec,5);
  assert.deepEqual(current.personalityTraits,{}); assert.equal(current.selectors.question,'');
  current.personalityTraits.E=5;current.selectors.question='.changed';
  assert.deepEqual(A.settings().personalityTraits,{});assert.equal(A.settings().selectors.question,'');
});

test('a claimed offline result still needs explicit permission, a matching source, and distinct valid roles', () => {
  assert.throws(()=>A.parseAnswer(answer,question),/校验/);
  assert.throws(()=>A.parseAnswer({...answer,source:'untrusted'},question,true),/校验/);
  assert.throws(()=>A.parseAnswer({...answer,keys:['A','A'],leastKey:'A'},question,true),/选项/);
  assert.throws(()=>A.parseAnswer({...answer,leastKey:'C'},question,true),/不同/);
  assert.throws(()=>A.parseAnswer({...answer,keys:['A','Z'],leastKey:'Z'},question,true),/选项/);
  const parsed=A.parseAnswer(answer,question,true);
  assert.equal(parsed.offline,true);assert.equal(parsed.confidence,null);
  assert.equal(parsed.mostKey,'A');assert.equal(parsed.leastKey,'B');
  assert.throws(()=>A.parseAnswer('{broken',question,true),error=>!/模型|AI/.test(error.message));
});

test('bundled personality records retain validation and accurate collection counts after shared cleanup', () => {
  const original=require('../question-bank/questions.json').questions;
  const open=require('../question-bank/personality-open.json').questions;
  const payload={questions:[...original,...open]}, before=JSON.stringify(payload);
  A.validateBank(payload);
  const stats=A.bankStats(payload);
  assert.equal(stats.total,220);assert.equal(stats.images,0);
  assert.equal(stats.collections.original,100);assert.equal(stats.collections['ipip-neo-120'],120);
  assert.equal(Object.values(stats.types).reduce((sum,count)=>sum+count,0),220);
  assert.equal(JSON.stringify(payload),before);
  assert.throws(()=>A.validateBank({questions:[original[0],original[0]]}),/重复/);
});
