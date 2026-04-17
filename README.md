# Nav Atlas

> 一个面向 **AI / 设计 / 影视 / 高频工具** 的精选导航站，带完整后台管理能力与可直接部署的单机方案。

![Nav Atlas 首页预览](./homepage-light.png)

## 项目简介

Nav Atlas 是一个“可运营”的导航站项目，不只是静态网址列表。

它提供：

- 面向访客的分类浏览与搜索体验
- 面向管理员的后台维护系统
- 链接、分类、元数据、设置等管理能力
- 适合个人/小团队部署的单机 file-mode 方案

如果你想要的是一个：

- 可自己维护内容
- 有后台
- 能较快上线
- 支持 Docker 部署

的导航站，这个项目就是面向这种场景设计的。

---

## 功能特性

- **分类导航**：按分类浏览网站内容
- **站内搜索**：快速检索站点与内容
- **后台管理**：支持链接、分类、设置、导入、元数据等操作
- **认证登录**：管理员登录保护后台入口
- **Favicon / 元数据处理**：支持站点图标与元数据相关能力
- **Docker 部署**：已提供第一阶段生产部署方案

当前后台已包含这些主要入口：

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

## 技术栈

- **Next.js 15**
- **React 19**
- **TypeScript**
- **NextAuth**
- **Prisma**

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

至少确认这些变量：

- `NAV_STORAGE_MODE`
- `AUTH_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NEXTAUTH_URL`
- `JOB_RUNNER_SECRET`

### 3. 启动开发环境

```bash
npm run dev
```

默认本地访问：

```text
http://localhost:3000
```

---

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:studio
```

---

## 部署

当前仓库已经提供第一阶段部署方式：

- GitHub 管理代码
- Docker Compose 运行应用
- 宿主机 Nginx 负责反向代理与 HTTPS
- `NAV_STORAGE_MODE="file"`
- 单机、单实例部署

详细说明请查看：

- [DEPLOY.md](./DEPLOY.md)

---

## 项目结构

```text
app/          Next.js App Router 页面与接口
components/   前端与后台组件
lib/          核心业务逻辑、存储、元数据、任务等
prisma/       Prisma schema
styles/       全局样式
docs/         设计文档与 rollout 计划
```

---

## 当前边界

当前版本更适合：

- 单机部署
- 单实例运行
- file mode 持久化

当前不包含：

- 多副本横向扩容
- Redis
- 完整 CI/CD
- 生产级 database mode 上线方案

---

## 说明

仓库默认不会提交这些本地内容：

- `.env.local`
- `data/`
- `.next/`
- `node_modules/`

如果你要上线，请把真实环境变量放到服务器宿主机，而不是提交进仓库。
