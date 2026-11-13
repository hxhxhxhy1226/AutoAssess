// Generated from question-bank/personality-open.json by import_personality_open.py.
// MIT source attribution: vendor/bigfive-LICENSE. These are preference rules,
// not correct-answer keys. Existing metadata is preserved; repeated loads are safe.
(function (root) {
  'use strict';
  const additions = [
  {
    "qid": "ipip-neo-43c98ce8-a07a-4dc2-80f6-c1b2a2485f06",
    "stem": "杞人忧天",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-d50a597f-632b-4f7b-89e6-6d85b50fd1c9",
    "stem": "平易近人",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-888dd864-7449-4e96-8d5c-7a439603ea91",
    "stem": "天马行空",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-ce2fbbf8-7a97-4199-bda5-117e4ecdf3b6",
    "stem": "推心置腹",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-c7f53c3c-2e77-432f-bb71-7470b67d3aa9",
    "stem": "不辱使命",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-48ad12ce-470e-4339-90ac-ea8c43a0103e",
    "stem": "易怒",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-458f3957-2359-4077-ade1-34525d633063",
    "stem": "喜欢参加大型聚会",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-58d571e5-d725-4cf8-a438-32c16ee28eb6",
    "stem": "相信艺术的重要性",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-0cf79e27-e702-45c2-9471-04ac96b58e0e",
    "stem": "借刀杀人",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-cda1ca17-b599-4561-a6cd-ff9d36062d27",
    "stem": "洁身自好",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-5e8550d7-b8ef-4905-950a-f81d735d39e2",
    "stem": "易伤感",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-8af754f2-68e9-48f3-8c5d-2e6633d4472c",
    "stem": "负责",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-0727def6-3d18-4221-bf38-86b58f9f3eed",
    "stem": "自我陶醉",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-ccf3a5c8-fb50-4bd4-8e7a-22af3d657279",
    "stem": "乐于助人",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-73d84e5d-cbf5-47f0-b8cb-4d2159a52e32",
    "stem": "遵守诺言",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-b2d9ef74-73f5-4ea8-b00c-7aaca15937df",
    "stem": "善察言观色",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-48a761ef-438e-409b-ae59-ea2ce8f84414",
    "stem": "日理万机",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-cae55842-8957-4e3b-83b3-ceff98fb9dcf",
    "stem": "喜欢多样化，不喜欢千篇一律",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-e2028ad3-b128-4f76-be57-398bfe2aff22",
    "stem": "爱干架",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-b7fc949b-02b6-4cb9-a3e2-dbb3d824b55f",
    "stem": "工作努力",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-481efd08-c810-43b1-a952-f8ac9052f96b",
    "stem": "狂欢作乐",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-987efee2-899f-4a65-b9b5-1589ef0460d7",
    "stem": "喜爱刺激",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-e1e804c7-4a1d-498f-8610-f95147af9d1d",
    "stem": "喜爱挑战",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-71029381-3908-4c68-91e1-e41fb45542a2",
    "stem": "自信",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-f6076eea-56ae-4b46-97f1-5f94a7676c96",
    "stem": "时刻有准备",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-2f519935-92e8-48ad-9746-4a0f8b38466a",
    "stem": "易惊慌失措",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-899c3f66-51d0-46ea-963a-6fc36d3b3cb9",
    "stem": "流露出欢乐",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-79186f48-e7fa-4df4-b74b-b0627ee244e1",
    "stem": "倾向于投票给自由派的政治候选人",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-fd50e1ca-d9e0-4037-a7a1-a191d4db2d96",
    "stem": "同情无家可归之人",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-bd9eec0a-b68b-472c-8803-7db29c308cdb",
    "stem": "不假思索地做事情",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-7f92ab2c-265c-4b84-8c74-09f9bb9d41a7",
    "stem": "作最坏的打算",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-af55f014-788c-4b6e-92c4-b2b59dc8a28d",
    "stem": "感觉周围的人很好",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-08ff6dca-02a5-4aeb-aaa4-2ecf2526f143",
    "stem": "享受疯狂的幻想飞行",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-6f66cdc0-9044-457b-b40d-501ecae15ee7",
    "stem": "相信别人有好的意图",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-f110fc66-2e9e-413c-920b-19f05e63d7ac",
    "stem": "擅长我的工作",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-7dab2a37-8635-4fc7-86b7-0abf13c183c9",
    "stem": "很容易生气",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-28ab59a0-e7cd-4fce-94e3-bba2ecc023b6",
    "stem": "在聚会上会和很多不同的人交谈",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-b5919f2f-cded-4745-a9ce-c02703cee807",
    "stem": "从别人可能不会注意到的事物中看到美",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-5a5fa975-d024-4ac8-8845-2823f957c21b",
    "stem": "为了成功不择手段",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-adf33f9f-45bd-43e3-af25-4c491176d97f",
    "stem": "健忘",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-f0a14e16-d726-47e9-a2c1-647fd3d7d52e",
    "stem": "不喜欢自己",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-0b38e3d3-c15c-454c-b034-f4eb7ae1580a",
    "stem": "试着去领导别人",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-5631b856-ff34-4f76-a0cd-edc7104c3bfa",
    "stem": "感受别人的情绪",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-ada867af-4db1-4e3d-a604-2b695c1806e5",
    "stem": "关心他人",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-c55e3958-00c4-4fc3-9118-47d8f31bfde1",
    "stem": "诚实",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-acd8fadc-5399-4a67-b5ff-9d1ada049c01",
    "stem": "害怕引起别人的注意",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-d07b6c67-0d02-4948-a997-bb84ac234cd8",
    "stem": "总是忙个不停",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-33b81fd0-7e32-4cd8-a13a-d5f5f754f998",
    "stem": "喜欢坚持我知道的事情",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-d9a9a180-29c9-4ec5-8621-2256d411def7",
    "stem": "对人们大喊大叫",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-f12c3d9d-1d12-4aa6-ad2e-009cd0651cbb",
    "stem": "期望做的更多",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-9891b7ba-a494-4307-aafe-301d8db506c6",
    "stem": "很少放纵",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-f1675af6-88bf-4376-a946-0281e762b39c",
    "stem": "寻求冒险",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-95a3f20c-f933-4d19-a2c1-a7dbdf63c562",
    "stem": "避免进行哲学讨论",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-7df44711-4cd4-4b05-8830-73fcc3ebdab5",
    "stem": "自我感觉良好",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-9d3cb5c7-955c-43a4-b6c7-b07ed01dcbd9",
    "stem": "执行我的计划",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-13c58810-3864-42ba-aa87-d4166f858756",
    "stem": "被各种事情淹没",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-961376e0-16a1-4c14-b059-789e63d11b63",
    "stem": "玩得很开心",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-f08e1b27-3673-4898-9cae-896482d0d9f9",
    "stem": "相信没有绝对的对与错",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-c2038c12-7a37-47a8-9983-831bd6692aab",
    "stem": "同情那些比我糟糕的人",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-956f3e17-ff17-4af5-a52f-9222b8968106",
    "stem": "鲁莽行事",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-4d81238b-5407-47d4-88e5-dc0e38aa14f5",
    "stem": "害怕很多事情",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-9f9166f0-fa94-4c14-a91d-3eecd8395794",
    "stem": "避免与他人接触",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-23a1034f-fab7-4887-a66e-5ef4eaafb25e",
    "stem": "喜欢做白日梦",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-c63e6121-c3ed-40cc-abc2-c1e6ea1e0858",
    "stem": "相信别人所说的",
    "axis": "A",
    "positive": true
  },
  {
    "qid": "ipip-neo-02ee1930-36a7-4caa-b10c-c93efb682a44",
    "stem": "顺利处理任务",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-da8e6ed1-2296-4c58-8fdb-66f2f591989b",
    "stem": "开始发脾气",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-03c10b30-b88f-4c63-8acc-71251ca24615",
    "stem": "喜欢独自一人",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-751a04bc-5adf-485a-8ea4-4308406ae85b",
    "stem": "不喜欢诗歌",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-982e83c2-d34e-48da-9c71-78494ab05c85",
    "stem": "利用他人",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-f4891687-0ff0-47af-a4f6-d1202c8f6676",
    "stem": "我的房间一团糟",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-743d8973-1de1-4485-91b4-8a5cf63e7d44",
    "stem": "我经常情绪低落",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-2452f034-8273-4f71-9122-a40f5ead31ba",
    "stem": "掌控一切",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-2a300001-6e05-4c79-b8b5-2ccae4c3d463",
    "stem": "很少注意到我的情绪反应",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-cd54bd76-ca9c-4030-b325-bb8d896bcb3f",
    "stem": "对别人漠不关心",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-4e6e3a34-176f-4e6e-8730-1341611f972b",
    "stem": "打破规则",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-20062533-a33d-4c1e-9cd9-bff868015b3f",
    "stem": "只有和朋友在一起才觉得舒服",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-b2a077d5-1fe0-4b06-ab63-35455e001e54",
    "stem": "在业余时间做很多事",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-0d2e65ab-95d9-482f-beb4-3239a3a4944a",
    "stem": "比喜欢改变",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-0de0f900-cede-4538-9c00-5da4f830b028",
    "stem": "侮辱他人",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-a9c97d6b-6721-4150-8d84-64ef3082f164",
    "stem": "完成足够的工作",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-9f2e7f90-0ca5-4ed0-9fe5-e060238a9b5e",
    "stem": "轻松抵制诱惑",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-7dd6cf2d-5c14-48c2-8ae5-633a7a596c71",
    "stem": "做事不计后果",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-fecc35f7-681e-4889-a404-4a973a3dfef0",
    "stem": "难以理解抽象的概念",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-1d686958-6fe7-432f-85e6-186b99e4e232",
    "stem": "对自己有很高的评价",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-c7db0ed8-df7d-49bf-942f-59e46ef743c4",
    "stem": "浪费我的时间",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-b7e0e393-9b21-4e0d-adf3-8f28fb5b9d87",
    "stem": "觉得我无法处理事情",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-79d956e8-1118-402a-a0e2-9380af18243e",
    "stem": "热爱生活",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-96ba77b2-1a44-4dfd-95f9-ae4d1f714460",
    "stem": "倾向于投票给保守派的政治候选人",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-77f54ab4-0fba-4efb-8700-066c7490eb87",
    "stem": "对他人的问题不感兴趣",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-a354cf7c-8d11-46ac-acc5-da90d2048637",
    "stem": "做事急躁",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-43b03992-3f32-4ed1-a6f8-5d6d3e7ed246",
    "stem": "易感受到压力",
    "axis": "S",
    "positive": false
  },
  {
    "qid": "ipip-neo-41702602-08e4-4e2b-9a19-291d9efc581a",
    "stem": "与人保持距离",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-935a7413-abac-4f54-9169-d1fbd39da752",
    "stem": "喜欢沉思",
    "axis": "O",
    "positive": true
  },
  {
    "qid": "ipip-neo-432dbde8-8756-4ff0-80d5-f47018235139",
    "stem": "不相信他人",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-5727c93f-317b-4af1-a686-77fc9fbc5033",
    "stem": "知道如何把事情做好",
    "axis": "C",
    "positive": true
  },
  {
    "qid": "ipip-neo-d32bd062-4eb2-401b-99b2-e7afea39ca9b",
    "stem": "不轻易生气",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-9a47184f-6046-4e68-a61b-3d9b357b86ea",
    "stem": "不随波逐流",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-87c5b27e-59a8-4c48-8ba8-f5413d735693",
    "stem": "不喜欢去艺术博物馆",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-11b20adb-abed-4363-894c-3dd823ae0540",
    "stem": "阻碍别人的计划",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-50418d86-712c-45d9-adc4-ea0231c93cf5",
    "stem": "忘记我的随身物品",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-f40e421f-6c24-4be2-bd9f-28d33358d8c6",
    "stem": "感觉自己挺好",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-8791f37b-686f-47c3-9db7-74c009951321",
    "stem": "等待他人带路",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-4fd25155-9cc2-4cd6-8852-3e0ca2d5e95d",
    "stem": "不理解情绪化的人",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-b68af20d-24f9-4c27-85cc-fe0858994888",
    "stem": "不为别人浪费时间",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-54423933-0ebb-44a7-bdd9-2a9b100c70f2",
    "stem": "不守信",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-7317848c-3e1b-422f-bb16-02efc504f677",
    "stem": "没有社交困扰",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-7d93e1ca-46e8-4a30-9623-42a80c9b420c",
    "stem": "喜欢放松",
    "axis": "E",
    "positive": false
  },
  {
    "qid": "ipip-neo-a7f43928-8982-4ed5-8656-7a80346fe979",
    "stem": "古板守旧",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-17910a55-a64a-4ed0-8b46-293e2fa2fe03",
    "stem": "以牙还牙",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-3890bb43-2695-4b8d-b289-ee10d11cc884",
    "stem": "花很少时间和精力在工作上",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-49a85680-53aa-4208-86b5-dccc7a6f8e37",
    "stem": "能够控制住我的冲动",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-10f90fa9-649c-4631-ac4c-3dd3f751597d",
    "stem": "表现得疯狂",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-b86de003-c3c4-4cc8-9385-5ac8a0142c34",
    "stem": "不喜欢讨论理论",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-80c1d149-7050-481a-9953-aefb441642e7",
    "stem": "有良好的道德感",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-51403620-968c-42fa-a772-65ba5ad8396f",
    "stem": "很难开始一件事情",
    "axis": "C",
    "positive": false
  },
  {
    "qid": "ipip-neo-88a3c2fe-3aa4-4f46-9322-da656332268a",
    "stem": "在压力下保持冷静",
    "axis": "S",
    "positive": true
  },
  {
    "qid": "ipip-neo-e7b31bdc-5f6b-40ec-ba91-f5919b0f170e",
    "stem": "对生活充满希望",
    "axis": "E",
    "positive": true
  },
  {
    "qid": "ipip-neo-580b08d1-3c94-46e9-9d07-d6d80c698127",
    "stem": "相信我们应该眼里打击犯罪",
    "axis": "O",
    "positive": false
  },
  {
    "qid": "ipip-neo-48bee420-60c0-45cd-be43-3893dbc1969a",
    "stem": "忽视那些需要帮助的人",
    "axis": "A",
    "positive": false
  },
  {
    "qid": "ipip-neo-ea3327ea-3529-4be4-8e2d-2174731ae4d7",
    "stem": "做事果断干脆",
    "axis": "C",
    "positive": false
  }
];
  const existing = Array.isArray(root.AssessmentPersonalityData) ? root.AssessmentPersonalityData : [];
  const byId = new Map(existing.map(row => [row.qid, row]));
  const appended = [];
  for (const row of additions) {
    const previous = byId.get(row.qid);
    if (previous) {
      if (previous.stem !== row.stem || previous.axis !== row.axis || previous.positive !== row.positive) {
        throw Error('Conflicting IPIP preference metadata: ' + row.qid);
      }
      continue;
    }
    byId.set(row.qid, row);
    appended.push(row);
  }
  root.AssessmentPersonalityData = [...existing, ...appended];
})(globalThis);
