(function (root) {
  const P = root.AssessmentPersonality, el = id => document.getElementById(id);
  for (const [id,preset] of Object.entries(P.presets)) el('offlinePreset').add(new Option(preset.name,id));
  for (const [id,strategy] of Object.entries(P.strategies)) el('offlineStrategy').add(new Option(strategy.name,id));
  for (const [axis,label] of Object.entries(P.dimensions)) {
    const field = document.createElement('label'); field.textContent = label;
    const input = document.createElement('input'); input.type = 'number'; input.min = 1; input.max = 5; input.step = 1; input.id = 'trait' + axis;
    input.addEventListener('input', () => { el('offlinePreset').value = 'custom'; });
    field.append(input); el('traitInputs').append(field);
  }
  const showTraits = traits => { for (const axis of Object.keys(P.dimensions)) el('trait'+axis).value = traits[axis]; };
  const showStrategy = () => { el('offlineStrategyHint').textContent = P.strategies[el('offlineStrategy').value]?.description || ''; };
  function load(settings) {
    el('offlinePreset').value = P.presets[settings.personalityPreset] ? settings.personalityPreset : 'outgoing_engineer';
    el('offlineStrategy').value = Object.hasOwn(P.strategies, settings.personalityStrategy) ? settings.personalityStrategy : 'positive';
    showStrategy();
    el('offlineTaskMode').value = 'personality';
    showTraits({ ...P.presets[el('offlinePreset').value].traits, ...(settings.personalityPreset === 'custom' ? settings.personalityTraits : {}) });
    for (const field of ['personalityRanking','personalityAnswers']) el(field).value = settings[field] || '';
    el('offlineCoverage').textContent = `当前内置 ${root.AssessmentPersonalityData.length} 条精确量表规则，并支持本地描述词组匹配。支持多级量表、频率量表、描述单选、双角色迫选与多行量表。识别不足时按策略处理，并标注依据。`;
  }
  function read() {
    const data = { taskMode: el('offlineTaskMode').value, personalityPreset: el('offlinePreset').value, personalityStrategy: el('offlineStrategy').value, personalityTraits: Object.fromEntries(Object.keys(P.dimensions).map(axis => [axis,Number(el('trait'+axis).value)])), personalityRanking: el('personalityRanking').value.trim(), personalityAnswers: el('personalityAnswers').value.trim() };
    if (data.personalityRanking.length + data.personalityAnswers.length > 200000) throw Error('离线规则过大，请控制在 20 万字符内');
    P.config(data); return data;
  }
  el('offlinePreset').addEventListener('change', () => showTraits(P.presets[el('offlinePreset').value].traits));
  el('offlineStrategy').addEventListener('change', showStrategy);
  el('personalityRanking').addEventListener('input', () => { el('offlinePreset').value = 'custom'; });
  el('copyPresetRanking').addEventListener('click', () => {
    try { const config = P.config({ ...read(),personalityRanking:'' }); el('personalityRanking').value = config.rows.join('\n'); el('offlinePreset').value = 'custom'; }
    catch (error) { el('personalityStatus').textContent = error.message; }
  });
  el('savePersonality').addEventListener('click', async () => {
    try { await chrome.storage.local.set(read()); el('personalityStatus').textContent = '离线性格设置已保存；重新开始填写时生效，无需配置 API。'; }
    catch (error) { el('personalityStatus').textContent = error.message; }
  });
  el('importPersonality').addEventListener('change', async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 1000000) throw Error('配置文件请小于 1 MB');
      const data = P.importConfig(JSON.parse(await file.text()));
      for (const name of ['personalityRanking','personalityAnswers']) if (data[name] !== undefined) el(name).value = data[name];
      el('offlinePreset').value = 'custom';
      el('personalityStatus').textContent = '配置已导入编辑区。请检查排序与答案后保存；未匹配题按所选策略处理。';
    } catch (error) { el('personalityStatus').textContent = '导入失败：'+error.message; }
    finally { event.target.value = ''; }
  });
  root.PersonalityOptions = { load, read };
})(globalThis);
