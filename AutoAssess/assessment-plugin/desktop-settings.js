(function(root){
  'use strict';
  const axes=['E','A','C','S','O'];
  const selectors=['question','stem','option','next','pairItem','pairMost','pairLeast'];
  const defaults={mode:'manual',dwellSec:5,autoNext:true,personalityPreset:'outgoing_engineer',personalityStrategy:'positive',personalityTraits:{},personalityRanking:'',personalityAnswers:'',selectors:Object.fromEntries(selectors.map(key=>[key,'']))};
  const fields=Object.keys(defaults);
  function object(value){return value&&typeof value==='object'&&!Array.isArray(value);}
  function string(value,limit,label){
    if(typeof value!=='string'||value.length>limit)throw Error(label+'格式无效或内容过长');
    for(let i=0;i<value.length;i++){
      const code=value.charCodeAt(i);
      if(code>=0xd800&&code<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error(label+'包含无效字符');}
      else if(code>=0xdc00&&code<=0xdfff)throw Error(label+'包含无效字符');
    }
    return value;
  }
  function validate(value,options={}){
    if(!object(value))throw Error('桌面设置必须为对象');
    const keys=Object.keys(value),partial=options.partial===true;
    if(partial&&!keys.length)throw Error('没有可保存的设置');
    if(keys.some(key=>!fields.includes(key)))throw Error('包含不支持的桌面设置字段');
    const result=partial?{}:{...defaults,personalityTraits:{},selectors:{...defaults.selectors}};
    for(const key of keys){
      const item=value[key];
      if(key==='mode'&&!['manual','auto'].includes(item))throw Error('填写方式无效');
      if(key==='dwellSec'&&(!Number.isInteger(item)||item<1||item>120))throw Error('停留时间须为1–120秒整数');
      if(key==='autoNext'&&typeof item!=='boolean')throw Error('自动继续须为开关值');
      if(key==='personalityPreset'&&!['outgoing_engineer','careful','balanced','custom'].includes(item))throw Error('性格偏好无效');
      if(key==='personalityStrategy'&&!['positive','balanced','random','strict'].includes(item))throw Error('答题策略无效');
      if(key==='personalityTraits'){
        if(!object(item)||Object.keys(item).some(axis=>!axes.includes(axis)))throw Error('性格倾向字段无效');
        if(Object.values(item).some(level=>!Number.isInteger(level)||level<1||level>5))throw Error('性格倾向须为1–5整数');
        result[key]={...item};continue;
      }
      if(key==='personalityRanking'){result[key]=string(item,20000,'描述排序');continue;}
      if(key==='personalityAnswers'){result[key]=string(item,30000,'个人答案');continue;}
      if(key==='selectors'){
        if(!object(item)||Object.keys(item).some(name=>!selectors.includes(name)))throw Error('页面适配字段无效');
        result[key]={...(partial?{}:defaults.selectors),...Object.fromEntries(Object.entries(item).map(([name,selector])=>[name,string(selector,2000,'页面选择器')]))};continue;
      }
      result[key]=item;
    }
    return result;
  }
  function fromApp(value={}){return validate(Object.fromEntries(fields.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]])));}
  const api={validate,fromApp,fields};root.AssessmentDesktopSettings=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
