const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../desktop-settings.js');
test('full desktop settings have stable defaults and canonical selector fields',()=>{
  const value=S.validate({selectors:{next:'.next'}});
  assert.equal(value.mode,'manual');assert.equal(value.autoNext,true);assert.equal(value.selectors.question,'');assert.equal(value.selectors.next,'.next');
});
test('complete personal preferences and page adaptation survive validation',()=>{
  const value={mode:'auto',dwellSec:12,autoNext:false,personalityPreset:'custom',personalityStrategy:'strict',personalityTraits:{E:1,A:2,C:3,S:4,O:5},personalityRanking:'甲\n乙',personalityAnswers:'题干 => 选项',selectors:{question:'.question',pairMost:'.most'}};
  const result=S.validate(value);assert.equal(result.personalityRanking,value.personalityRanking);assert.equal(result.personalityTraits.O,5);assert.equal(result.selectors.pairMost,'.most');
});
test('partial settings do not inject defaults and reject unknown or non-data configuration',()=>{
  assert.deepEqual(S.validate({autoNext:false},{partial:true}),{autoNext:false});
  for(const value of [{},{apiKey:'secret'},{mode:'shell'},{dwellSec:'5'},{autoNext:1},{personalityTraits:{E:0}},{personalityTraits:{X:3}},{selectors:{script:'eval'}}])assert.throws(()=>S.validate(value,{partial:true}));
});
test('configuration size and Unicode validation agree with the desktop protocol',()=>{
  assert.throws(()=>S.validate({personalityRanking:'x'.repeat(20001)}));assert.throws(()=>S.validate({personalityAnswers:'x'.repeat(30001)}));
  assert.throws(()=>S.validate({selectors:{question:'x'.repeat(2001)}}));assert.throws(()=>S.validate({personalityAnswers:'\ud800'}));
  assert.equal(S.validate({personalityAnswers:'中文 😀'}).personalityAnswers,'中文 😀');
});
test('application settings export drops retired and transport-only fields',()=>{
  const value=S.fromApp({mode:'auto',apiKey:'do-not-copy',token:'do-not-copy',taskMode:'personality'});
  assert.equal(value.mode,'auto');assert.equal('apiKey' in value,false);assert.equal('token' in value,false);
});
