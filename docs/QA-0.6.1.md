# 0.6.1 主界面修正回归记录

日期：2026-08-24。

## 基线

- 手机前端 `ui/index.html` SHA-256：`918A769B3ED9DED1F72C190086FF8718208D80454EB163DB023FE25BC97BB395`。
- 悬浮宿主 `public/floating-bootstrap.js` SHA-256：`CF84C91CD7813CC855F760D4CBC5E188548D2A9960DF4A6277DC8BCC5B3319EF`。
- `legacy/` 历史材料未修改，构建脚本不会将其写入安装包。

## 自动检查

- iframe `scrolling="no"`；`html` 与 `body` 均为 `clientHeight = scrollHeight = 812`、`overflow: hidden`。
- `#app` 固定高度且 `overflow: hidden`；主屏滚轮和触摸滑动不会移动整张手机桌面。
- 帮助应用内容区为 `clientHeight 827 / scrollHeight 1245`，自动滚动由 `0` 到 `80`，证明应用内部滚动仍可用。
- 上、右、下、左四个透明热区均通过真实 Pointer 拖动，面板位置分别发生变化。
- 运行 DOM、手机前端和悬浮宿主均未发现已移除游戏演出模块的按钮、状态同步、弹窗、观察器或消息渲染器。
- 浏览器控制台无页面错误；静态检查、8 项单元测试和构建均为通过。

## 截图

- [桌面端](screenshots/0.6.1-desktop.png)
- [窄屏](screenshots/0.6.1-narrow.png)

以上是本地静态预览和浏览器执行证据，不替代 SillyTavern 1.18.0 真实安装、移动真机、TH/MVU 双环境与连续多轮模型验收。
