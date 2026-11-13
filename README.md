<div align="center">
  <img src="AutoAssess/desktop-companion/assets/gear.png" width="144" height="144" alt="AutoAssess 齿轮图标">
  <h1>AutoAssess 自动测评助手</h1>
  <h3>让测评练习更省心，让重复填写更少。</h3>
  <p>Windows 桌面统一配置与控制，Chrome / Edge 扩展读取页面并自动填写。<br>本机离线规则，偏好自己定，作答依据看得见。</p>
  <p>
    <img src="https://img.shields.io/badge/version-0.5.1-0891b2" alt="版本 0.5.1">
    <img src="https://img.shields.io/badge/Windows-10%202004%2B-0078D4" alt="Windows 10 2004 或更新版本">
    <img src="https://img.shields.io/badge/Chrome%20%2F%20Edge-Extension-2563eb" alt="Chrome 与 Edge 扩展">
    <img src="https://img.shields.io/badge/Manifest-V3-10b981" alt="Manifest V3">
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB" alt="Python 3.10 或更新版本">
    <a href="https://github.com/hxhxhxhy1226/AutoAssess/stargazers"><img src="https://img.shields.io/github/stars/hxhxhxhy1226/AutoAssess?style=flat&amp;label=stars" alt="GitHub Stars"></a>
  </p>
  <p>
    <a href="https://github.com/hxhxhxhy1226/AutoAssess/archive/refs/heads/main.zip"><strong>下载源码 ZIP</strong></a> ·
    <a href="#快速开始">快速开始</a> ·
    <a href="#功能亮点">功能亮点</a> ·
    <a href="AutoAssess/docs/usage.md">使用指南</a> ·
    <a href="#开发与验证">开发与验证</a>
  </p>
</div>

---

## 功能亮点

AutoAssess 面向**文字型性格自评与练习页面**，由 Windows 桌面程序和浏览器扩展协同工作。你在桌面设置个人偏好，扩展读取题目、生成离线选择、填写并核对结果。

| 功能 | 你可以怎样使用 |
| --- | --- |
| 🖥️ 桌面统一控制 | 在“作答、偏好设置、页面适配、连接”四个页面管理配置与运行状态 |
| ⚙️ 自定义个人偏好 | 设置预设、五项倾向、策略、描述排序、个人答案与停留时间 |
| ✍️ 手动辅助与自动填写 | 先查看选择依据再填写，或连续处理已支持的题型 |
| 📋 同页多题与分页 | 按未答题逐项处理，保留已有答案，填写回读成功后继续 |
| 🔁 多种文字交互 | 支持量表、二选一、描述单选、Most / Least 迫选和文字矩阵 |
| 🔗 本机配对 | 随机端口与临时连接码，固定连接你选中的浏览器标签页 |
| ⏸️ 暂停与恢复 | 暂停保留当前进度，停止作废待用结果，连接失效时停止控制 |
| 🧩 内置练习 | 220 道性格练习题、200 条精确量表规则与原创控件结构样例 |
| ⚡ 本机规则计算 | 题目求解不依赖模型 API、云端推理服务或远程题库 |

## 快速开始

### 先确认运行环境

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 2004 或更新版本 |
| 浏览器 | Google Chrome 或 Microsoft Edge，支持 Manifest V3 |
| 桌面运行环境 | Python 3.10+，包含 `tkinter` 和 `pythonw.exe` |
| 开发工具 | 运行测试或构建时需要 Node.js 20+；日常使用不需要 Node.js |

