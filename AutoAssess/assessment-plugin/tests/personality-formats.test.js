const test = require('node:test');
const assert = require('node:assert/strict');
require('../shared.js');
require('../personality-data.js');
const P = require('../personality.js');

const q = (stem, texts, extra = {}) => ({ stem, type: 'single_choice',
  options: texts.map((text, index) => ({ key: String.fromCharCode(65 + index), text })), ...extra });
const chosen = (question, settings = {}) => {
  const answer = P.solve(question, settings);
  assert.equal(answer.offline, true);
  assert.equal(answer.confidence, null);
  assert.equal(answer.keys.length, 1);
  return question.options.find(option => option.key === answer.keys[0]).text;
};
const high = { personalityPreset: 'custom', personalityTraits: { E: 5, A: 5, C: 5, S: 5, O: 5 } };
const low = { ...high, personalityTraits: { E: 1, A: 1, C: 1, S: 1, O: 1 } };
const reordered = question => ({ ...question, options: [...question.options].reverse().map((option, index) => ({ ...option, key: String.fromCharCode(65 + index) })) });

test('six-level agreement and frequency scales preserve positive and reverse meaning after reordering', () => {
  for (const labels of [
    ['非常不同意', '不同意', '有点不同意', '有点同意', '同意', '非常同意'],
    ['从不', '很少', '偶尔', '经常', '通常', '总是']
  ]) {
    const positive = q('我善于沟通。', labels), negative = q('我不善于沟通。', labels);
    assert.equal(P.scaleOptions(positive).length, 6);
    for (const item of [positive, reordered(positive)]) {
      assert.equal(chosen(item, high), labels.at(-1));
      assert.equal(chosen(item, low), labels[0]);
    }
    for (const item of [negative, reordered(negative)]) {
      assert.equal(chosen(item, high), labels[0]);
      assert.equal(chosen(item, low), labels.at(-1));
    }
    const middle = chosen(positive, { ...high, personalityStrategy: 'balanced' });
    assert.ok(labels.slice(2, 4).includes(middle));
    assert.equal(chosen(reordered(positive), { ...high, personalityStrategy: 'balanced' }), middle);
  }
});

test('yes/no self-reports follow trait direction instead of label positions', () => {
  for (const labels of [['否', '是'], ['不是', '是的'], ['不对', '对'], ['No', 'Yes'], ['False', 'True']]) {
    for (const [stem, positive] of [['我善于沟通。', true], ['我不善于沟通。', false], ['我容易紧张。', false], ['你是否善于沟通？', true], ['您容易紧张吗？', false]]) {
      const item = q(stem, labels);
      assert.equal(P.scaleOptions(item)[0].scaleFamily, 'binary');
      for (const ordered of [item, reordered(item)]) {
        assert.equal(chosen(ordered, high), labels[positive ? 1 : 0]);
        assert.equal(chosen(ordered, low), labels[positive ? 0 : 1]);
      }
    }
  }
});

test('explicit self-report context permits a binary statement without inventing a personality diagnosis', () => {
  const item = q('会在周末整理自己的收藏', ['是', '否'], { personalityContext: '请根据自己的实际情况评价以下描述。' });
  assert.equal(P.isSupportedPersonality(item), true);
  const answer = P.solve(item, { personalityStrategy: 'balanced' });
  assert.equal(answer.method, 'strategy');
  assert.equal(answer.strategyBasis, 'scale');
  assert.throws(() => P.solve(item, { personalityStrategy: 'strict' }), /严格匹配/);
});

test('binary labels cannot classify factual first-person questions as personality self-reports', () => {
  for (const item of [
    q('我认为地球是圆的。', ['是', '否']),
    q('我知道水由氢和氧组成。', ['对', '不对']),
    q('你知道法国的首都是巴黎吗？', ['Yes', 'No']),
    q('我计算 2 + 2 = 4，对吗？', ['True', 'False']),
    q('请选择一项', ['是', '否']),
    q('作者认为谁更善于沟通？', ['是', '否'])
  ]) {
    assert.equal(P.isSupportedPersonality(item), false, item.stem);
    assert.throws(() => P.solve(item), /主观|自述|知识|客观|自评/);
  }
});

test('two descriptive preferences support common MBTI-style wording without relying on a test type', () => {
  for (const stem of [
    '你更喜欢哪种工作方式？',
    '你更容易喜欢或倾向哪一个词？',
    '你更偏向下面哪种性格描述？',
    '请选择比较接近自己的一项。',
    'Which word do you prefer?',
    '请根据自己的日常习惯，在下面两项中选择一项。'
  ]) {
    const item = q(stem, ['我善于沟通', '我喜欢独处']);
    assert.equal(P.isSupportedPersonality(item), true, stem);
    for (const ordered of [item, reordered(item)]) {
      assert.equal(chosen(ordered, high), '我善于沟通');
      assert.equal(chosen(ordered, low), '我喜欢独处');
    }
  }
});

test('unrecognized binary preferences disclose stable fallback and retain exact-answer precedence', () => {
  const item = q('你更容易喜欢或倾向哪一个词？', ['词语甲', '词语乙']);
  for (const strategy of ['positive', 'balanced', 'random']) {
    const answer = P.solve(item, { personalityStrategy: strategy });
    assert.ok(['unrecognized', 'random'].includes(answer.strategyBasis));
    assert.equal(chosen(item, { personalityStrategy: strategy }), chosen(reordered(item), { personalityStrategy: strategy }));
    assert.equal(chosen(item, { personalityStrategy: strategy, personalityAnswers: item.stem + ' => 词语乙' }), '词语乙');
  }
  assert.throws(() => P.solve(item, { personalityStrategy: 'strict' }), /严格匹配/);
});

test('binary preference support rejects ordinary knowledge, unsupported controls and ambiguous labels', () => {
  for (const item of [
    q('我应该选择哪个答案？', ['水由氢与氧组成', '水只含有碳元素']),
    q('你更喜欢哪种计算结果：2 + 2 = ?', ['3', '4']),
    q('请根据自己的实际情况选择正确答案：作者观点是什么？', ['甲', '乙']),
    q('你更喜欢哪一个？', ['甲', '乙'], { type: 'multi_choice' }),
    q('你更喜欢哪一个？', ['甲', '乙'], { images: ['image.png'] })
  ]) { assert.equal(P.isSupportedPersonality(item), false, item.stem); assert.throws(() => P.solve(item)); }
  for (const labels of [['是', '是的'], ['否', '不是'], ['是', '非常符合'], ['不同意', '中立', '中立', '同意', '比较同意', '非常同意']]) {
    const item = q('我善于沟通。', labels);
    assert.equal(P.scaleOptions(item), null);
    assert.equal(P.isSupportedPersonality(item), false);
  }
});
