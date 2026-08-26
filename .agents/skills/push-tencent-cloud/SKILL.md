---
name: push-tencent-cloud
description: 把 GameHub 最新代码部署更新到腾讯云轻量服务器（线上地址 http://43.156.47.193）。当用户说「推送到腾讯云」「部署到腾讯云」「更新腾讯云/线上网站」「发布到服务器」「上线最新代码」时使用；也用于线上部署失败排查与回滚。
---

# 推送 GameHub 到腾讯云

目标服务器：腾讯云轻量 `lhins-3eh9vp2f`，公网 `43.156.47.193`（新加坡），OpenCloudOS 9.4。
部署模型：服务器 `/var/www/gamehub` 是 GitHub 仓库的 shallow clone，部署内容**永远来自 `origin/develop`**——先推 GitHub，再让服务器拉取构建。

用 TodoWrite 建立下面 5 步的任务清单再开工，构建步骤耗时长，清单能防止中途丢步骤。

## 1. 本地预检与推送

仓库主工作区在 `D:\Github\GameHub`（Git Bash 路径 `/d/Github/GameHub`）。若用户正在 worktree 里开发，先按 `project-workflow` skill 把功能分支合并回 `develop`，再回到主工作区执行本流程。

```bash
git -C /d/Github/GameHub status --short --branch
git -C /d/Github/GameHub fetch origin
git -C /d/Github/GameHub rev-parse --short=8 HEAD
git -C /d/Github/GameHub rev-parse --short=8 origin/develop
```

（注意：新版 git 的 `rev-parse --short` 只支持单个 revision，`--short=8 HEAD origin/develop` 这类多参数写法会报 `fatal: Needed a single revision`，必须拆成两条。）

- 有**未提交改动**：明确告诉用户这些改动不会随本次部署上线，不要自作主张代为提交。
- 本地 develop 领先 origin/develop：`git -C /d/Github/GameHub push origin develop`（服务器只能拉到 GitHub 上的代码，这一步不能省）。
- 记录待部署版本号 `origin/develop` 的短 SHA，并生成相对线上版本的变更文件列表（第 2 步拿到线上版本后 `git diff --name-only <线上SHA>..<待部署SHA>`），用于决定第 3 步的构建范围。

## 2. 服务器拉代码

SSH 已配免密（本机密钥 `~/.ssh/id_ed25519`）：`ssh root@43.156.47.193`。

每条 ssh 都是非登录新 shell，node 不在默认 PATH，**每条命令开头必须加**：

```bash
export PATH=/root/.nvm/versions/node/v22.23.2/bin:/usr/local/bin:$PATH
```

（若以后升级过服务器 Node，先 `ls /root/.nvm/versions/node/` 确认实际版本目录再替换路径；漏了会报 `node: command not found`。）

```bash
# 记录线上当前版本
ssh root@43.156.47.193 'cd /var/www/gamehub && git rev-parse --short HEAD'
# 拉取
ssh root@43.156.47.193 'cd /var/www/gamehub && git fetch origin develop && git pull --ff-only origin develop'
```

`pull --ff-only` 失败时：服务器仓库只作部署用途，正常应无本地改动；先 `git status --short` 看一眼被什么挡住，确认无有价值改动后 `git reset --hard origin/develop` 恢复干净再继续。

## 3. 依赖安装与构建

依赖安装只在 `pnpm-lock.yaml` 有变化时需要：`pnpm install --frozen-lockfile`（无变化时跑也很快，可直接跑）。

构建范围按第 1 步的 diff 判断：

- **只改了 server/ packages/ config/**（无 `client/` 文件）：只跑 `pnpm run build:server`（约 1–2 分钟）。
- **涉及 client/ 或无法判断**：完整构建 `pnpm run build`（server + 39 个语言包，2核2G 上约 15–25 分钟）。

```bash
ssh root@43.156.47.193 'cd /var/www/gamehub && export PATH=/root/.nvm/versions/node/v22.23.2/bin:/usr/local/bin:$PATH && export NODE_OPTIONS=--max-old-space-size=3072 && nohup pnpm run build > /var/www/gamehub/build.log 2>&1 & echo started'
```

构建命令用 `nohup ... &` 丢后台，然后用 `tail /var/www/gamehub/build.log` 轮询（配合 `sleep`，每轮 2–5 分钟），**不要用前台阻塞等待**——会撞 Bash 工具超时。完成后确认日志结尾无 `error`/`ELIFECYCLE`。

机器只有 2G 内存靠 8G swap 兜底；若进程被 OOM 杀掉，`free -m` 确认 swap 正常后原样重跑即可。Angular CLI 要求 Node ≥22.22.3，服务器 nvm 里是 v22.23.2。

## 4. 重启并验证

```bash
ssh root@43.156.47.193 'systemctl restart gamehub && sleep 10 && systemctl is-active gamehub'
ssh root@43.156.47.193 'curl -s http://127.0.0.1:9000/api/v1/ping'        # 期望 pong
curl -s -m 15 http://43.156.47.193/api/v1/ping                            # 期望 pong（云端防火墙已放行 80）
curl -s -o /dev/null -w "%{http_code}" http://43.156.47.193/              # 期望 200
ssh root@43.156.47.193 'journalctl -u gamehub -n 30 --no-pager | tail -30'
```

日志重点看启动段有无 error；数据库迁移在启动时自动执行，启动失败通常是迁移或配置问题，把关键日志行贴给用户。改过 `config/production.yaml` 才需要改配置，平时不要动。

## 5. 汇报（固定格式）

```
✅ 已推送 <待部署SHA> → 线上（原 <原线上SHA>）
范围：<仅 server / 完整构建>，耗时 <N> 分钟
验证：ping pong / 首页 200 / 启动日志无错误
备注：<未部署的本地改动、skip 的步骤等，没有则写"无">
```

## 回滚

```bash
ssh root@43.156.47.193 'cd /var/www/gamehub && git fetch origin && git reset --hard <旧版本SHA>'
```

然后必须**完整重新构建**（构建产物没有历史版本缓存）并重启。构建要 15–25 分钟，先告知用户预计时间。数据回滚（数据库）不在此流程内，涉及时单独评估。

## 环境事实（直接使用，勿重新推导）

- systemd 服务名 `gamehub`；nginx 反代 80 → 127.0.0.1:9000（`/etc/nginx/conf.d/gamehub.conf`）；PostgreSQL 库 `peertube_prod`（用户 `peertube`，密码在 `/var/www/gamehub/config/production.yaml`）；Redis 本机 6379；ffmpeg 静态版在 `/usr/local/bin`。
- systemd `ExecStart` 不能带 `--no-client`，否则 express 不挂载前端路由、SPA 全 404。
- 云端防火墙已放行 TCP 80；服务器 firewalld/SELinux 均未启用。不要主动开 80 以外的端口，用户要求时提醒其去腾讯云控制台「防火墙」页添加。
- 服务器上另有 OpenClaw 相关服务与文件，与本部署无关，**不要触碰**。
