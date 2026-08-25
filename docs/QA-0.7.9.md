# HypnoOS 3.0 v0.7.9 QA

## 修正范围

- 档案左右页签改为内置 CSS 剪贴箭头，不再依赖缺失的装饰图片。
- 立绘读取兼容照片、头像、立绘、photo、avatar、portrait 和 image 字段，并保留头像库本地选择优先级。
- 效果页在心理下方增加催眠扳机；每项固定显示扳机、催眠者和效果。
- 世界书模型导入仅在原文明确提供三项时生成扳机，一条扳机只保留一个催眠者和一个效果。

## 自动验收

- 静态检查：档案立绘字段、内置箭头样式、扳机数据合同和世界书提取合同通过。
- 单元测试：11 项合同、导入、宿主适配和伴生世界书测试通过。
- Playwright + Edge：桌面 `1180×900` 与窄屏 `760×900` 全部通过。
- 档案深层页签可见，效果页正确显示模拟记录“晚安 / {{user}} / 效果”。
- 手机根文档无整页滚动，内部长列表滚动、整体同步缩放和既有应用回归继续通过。

## 关键截图

- `screenshots/0.7.9-desktop-profile-effects-trigger.png`
- `screenshots/0.7.9-desktop-male-profile.png`
- `screenshots/0.7.9-desktop-home.png`
- `screenshots/0.7.9-narrow-home.png`

## 运行边界

以上浏览器验收使用模拟的 SillyTavern 1.18.0 宿主合同。真实角色图片字段、真实 MVU 更新和连续模型回复仍由用户在实际 SillyTavern 中最终验收。
