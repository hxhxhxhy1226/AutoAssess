# AutoAssess 自动测评助手

最新版 **v0.5.1** 的源码、运行入口、文档和开发工具统一放在 [AutoAssess](AutoAssess/) 文件夹中。

- [项目介绍与安装步骤](AutoAssess/README.md)
- [使用指南](AutoAssess/docs/usage.md)
- [架构说明](AutoAssess/docs/architecture.md)

加载浏览器扩展时选择 `AutoAssess/assessment-plugin`，Windows 桌面程序入口为 `AutoAssess/desktop-companion/启动桌面助手.cmd`。

开发验证与发布构建：

```bash
cd AutoAssess
python tools/verify.py
python tools/build_release.py
```

GitHub Actions 执行 Windows 完整验证和 Linux 核心验证，并生成可下载的运行包。构建产物位于 `AutoAssess/dist/`。
