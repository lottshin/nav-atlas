# nav-website Docker 部署说明

## 镜像部署路径（推荐）

优先使用 GHCR 镜像部署：

```text
ghcr.io/lottshin/nav-atlas:latest
```

这条路径适合 1Panel 和普通 Docker 服务器，部署时只需要拉取镜像并按运行时契约配置即可：

- **必须挂载** `/app/data` 到宿主机持久化目录
- **必须注入** 生产环境变量文件/环境变量
- **必须保持** `NAV_STORAGE_MODE="file"`，并且只允许**单实例**
- **必须保持** 宿主机 Nginx / 1Panel 反代模型，由外层代理负责 TLS 和公网入口

建议的镜像部署步骤：

1. 先拉取镜像：

   ```bash
   docker pull ghcr.io/lottshin/nav-atlas:latest
   ```

2. 创建宿主机持久化目录，并把数据挂载到容器的 `/app/data`
3. 注入生产环境变量，确保敏感信息来自宿主机的生产配置，不要写进镜像
4. 由 Nginx 或 1Panel 反向代理到容器监听端口

如果你使用 1Panel，镜像地址就填：

```text
ghcr.io/lottshin/nav-atlas:latest
```

首次发布后请额外检查 GHCR：

- package 是否已经出现在 GHCR 中
- package 是否正确关联到仓库 `lottshin/nav-atlas`
- 如果需要匿名拉取，请把 package 设为 **public**

## 源码部署路径（fallback / 高级路径）

以下内容保留为**fallback / 高级路径**：当镜像部署暂时不可用、或者你需要在服务器上直接从源码构建时，继续使用原有的 source clone + `docker compose build` / `docker compose up -d --build` 方案。

本文档只覆盖**第一阶段**的生产部署方式：

- 代码由 GitHub 管理
- Docker Compose 只运行应用本身
- 宿主机 Nginx 负责反向代理和 TLS
- 仅支持 `NAV_STORAGE_MODE="file"`
- 仅支持**单机、单实例**部署
- 持久化数据放在宿主机挂载目录，映射到容器的 `/app/data`
- 生产环境变量放在宿主机的 `../shared/env/production.env`

如果你需要数据库模式、多实例、或把 Nginx/TLS 也容器化，这份文档不适用。

---

## 1. 推荐主机目录结构

建议把代码和共享数据分开：

```text
/opt/nav-website/
  app/                    # GitHub 仓库 checkout
  shared/
    data/                 # 持久化文件数据
    env/
      production.env      # 生产环境变量
```

如果你的仓库 checkout 在 `/opt/nav-website/app`，那么 Compose 中的相对挂载路径：

- `../shared/data` -> `/opt/nav-website/shared/data`
- `../shared/env/production.env` -> `/opt/nav-website/shared/env/production.env`

这个布局的目的很简单：

- 代码更新和持久化数据分离
- 重建容器时不会丢数据
- 环境变量不进入仓库

---

## 2. 首次部署前准备

### 2.1 创建目录

```bash
sudo mkdir -p /opt/nav-website/app
sudo mkdir -p /opt/nav-website/shared/data
sudo mkdir -p /opt/nav-website/shared/env
```

### 2.2 从 GitHub 克隆代码

```bash
cd /opt/nav-website/app
git clone <YOUR_GITHUB_REPO_URL> .
```

如果你已经有现成 checkout，就直接放到 `/opt/nav-website/app`。

### 2.3 准备生产环境文件

把仓库里的模板复制到宿主机共享目录：

```bash
cp .env.production.example /opt/nav-website/shared/env/production.env
```

然后编辑 `/opt/nav-website/shared/env/production.env`，至少确认这些值：

- `NAV_STORAGE_MODE="file"`
- `AUTH_SECRET` 使用足够长的随机字符串
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NEXTAUTH_URL` 写成你的正式域名，例如 `https://example.com`
- `JOB_RUNNER_SECRET` 使用足够长的随机字符串

注意：

- **不要**把真实生产密钥提交到 GitHub
- **不要**把 `DATABASE_URL` 加进这份文件；第一阶段只做 file mode

### 2.4 迁移现有本地数据

如果你本地已经有 `data/` 目录，建议把**整个目录**复制到服务器共享目录，这样可以连同现有的：

