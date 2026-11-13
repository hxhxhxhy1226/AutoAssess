# 开源来源与许可 · v0.4.2

核查日期：2026-11-12。以下区分已导入的题项与仅用于交互参考的项目。此次检索只读取公开页面和固定提交源码，没有运行上游应用或操作正式测评。

## 已导入：中文 IPIP 120 项

- 仓库：[rubynor/bigfive-web](https://github.com/rubynor/bigfive-web/tree/e8f3caca49edafb9bc6b927eff7fbc1264312c24)，固定提交 `e8f3caca49edafb9bc6b927eff7fbc1264312c24`。
- 来源文件：`packages/questions/src/data/zh-cn/questions.ts` 及配套 choices、评分定义。
- 根目录和题目包为 MIT；版权为 B5 Holding AS，完整许可证随包保留在 `vendor/bigfive-LICENSE`。
- [IPIP 官方许可说明](https://ipip.ori.org/newPermission.htm) 说明 IPIP 题项为 public domain。
- 导入 120 条中文原文，每个 N/E/O/A/C 维度 24 条，每个分面 4 条。`keyed` 的 plus/minus 表示计分方向，不是正确答案。
- 本机使用 E/A/C/S/O，N 转 S 时反转方向。保留 `sourceDomain`、`keyed`、`facet`、`sourceOptions`、`provenance` 和本地 `personalityRule`。
- 练习选项改为“非常不符合”至“非常符合”，不输出原量表常模或诊断成绩。
- 派生文件为 `question-bank/personality-open.json` 和 `personality-open-data.js`；转换脚本为 `question-bank/import_personality_open.py`。
- 开发仓库的 `vendor/bigfive-source/` 保留固定提交的原始题文、选项、许可、翻译说明及测试来源记录。转换脚本用固定 SHA-256 校验原始文件，核查报告写入项目根目录 `build/personality-open/conversion-report.json`。发布包保留派生题项及 `vendor/bigfive-LICENSE`。

原有 100 题及 80 条精确元数据沿用本地工程原有出处，没有为这些记录重新声明 MIT 或量表效度。v0.4.1 的题库仍为 220 题、200 条精确规则。

## 既有北森交互与配置参考

1. [Blunnny/FUCK_BEISEN](https://github.com/Blunnny/FUCK_BEISEN/tree/25502312c70b26c0e93547f07255b709401913b0)，固定提交 `25502312c70b26c0e93547f07255b709401913b0`。
   - MIT；已有许可文本 `vendor/beisen-LICENSE` 继续保留。
   - 参考形容词排序、分类自述配置及“先选描述，再分配角色”的选择器结构。
   - 公开示例约 15 个形容词、19 条分类自述，不是完整商业平台题库。

2. [1642778819-pixel/beisen-psychometric-helper](https://github.com/1642778819-pixel/beisen-psychometric-helper/tree/0d4efb352ac538585f620bd24f85671368554702)，固定提交 `0d4efb352ac538585f620bd24f85671368554702`。
   - README 声明 MIT；此前独立 LICENSE 请求返回 404，本次根目录列表仍未发现该文件。
   - 仅参考策略和 UI 结构，没有复制其源文件或题文。其少量关键词与位置策略不能证明未知题语义已经被理解。

## v0.4.1 新增交互参考，未导入题库

| 来源 | 许可核查 | 参考范围 |
|---|---|---|
| [zcw576020095/mbti-test](https://github.com/zcw576020095/mbti-test/tree/9960e585c4a949f3138eaff21494b1f99c3ba5db) | 固定提交 `9960e585c4a949f3138eaff21494b1f99c3ba5db` 的根 LICENSE 为 MIT | `templates/mbti/test.html` 的独立题目卡片、二选一 radio 组与多题分页；核对了 93 条数据的字段结构，没有导入其题库或 MBTI 评分逻辑。 |
| [cahyadsn/disc](https://github.com/cahyadsn/disc/tree/4d4339ce749c6f2c18e1f65bae63638ed70ff70d) | 固定提交 `4d4339ce749c6f2c18e1f65bae63638ed70ff70d`，MIT，Copyright (c) 2016 cahyadsn | `index.php` 的四选二 Most/Least 表头、`m[group]` / `l[group]` 命名、横向并排题组和题号 rowspan；由本项目实现适配及原创练习样例。README 明确仓库只提供 dummy data，真实商业题文未提供。 |
| [dzyla/disc-personality-assessment](https://github.com/dzyla/disc-personality-assessment/tree/71a8213e908098c01b27c5f9b0ed489d688d3237) | 固定提交 `71a8213e908098c01b27c5f9b0ed489d688d3237`，MIT，Copyright (c) 2024 Dawid Zyla | 仅研究 Likert 与二选一等题型组合。其 PROVENANCE 声明大量题文由 AI 生成且尚未验证，本项目没有导入其题文、分数或结果解释。 |

上表的源码、LICENSE 和题型快照作为可选的本地研究资料保存，没有作为上游程序或题库加入扩展发布包。来源以表中的固定提交和许可说明为准；本地研究记录不属于运行或验证依赖。

本次 GitHub API 返回请求额度限制，固定提交通过公开仓库页面核对，源码通过该提交的 raw 地址读取。仅发现仓库或复现其交互结构不等于完成所有真实平台验收。

本项目的词组匹配、偏好比较、稳定选择、暂停停止和页面填写校验是本地实现。题目选择反映用户配置，不代表标准正确答案、真实人格诊断或官方 MBTI/DISC 测量分数。

## v0.4.2 控件结构复核

- 北森相关结构继续参考上列 Blunnny/FUCK_BEISEN 固定提交的 `adjective_test_automation.py`：`data-cls="tuozhuai-content"`、`I6Yvw` 描述、角色分配框和 `div.phoenix-button.content` 确认。此为第三方历史观察；本项目用原创描述验证，未导入真实商业题文。
- SHL 官方[人格问卷说明](https://www.shl.com/shldirect/en/example-questions/personality-questionnaire/)及[公开示例 HTML](https://www.shl.com/htmlLightbox/view/17?lightboxwidth=-default-width&lightboxheight=-full-height&contenttype=SHLDirectExample&tracking=1&id=17/)提供实际控件结构。仅据此实现独立 form、M/L 表头及 RadioGroupm/RadioGroupl 适配，没有复制官方题文、页面程序或评分算法，也没有为其声明开源许可证。
- SHL 介绍页的分步 Most→Most 与公开示例弹层的同屏 M/L 是不同流程，当前模块只验收后者对应结构。来源以本节的官方页面及公开示例链接为准；下载记录作为可选的本地研究资料保存。
- 用户反馈的问卷星“北森性格测试”是仿题问卷，不作为北森官方题库或当前页面兼容性的证据。
