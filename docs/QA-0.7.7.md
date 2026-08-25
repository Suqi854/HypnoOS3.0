# HypnoOS 3.0 v0.7.7 QA

## 修正范围

- 作弊模式不再读取、启停、创建或修改世界书，也不再写入本轮操作作为剧情规则。
- 正确密钥开启后，催眠手机内全部 VIP 按 VIP6 解锁。
- 零花钱、星光点、MC能量在手机内显示和使用为无限；消费与奖励操作不会覆盖玩家原始资源及 VIP 变量。
- 关闭作弊模式后立即恢复原有变量读取。

## 自动验收

- `npm run check`：静态 UI 基线、作弊模式无世界书耦合、无限资源及 VIP 覆盖合同。
- `npm test`：11 项合同、导入、宿主适配和伴生世界书测试。
- Playwright + Chrome：桌面 `1180×900` 与窄屏 `760×900`。
- 错误密钥 `123456` 被拒绝；正确密钥 `666666` 开启后红色状态条可见。
- 信息应用的零花钱、星光点、MC能量均显示 `∞`。
- 催眠 APP 显示 `MC能量 ∞ / ∞`，VIP6 存在且不显示“未解锁”。
- 实际暂存一条催眠指令后，操作合同中的 MC 消耗为 `0（作弊模式无限资源，不扣除）`，且明确禁止修改世界书。
- 开启与关闭前后，宿主模拟 MVU 的原值始终为：零花钱 `3456`、星光点 `12`、MC能量 `66`、VIP 未写入。
- 手机根文档无整页滚动，内部长列表滚动与透明同步缩放继续通过。

## 截图

- `screenshots/0.7.7-desktop-cheat-mode-active.png`
- `screenshots/0.7.7-desktop-cheat-resources.png`
- `screenshots/0.7.7-desktop-cheat-vip6.png`
- `screenshots/0.7.7-narrow-cheat-mode-active.png`
- `screenshots/0.7.7-narrow-cheat-resources.png`
- `screenshots/0.7.7-narrow-cheat-vip6.png`

## 运行边界

以上浏览器验收使用模拟的 SillyTavern 1.18.0 宿主合同。真实角色卡、真实 MVU 扩展和连续模型回复仍由用户在实际 SillyTavern 中最终验收。