- `navigation-store.json`
- `favicon-preferences.json`
- `favicon-cache/`

一起迁移过去。

例如从本地机器同步：

```bash
rsync -av ./data/ user@server:/opt/nav-website/shared/data/
```

如果是全新部署，可以先留空；应用首次启动时会自动初始化 `navigation-store.json`。

### 2.5 确保宿主机可写

当前镜像会以**非 root 的 `node` 用户**运行，因此宿主机数据目录必须对容器内的 UID/GID 可写。Linux 主机上最直接的做法是：

```bash
sudo chown -R 1000:1000 /opt/nav-website/shared/data
```

部署后如果发现保存失败，优先检查：

- `/opt/nav-website/shared/data` 是否存在
- `/opt/nav-website/shared/data` 是否已经授予容器用户写权限

---

## 3. 启动应用

在仓库 checkout 目录执行：

```bash
cd /opt/nav-website/app
docker compose up -d --build
```

这个命令会：

- 构建应用镜像
- 启动单个应用容器
- 绑定到 `127.0.0.1:3000`
- 挂载 `/opt/nav-website/shared/data:/app/data`
- 从 `/opt/nav-website/shared/env/production.env` 读取环境变量

### 3.1 常用检查命令

```bash
docker compose ps
docker compose logs -f
```

如果应用能正常启动，Nginx 还没配好时，也可以先在宿主机本地测：

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/admin/login
curl -I http://127.0.0.1:3000/search
```

---

## 4. 宿主机 Nginx 反向代理示例

Nginx 继续留在宿主机上做 TLS 和域名入口。下面是一个最小可用示例：

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }
}
```

操作边界要明确：

- **TLS 证书在宿主机管理**
- **公网流量只进 Nginx**
- **Compose 端口只绑定 `127.0.0.1:3000`**

---

## 5. 更新流程

后续更新时，一般只需要：

```bash
cd /opt/nav-website/app
git pull
docker compose up -d --build
```

推荐更新顺序：

1. 先备份 `shared/data` 和 `shared/env/production.env`
2. `git pull`
3. `docker compose up -d --build`
4. 检查日志和页面

如果只是改了环境变量，不一定要重新 clone；直接编辑 `/opt/nav-website/shared/env/production.env`，然后重建容器即可：

```bash
docker compose up -d --build
```

---

## 6. 备份建议

至少备份这两个位置：

- `/opt/nav-website/shared/data`
- `/opt/nav-website/shared/env/production.env`

建议策略：

- 每次升级前做一次快照或打包
- 保留最近几份可回滚版本
- 恢复时先停容器，再还原 `shared/data` 和 `production.env`

示例打包：

```bash
tar -czf nav-website-shared-$(date +%F).tgz /opt/nav-website/shared
```

---

## 7. 单实例 / file mode 限制

这个第一阶段部署有明确限制：

- 只能跑**一个**应用实例
- 只能用 `NAV_STORAGE_MODE="file"`
- 不能把同一份 `shared/data` 同时挂给多个容器实例写入
- 不支持横向扩容

原因很直接：`file` 模式会把状态写到本地文件，多个写者会引发数据竞争和不一致。

如果未来要做多实例或数据库模式，需要重新设计存储与运行方式；这不在本次 rollout 范围内。

---

## 8. 常见问题

### 8.1 应用容器启动了，但公网访问不了

先确认：

- Nginx 是否已经加载并重载配置
- 域名是否解析到这台服务器
- 防火墙是否放行 80/443
- `proxy_pass` 是否指向 `http://127.0.0.1:3000`

### 8.2 保存数据后重启丢失

通常是以下原因之一：

- 没有把宿主机目录挂载到 `/app/data`
- `shared/data` 权限不对，容器没写入成功
- 实际跑了多个实例，写入不是同一份目录

### 8.3 环境变量改了但没生效

确认你改的是宿主机上的：

```text
/opt/nav-website/shared/env/production.env
```

然后重新执行：

```bash
docker compose up -d --build
```

---

## 9. 这次部署不包含什么

本次第一版不包含：

- PostgreSQL
- Redis
- 多副本/多实例
- Nginx 容器
- 自动化 CI/CD
- `database` storage mode

这些都可以作为后续版本再做，但不要和第一阶段混在一起。
