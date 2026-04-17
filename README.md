# Nav Atlas

> 一个面向 **AI / 设计 / 影视 / 高频工具** 的精选导航站，带完整后台管理能力与可直接部署的单机方案。  
> A curated navigation website for **AI, design, media, and everyday tools**, with admin management and a practical single-server deployment path.

<img src="./homepage-light.png" alt="Nav Atlas homepage preview" width="900" />

## 项目简介 | Overview

Nav Atlas 是一个“可运营”的导航站项目，不只是静态网址列表。

Nav Atlas is an operational navigation website, not just a static list of links.

它提供：

It provides:

- 面向访客的分类浏览与搜索体验
- 面向管理员的后台维护系统
- 链接、分类、元数据、设置等管理能力
- 适合个人/小团队部署的单机 file-mode 方案

If you want a navigation project that:

- 可自己维护内容
- 有后台
- 能较快上线
- 支持 Docker 部署

then this repository is built for exactly that kind of use case.

---

## 功能特性 | Features

- **分类导航 / Category browsing**：按分类浏览网站内容
- **站内搜索 / Built-in search**：快速检索站点与内容
- **后台管理 / Admin dashboard**：支持链接、分类、设置、导入、元数据等操作
- **认证登录 / Authenticated admin access**：管理员登录保护后台入口
- **Favicon / 元数据处理 / Favicon & metadata workflow**：支持站点图标与元数据相关能力
- **Docker 部署 / Docker-ready deployment**：已提供第一阶段生产部署方案

当前后台已包含这些主要入口 / Main admin routes:

- `/admin/links`
- `/admin/categories`
- `/admin/tags`
- `/admin/collections`
- `/admin/views`
- `/admin/settings`
- `/admin/tasks`
- `/admin/metadata`
- `/admin/health`

---

## 技术栈 | Tech Stack

- **Next.js 15**
- **React 19**
- **TypeScript**
- **NextAuth**
- **Prisma**

---

## 快速开始 | Quick Start

### 1. 安装依赖 | Install dependencies

```bash
npm install
```

### 2. 配置环境变量 | Configure environment variables

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

至少确认这些变量 / At minimum, confirm these values:

- `NAV_STORAGE_MODE`
- `AUTH_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NEXTAUTH_URL`
- `JOB_RUNNER_SECRET`

### 3. 启动开发环境 | Start the development server

```bash
npm run dev
```

默认本地访问 / Default local URL:

```text
http://localhost:3000
```

---

## 常用命令 | Common scripts

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:studio
```

---

## 部署 | Deployment

当前仓库已经提供第一阶段部署方式：

The current repository already includes a first-stage deployment path:

- GitHub 管理代码
- Docker Compose 运行应用
- 宿主机 Nginx 负责反向代理与 HTTPS
- `NAV_STORAGE_MODE="file"`
- 单机、单实例部署

详细说明请查看 / For the full deployment guide, see:

- [DEPLOY.md](./DEPLOY.md)

---

## 项目结构 | Project structure

```text
app/          Next.js App Router 页面与接口
components/   前端与后台组件
lib/          核心业务逻辑、存储、元数据、任务等
prisma/       Prisma schema
styles/       全局样式
docs/         设计文档与 rollout 计划
```

---

## 当前边界 | Current scope

当前版本更适合 / This version is best suited for:

- 单机部署
- 单实例运行
- file mode 持久化

当前不包含 / Not included in the current scope:

- 多副本横向扩容
- Redis
- 完整 CI/CD
- 生产级 database mode 上线方案

---

## 说明 | Notes

仓库默认不会提交这些本地内容 / The repository intentionally ignores these local-only files:

- `.env.local`
- `data/`
- `.next/`
- `node_modules/`

如果你要上线，请把真实环境变量放到服务器宿主机，而不是提交进仓库。  
For production deployment, keep real environment variables on the server host rather than committing them into the repository.
