# 0.6.5 自定义直连回归记录

日期：2026-08-25。

## 新基线

- 手机前端 `ui/index.html` SHA-256：`99F45E074AB9126E22C2E79DE59392E2134980D3B31F56DFABED3B707DCB757A`。
- 自定义直连把用户填写值解释为 OpenAI 兼容基础 URL，不再直接向基础 URL 发送生成请求。

## 修改结果

- “加载模型”向 `{基础 URL}/models` 发出 GET 请求，并携带当前会话密钥。
- 返回的 `data[].id`、`models[].id/name` 或数组会转换为去重排序后的模型列表。
- 模型名输入框只读；玩家只能从加载后的模型列表选择，选择结果自动回填。
- 保存和测试直连前必须已经选择模型。
- 文生文生成向 `{基础 URL}/chat/completions` 发出 POST 请求；直连不再被外部地址判断改走酒馆代理。
- 模型列表与生成请求均有明确 HTTP、超时和浏览器 CORS 错误反馈；密钥仍只保存在会话存储中。

## 自动检查

- 模拟 OpenAI 兼容端点返回两个模型，浏览器完成“直连 → 填端点/密钥 → 加载 → 选择 → 保存 → 测试连接”全流程。
- 断言模型名控件为只读，保存值为 `qa-model-pro`。
- 断言请求地址分别为 `/v1/models` 与 `/v1/chat/completions`，生成请求模型字段正确。
- 桌面端与窄屏回归、静态检查、11 项单元测试和构建均通过。

## 截图

- [桌面端模型列表](screenshots/0.6.5-desktop-model-list.png)
- [桌面端模型设置](screenshots/0.6.5-desktop-model-settings.png)
- [窄屏模型列表](screenshots/0.6.5-narrow-model-list.png)
- [窄屏模型设置](screenshots/0.6.5-narrow-model-settings.png)

模拟端点可以证明请求合同与界面流程，不替代玩家所用 API 服务的真实 CORS、鉴权和模型兼容性验收。
