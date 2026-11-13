# 离线性格题库格式 · v0.4.1

## 活动文件与数量

| 文件 | 内容 |
|---|---|
| `question-bank/questions.json` | 原有 100 道性格练习题 |
| `question-bank/personality-open.json` | 导入的 120 道中文 IPIP 题项及来源元数据 |
| `personality-data.js` | 原有 80 条精确量表规则 |
| `personality-open-data.js` | 追加的 120 条 IPIP 精确量表规则 |

共 220 道题、200 条精确规则。后台仅从扩展内读取这两个 JSON 题库；来源 URL 用于溯源，不是运行时下载地址。v0.4.1 新增的二选一、是非自述和 DISC 页面适配没有增加商业题库记录。

## 基本记录

顶层对象含 `questions` 数组，并可带 `bankId`、`site`、`schema_version` 和 `source`。每道题至少包含：

| 字段 | 含义 |
|---|---|
| `qid` | 稳定、唯一的题号 |
| `type` | 当前活动题库为 `likert` 或 `forced_choice` |
| `stem` | 文字题干 |
| `options` | `{key, text}` 数组；同题 key 不重复，文字不可为空 |
| `title`、`category`、`provenance` | 可选展示与来源信息，保留已有值 |

性格练习题没有标准 `answer` 字段。运行产生的选择、人工操作和测试结果不写回题库。

页面解析使用同样的题干和选项结构，并可能生成 `single_choice`、`forced_pair` 等运行时类型、性格上下文及控件快照；这些不意味着题库增加了对应商业试卷。DOM 控件和页面指纹不作为来源题文保存。

## IPIP 来源与本地偏好映射

导入记录另含 `bankId`、`category: personality`、`sourceQuestionId`、`sourceDomain`、`keyed`、`facet`、`sourceOptions`、`provenance` 和 `personalityRule`。

- `sourceOptions` 保留上游选项原文、顺序及分数。
- 本地 `options` 使用五级符合程度标签，和原始选项分开存放。
- `personalityRule = {axis, positive}` 表示本地倾向映射；`axis` 为 E/A/C/S/O，`positive` 为布尔值。
- 原 N（神经质）映射为本地 S（情绪稳定），正反向同时反转；其余 E/A/C/O 沿用源方向。
- 源 `keyed`、分面与维度信息不是正确答案或本地性格诊断结果。

两份规则脚本提供 `{qid, stem, axis, positive}`。必须先加载 `personality-data.js`，再加载 `personality-open-data.js`；后者追加时去重，重复加载不会重复计数。精确规则依完整题干匹配，不只凭 qid 套用。

## 维护与核对

新增公开题项时保留固定提交、许可、原文和变换说明，不把来源分数当成标准答案。MBTI、DISC 与 E/A/C/S/O 不能直接视为相同维度。

维护 IPIP 数据时，从 `assessment-plugin` 目录运行以下转换器；它会同时更新 JSON、派生规则和许可，读取/下载范围固定为脚本记录的来源提交：

```powershell
python -B question-bank/import_personality_open.py
node --test tests/personality-open.test.js
```

转换器默认读取开发仓库内 `vendor/bigfive-source/` 的固定提交快照，按脚本记录的 SHA-256 核对原始题文、选项及许可，不需要联网。转换报告写入项目根目录 `build/personality-open/conversion-report.json`。完成后核对两份题库总数、规则总数、N→S 方向、选项重排及 JSON/规则一致性。其他活动规则与浏览器验证命令见 [PLUGIN_DEVELOPMENT.md](PLUGIN_DEVELOPMENT.md)，来源许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
