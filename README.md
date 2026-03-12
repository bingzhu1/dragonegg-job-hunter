# 龙蛋计划（MVP）

一个 AI 求职申请 Copilot：基于 **职位描述（JD）** + **基础简历** 生成结构化的定制建议与改写对照。

## 本地运行

1) 安装依赖

```bash
npm install
```

2) 配置环境变量

- 复制 `.env.example` 为 `.env.local`
- 填入你的 OpenAI Key：

```bash
OPENAI_API_KEY=你的key
```

3) 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 核心页面（当前 MVP）

- `/new`：粘贴 JD + 基础简历，提交后跳转
- `/tailor`：服务端调用 OpenAI Responses API 返回结构化“定制结果”（失败会自动回退到规则模拟）
- `/dashboard`：投递记录（当前仅演示，无数据库）
