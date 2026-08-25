# 0.7.1 世界书生成适配回归记录

## 本轮范围

- 通用模板选择框缩小为 34px 高。
- 新增“根据世界书自动生成”、世界书选择和生成按钮。
- 地图、监控、日历、课程表、成就和任务、打工、MC匿名版统一读取 `HypnoWorldAdaptation/v1` 结构化适配包。
- 自动生成不再把人物档案、变量规则或提示词原文直接显示在应用中。
- 作弊模式下方新增“清空数据”，仅删除当前聊天生成的适配包，原世界书零修改。

## 自动化结果

- `npm run check`：通过；UI 基线 SHA-256 `2d0a0248d111ce6cddf83f2b8794884f4d7f9cabc15078a97472d762b9e3385f`。
- `npm test`：11/11 通过。
- 浏览器回归：桌面 1180×900、窄屏 760×900 均通过。
- 已验证生成、存储、地图渲染、课程表渲染、监控渲染和清空流程。
- 已验证生成后应用不显示测试世界书中的人物档案或变量规则文本。

## 截图

- [桌面端世界书生成设置](screenshots/0.7.1-desktop-worldbook-adapter-settings.png)
- [桌面端生成后的监控应用](screenshots/0.7.1-desktop-adaptive-monitor.png)
- [窄屏世界书生成设置](screenshots/0.7.1-narrow-worldbook-adapter-settings.png)
- [窄屏生成后的监控应用](screenshots/0.7.1-narrow-adaptive-monitor.png)

## 未完成的真实宿主门槛

- 真实 SillyTavern 1.18.0 中多个实际世界书的生成质量与连续多轮持久化仍需用户安装验收。
- 不同 OpenAI 兼容供应商的 CORS、模型输出截断和无效 JSON 仍需扩大验证。
- 真实 4.3 原卡脚本共存和移动端触控仍需人工确认。
