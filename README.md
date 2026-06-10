# WorldCup AI Predictor

一个本地运行的世界杯信息与 AI 比分预测网站。

## 功能

- 查看赛程、比赛场地和阶段
- 查看球队信息、能力指标和球员名单
- 选择比赛后输入自定义预测规则
- 输出预测比分、胜平负概率和推理理由
- 支持 MiMo API；未配置 API Key 时自动使用本地规则模型兜底

## 启动

```bash
npm start
```

打开：

```text
http://localhost:4173
```

## 测试

```bash
npm test
```

## 刷新 FIFA 官方数据

```bash
npm run fetch:fifa
```

这个命令会从 FIFA API 获取 2026 男足世界杯数据，并重新生成 `src/data.js`：

- 48 支球队
- 每队 26 人名单
- 球员照片 URL（FIFA 有图时显示头像，没有图时显示位置占位）
- 104 场比赛日程，包括小组赛和淘汰赛占位场次

## MiMo 配置

服务端读取这些环境变量：

```bash
export MIMO_API_KEY=""
export MIMO_MODEL="mimo-v2.5-pro"
export MIMO_BASE_URL="https://api.xiaomimimo.com/v1/chat/completions"
npm start
```

预测请求不会把 API Key 暴露到浏览器，浏览器只调用本地的 `/api/predict`。

## 数据说明

当前 `src/data.js` 已由 FIFA API 生成。球队能力值目前仍是本地预测模型的中性默认值，后续可以把 FIFA 排名、近期战绩或你给的预测规则接入到预测模型。
