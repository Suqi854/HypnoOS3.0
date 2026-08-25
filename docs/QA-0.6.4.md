# 0.6.4 信息与缩放回归记录

日期：2026-08-25。

## 新基线

- 手机前端 `ui/index.html` SHA-256：`5D5ACCDDAC591D676D4744281CABC9FEF93B2404730F93D9E51FB5A145F158AF`。
- 悬浮宿主 `public/floating-bootstrap.js` SHA-256：`B2C9D90E075A6A5A1B83A6570446050F2172A337B78E3C15C6A4C498A7B04C59`。
- 默认手机尺寸仍为 `430 × 812`；没有加入可见缩放手柄、文字或图标。

## 修改结果

- 外部右侧信息挂件停止显示，资源、变量格式、桌宠人物和变量楼层迁移到手机“信息”应用。
- 文生文连接器采用 API 预设式表单，支持酒馆代理与自定义直连、端点、密钥、模型参数、附加/排除主体参数和附加请求标头。
- 手机下方左右角增加透明热区，拖动时以 `430:812` 同步缩放机壳、iframe、应用和全部内容；缩放值与位置一并持久化。

## 自动检查

- Node 静态检查和 11 项单元测试通过。
- 桌面端与窄屏浏览器回归通过，外部信息栏计算样式为 `display: none`，信息与模型设置应用均无旧 MC 能量顶栏叠加。
- 桌面端真实指针拖拽验证默认 `430 × 812` 可放大至约 `468 × 883`，再缩小恢复默认尺寸；两次均保持等比例。
- 两个缩放热区文本为空，截图中不存在新增提示标志。
- 浏览器无页面错误。

## 截图

- [桌面端信息应用](screenshots/0.6.4-desktop-information-app.png)
- [桌面端模型设置](screenshots/0.6.4-desktop-model-settings.png)
- [桌面端主页](screenshots/0.6.4-desktop-home.png)
- [窄屏信息应用](screenshots/0.6.4-narrow-information-app.png)
- [窄屏模型设置](screenshots/0.6.4-narrow-model-settings.png)
- [窄屏主页](screenshots/0.6.4-narrow-home.png)

以上为本地浏览器与模拟宿主证据，不替代 SillyTavern 1.18.0 中的真实触控、真实世界书/MVU与模型连接验收。
