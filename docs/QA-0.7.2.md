# 0.7.2 原 UI 适配回归记录

## 修正范围

- 世界书自动生成数据不再打开统一蓝色卡片页。
- 日历继续使用 4.3 月历、日期格和日期详情，只替换节日及详情。
- 课程表继续使用原周课表和课程单元，只替换课程、说明与时间映射。
- MC匿名版继续使用原分区、搜索和帖子列表，只替换帖子内容。
- 任务与成就继续使用原三页签和任务卡片，只替换目标角色、条件及奖励。
- 地图、监控和打工恢复原应用入口；原世界书保持只读。

## 自动验收

- `npm run check`：通过。
- `npm test`：通过。
- Playwright 静态预览：桌面与窄屏均通过；断言各应用原 class/DOM 存在且 `.st-adaptive-world-app` 不存在。
- 手机外层无整页滚动，四边移动与左右下角等比例缩放回归通过。

## 截图

- [桌面端日历原UI](screenshots/0.7.2-desktop-calendar-original-ui.png)
- [桌面端课程表原UI](screenshots/0.7.2-desktop-timetable-original-ui.png)
- [桌面端MC匿名版原UI](screenshots/0.7.2-desktop-mchan-original-ui.png)
- [桌面端任务与成就原UI](screenshots/0.7.2-desktop-rewards-original-ui.png)
- [窄屏日历原UI](screenshots/0.7.2-narrow-calendar-original-ui.png)
- [窄屏课程表原UI](screenshots/0.7.2-narrow-timetable-original-ui.png)
- [窄屏MC匿名版原UI](screenshots/0.7.2-narrow-mchan-original-ui.png)
- [窄屏任务与成就原UI](screenshots/0.7.2-narrow-rewards-original-ui.png)

## 尚待真实宿主验收

- SillyTavern 1.18.0 中真实世界书连续生成与跨聊天持久化。
- 不同模型输出日期/星期格式时的人工内容质量。
- 与角色卡自带 4.3 脚本同时启用时的真实交互。
