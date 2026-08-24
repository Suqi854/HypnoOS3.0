# SillyTavern 1.18.0 能力快照

本地 1.18.0 宿主源码核对到以下扩展上下文能力：`getContext()`、`chatMetadata`、`saveMetadataDebounced()`、`setExtensionPrompt()`、`generateRaw()`、`getWorldInfoNames()`、`loadWorldInfo()`、`saveWorldInfo()`、`updateWorldInfoList()`、`eventSource` 与 `eventTypes`。

HypnoOS 将世界书、当前模型生成和提示词注入视为宿主能力；Tavern Helper 的 `getVariables/updateVariablesWith` 与 MVU 的 `getMvuData/replaceMvuData` 只作为可选桥。能力缺失时必须显示降级状态，不允许扩展启动失败。

这份文件是静态能力快照，不代表已经完成真实浏览器调用验收。
