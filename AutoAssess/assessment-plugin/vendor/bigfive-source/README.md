# 中文 IPIP 120 项固定来源

固定仓库：<https://github.com/rubynor/bigfive-web/tree/e8f3caca49edafb9bc6b927eff7fbc1264312c24>

本目录原样保留该提交的中文 questions.ts、choices.ts、根 LICENSE 和题目包 README，以及 IPIP 官方许可说明快照、120 项解析记录。题目包 README 保留中文翻译署名。

`question-bank/import_personality_open.py` 读取原始 TypeScript 文本，按 `PINNED` 中的 SHA-256 校验题文、选项与许可，不执行上游源码。`tests/personality-open.test.js` 使用解析记录核对派生题库中的题文、维度、正反向标记与分面。完整 MIT 许可另保留在 `vendor/bigfive-LICENSE`。

这些文件用于开发溯源与验证。统一发布构建保留派生题项、规则和许可证，来源与适用范围见 `THIRD_PARTY_NOTICES.md`。
