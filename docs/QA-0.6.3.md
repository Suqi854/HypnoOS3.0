# 0.6.3 运行兼容回归记录

日期：2026-08-25。

## 新基线

- 手机前端 `ui/index.html` SHA-256：`2C1F623192AC13D61BDF0036CD20DED99716E07CE582C97D28B356FA70C49418`。
- 悬浮宿主 `public/floating-bootstrap.js` SHA-256：`D0BDF55676E490EC451CDCE21DF040280200174C7199863559BCB9A99CC4A994`。
- 插件宿主改用 `__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__` 与 `hypnoos3-extension-floating-phone-host`；不再读取、覆盖或销毁原4.3脚本的旧单例与宿主节点。

## 修改结果

- 打开内部应用前会卸载上一 React 应用的顶栏，因此“本轮输入”和返回桌面后不再残留 `MC能量 25 / 25 VIP0` 浮条。
- “本轮输入”增加“直接发送”：构造与“写入输入框”相同的唯一内容，经宿主 `#send_but` 主链触发发送；发送按钮不可用时不清空暂存。
- 世界书只按当前角色绑定关系读取主世界书、辅助世界书和聊天世界书；未导入的卡内 `character_book` 只读转换，不自动写入宿主。
- 变量桥优先读取最新消息楼层，依次发现同源 Tavern Helper/MVU 脚本 iframe，并在没有接口时读取消息自带变量；不执行卡内脚本。

## 自动检查

- 11 项 Node 单元测试通过，含当前角色世界书绑定、卡内世界书只读转换、最新消息变量回退与当前 swipe 选择。
- 桌面端与窄屏浏览器回归通过：根文档 `clientHeight = scrollHeight = 812`，手机内容 `430px` 铺满 iframe，5 个拖动节点保留。
- 人工注入的旧 `MC能量 25 / 25 VIP0` React 顶栏在进入“本轮输入”时被移除。
- 浏览器中读取到 `qa-book` 的 `QA地点` 条目，以及最新楼层 `MC能量 = 66`；“直接发送”只触发一次宿主发送按钮。
- 预置的4.3旧单例在插件启动和双视口回归后仍为原对象，`destroy()` 调用次数为 `0`。
- 浏览器无页面错误。

## 截图

- [桌面端主页](screenshots/0.6.3-desktop-home.png)
- [桌面端本轮输入](screenshots/0.6.3-desktop-input-app.png)
- [窄屏主页](screenshots/0.6.3-narrow-home.png)
- [窄屏本轮输入](screenshots/0.6.3-narrow-input-app.png)

以上为本地浏览器与模拟宿主证据，不替代 SillyTavern 1.18.0 中真实4.3原卡、真实 TH/MVU、真实世界书及模型发送的最终验收。
