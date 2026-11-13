const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared.js');
const P = require('../personality.js');
const texts = ['行事干脆果断', '乐于与人交往', '行事颇有远见'];
const question = (stem, extra={}) => ({stem, type:'forced_choice',
  options:texts.map((text,i)=>({key:String.fromCharCode(65+i),text})), ...extra});

test('short screenshot wording inherits personality context while preserving most/least direction', () => {
  const most = question('最符合选项是'), least = question('最不符合选项是');
  assert.throws(()=>P.solve(most), /没有识别/);
  const settings = {personalityPreset:'custom',personalityRanking:texts.join('\n'),personalityStrategy:'strict'};
  for(const [q,expected] of [[most,'A'],[least,'C']]){
    const contextual = {...q,personalitySurveyTitle:'北森性格测试'};
    assert.equal(P.solve(contextual, settings).keys[0],expected);
    assert.equal(P.solve(contextual).offline,true);
  }
});

test('survey titles cannot supply another question role or override an objective stem', () => {
  const extra = {personalitySurveyTitle:'性格测试：最符合 / 最不符合', type:'single_choice'};
  for(const stem of ['您的性别：','请选择一个选项','最符合作者观点的选项是']){
    const q = question(stem,{...extra,options:[{key:'A',text:'甲'},{key:'B',text:'乙'}]});
    assert.equal(P.isSupportedPersonality(q),false,stem);
    assert.throws(()=>P.solve(q));
  }
});

test('the evidence that classifies a short stem is part of the stale-answer fingerprint', () => {
  const q = question('最符合选项是',{personalitySurveyTitle:'北森性格测试'});
  assert.notEqual(A.fingerprint(q),A.fingerprint({...q,personalitySurveyTitle:''}));
  assert.notEqual(A.fingerprint(q),A.fingerprint({...q,personalityContext:'按自己的实际情况作答'}));
  assert.equal(A.fingerprint(q),A.fingerprint({...q,personalitySurveyTitle:' 北森性格测试  '}));
});