没有 Python 环境时，可从 [Python 官方 Windows 下载页](https://www.python.org/downloads/windows/) 安装，并保留 Tcl/Tk 支持。桌面程序使用 Python 标准库，启动器会检查已有环境。

### 1. 下载并解压

点击 [下载源码 ZIP](https://github.com/hxhxhxhy1226/AutoAssess/archive/refs/heads/main.zip)，解压后进入 **`AutoAssess-main/AutoAssess/`**。

使用 Git 的用户也可以执行：

```bash
git clone https://github.com/hxhxhxhy1226/AutoAssess.git autoassess
cd autoassess/AutoAssess
```

进入后应看到 `assessment-plugin`、`desktop-companion`、`docs` 和 `tools`。以下步骤均以这个项目文件夹为起点。

### 2. 加载浏览器扩展

打开对应浏览器的扩展管理页：

- Chrome：在地址栏输入 `chrome://extensions`。
- Edge：在地址栏输入 `edge://extensions`。

开启**开发者模式**，点击**加载已解压的扩展程序**，选择 **`assessment-plugin` 文件夹**。加载成功后应能看到“离线性格测评助手”，版本为 **0.5.1**。建议将扩展固定到浏览器工具栏。

### 3. 启动桌面助手

双击 [desktop-companion/启动桌面助手.cmd](AutoAssess/desktop-companion/启动桌面助手.cmd)。桌面窗口打开后，进入**连接**页面，检查窗口状态并复制本次连接码。

若窗口未打开，按启动脚本提示检查 Python、Tcl/Tk 和 `pythonw.exe`；具体排查方法见 [使用指南](AutoAssess/docs/usage.md#常见问题)。

### 4. 连接当前页面

首次使用时，在扩展弹窗中打开**内置练习**。保持练习页面为当前标签页，再点击扩展图标，将连接码粘贴到“桌面窗口”区域，点击**连接当前页面**。

连接成功后，桌面会显示连接页面与当前配置。连接固定到这一个标签页；更换页面时需要先断开，再重新配对。

### 5. 保存偏好并开始

在桌面**偏好设置**中选择运行方式、个人偏好、策略和停留时间，点击**保存配置**，等待浏览器回读确认。

建议先选择**手动辅助**：点击开始，核对当前题目与选择依据，再点击“仅填写本题”。确认练习页面的识别和填写行为符合预期后，再使用**自动填写**与“自动继续”。

**最终交卷或提交由你完成。** 关闭桌面窗口会收起到托盘；停止当前任务用“停止”，退出程序用托盘右键菜单中的“退出”。

## 桌面操作

| 页面 | 主要操作 |
| --- | --- |
| **作答** | 查看当前题目、选择结果、依据、计数与倒计时；开始、暂停、继续、停止或仅填写本题 |
| **偏好设置** | 运行方式、五项倾向、策略、描述排序、个人答案、停留时间与自动继续 |
| **页面适配** | 配置题目、题干、选项、下一题及双角色控件的七项选择器 |
| **连接** | 查看配对码、连接状态、窗口属性、托盘状态和退出入口 |

配置保存后会由浏览器确认生效。修改偏好前应先停止；未保存的编辑不会被普通心跳覆盖。通常保持页面选择器为空，使用内置结构识别即可。

更多操作示例见 [完整使用指南](AutoAssess/docs/usage.md)。

## 运行方式与选择依据

```mermaid
flowchart LR
    A[设置并保存偏好] --> B[读取当前题组]
    B --> C[本机规则生成选择]
    C --> D[填写并核对选中状态]
    D --> E[继续下一题或下一页]
```

**手动辅助**用于逐题查看与核对；**自动填写**用于连续处理已支持的页面。自动继续只在题组完成、填写回读成功且下一步控件可确认时执行。

离线规则优先级为：**个人精确答案 → 已标注量表题 → 完整描述排序 → 当前策略**。

| 策略 | 行为 |
| --- | --- |
| 积极 | 根据本地词组与个人倾向比较；依据不足时注明稳定随机回退 |
| 平衡 | 描述倾向适度收敛，量表选择更接近中间等级 |
| 随机 | 在合法候选中稳定选择，同题与同配置保持一致 |
| 严格匹配 | 无精确规则或完整排序时停止，等待补充 |

性格自评没有统一正确答案。本地词组不能完整理解任意文本，随机回退不等于语义识别成功。项目不输出人格诊断、官方 MBTI / DISC 分数或岗位适配结论。

## 题型支持

支持以可确认的文字语义与控件结构为前提。

| 交互类型 | 当前范围 |
| --- | --- |
| 符合程度、认同程度、频率量表 | 2–7 级明确文字标签，支持倒序、重排和已标注反向题 |
| 是非自述、偏好二选一 | 题面明确要求按个人情况或主观偏好选择 |
| 描述单选 | 最符合、最不像等文字自述 |
| 双角色迫选 | 2–8 项文字描述，分别选择 Most / Least，保证两项不同 |
| 同页多题 | 可分组的量表、描述题与迫选题，逐未答题处理 |
| 文字矩阵 | 可确认表头与行列关系的单选量表矩阵 |
| DISC / SHL 结构样例 | 已实现特定四选二表格与 M/L 三选二公开示例结构 |

图片人格题、拖拽全排序、任意复杂合并表格、跨域 iframe 和未确认的分步迫选流程尚不支持。平台名称不能代表所有页面均已适配；控件含义或题组范围无法确认时，程序会停止并说明原因。

## 数据与窗口行为

题目计算在本机完成，桌面服务只监听 `127.0.0.1` 的随机端口，使用本次进程的配对令牌。题面与结果保存在内存中，不写入常规日志。浏览器偏好保存在扩展存储中，配对信息保存在扩展会话存储中。

托盘启用后，关闭或最小化窗口会收起，任务可以继续；双击齿轮图标恢复，右键可停止或退出。托盘异常时保留可访问的窗口入口，图标位置由 Windows 管理。

桌面可设置并回读 Windows 原生窗口采集属性。“采集排除已设置”表示属性匹配，不表示所有截图或录屏软件均已验证；属性只作用于桌面主窗口。

## 项目结构

```text
AutoAssess/
├── README.md                  # 仓库介绍与快速开始
├── .github/workflows/ci.yml    # Windows / Linux 验证与构建
└── AutoAssess/                # 完整项目文件夹
    ├── assessment-plugin/     # 浏览器扩展、规则、题库与 JavaScript 测试
    ├── desktop-companion/     # Windows 桌面程序与 Python 测试
    ├── docs/                  # 使用与架构文档
    ├── tools/                 # 统一验证与发布构建
    └── README.md              # 项目详细说明
```

项目源码集中在 `AutoAssess/`，版本由 Git 记录。构建产物写入 `AutoAssess/dist/`；本地工具状态、研究资料、日志及缓存不随源码提交。

## 开发与验证

<a href="https://github.com/hxhxhxhy1226/AutoAssess/actions/workflows/ci.yml"><img src="https://github.com/hxhxhxhy1226/AutoAssess/actions/workflows/ci.yml/badge.svg?branch=main" alt="GitHub Actions 构建与验证状态"></a>

从仓库根目录运行：

```bash
cd AutoAssess
python tools/verify.py
python tools/build_release.py
```

如果已按上面的 Git 克隆步骤进入 `autoassess/AutoAssess`，直接执行两条 Python 命令即可。

最近完成的本机验证：

| 验证项 | 结果 |
| --- | --- |
| JavaScript 规则、页面控制与配置 | 124 项测试通过 |
| Python 桌面状态、协议与托盘逻辑 | 67 项测试通过 |
| 真实本机 HTTP 往返联调 | 通过 |
| 活动题库校验 | 220 题通过 |
| 发布 ZIP 完整性与源码字节一致性 | 通过 |

GitHub Actions 运行 Windows 完整验证与 Linux 核心验证，并生成运行包。可在 [Actions 页面](https://github.com/hxhxhxhy1226/AutoAssess/actions/workflows/ci.yml) 中打开成功的 Windows 运行记录，下载 `autoassess-runtime` 产物。

这些检查不启动真实浏览器、桌面窗口或托盘。实际窗口布局、托盘交互及具体截图 / 录屏工具的输出仍需实机验收。开发接口与数据流见 [架构说明](AutoAssess/docs/architecture.md)。

## 常见问题

**桌面窗口没有打开？**

先确认 Python 3.10+、Tcl/Tk 和 `pythonw.exe` 可用，再双击启动脚本；启动失败会显示原因，异常记录位于桌面目录的 `startup-error.log`。

**已经配对，为什么还没有开始填写？**

先保存配置并等待浏览器确认，再在“作答”页开始。页面中的个人信息题、知识题或不支持的控件可能使流程停止，需要人工核对。

**切换标签页后任务会自动跟过去吗？**

连接固定到配对时选中的标签页。需要切换目标时，先断开，再在新页面重新连接。

## 来源与许可

练习题包括原有 100 道性格题，以及从 `rubynor/bigfive-web` 固定提交导入的 120 道中文 IPIP 题项。200 条精确量表规则保留维度、正反向与来源信息，开发仓库同时保留固定来源快照。

项目整体尚未指定统一许可证。中文 IPIP 派生文件保留上游 MIT 声明；原有题目保留各自出处，不能把全部 220 题统一视为原创或 MIT。参考交互结构也不代表导入商业平台题库或通过官方验收。

- [第三方来源与许可](AutoAssess/assessment-plugin/THIRD_PARTY_NOTICES.md)
- [题库格式与维护](AutoAssess/assessment-plugin/QUESTION_BANK_SCHEMA.md)
- [随附许可文件](AutoAssess/assessment-plugin/vendor/)
