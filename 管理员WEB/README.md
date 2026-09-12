# 管理员WEB

浏览器端管理页：连接本项目 **uniCloud** 云函数 `admin-web`。

## 功能

| 模块 | 说明 |
|------|------|
| **数据概览** | 用户数、封号数、广场帖子总数/可见数、云游记、评论、点赞、审计条数 |
| **用户** | 搜索、分页、详情（用量 + 近期帖子/云游记/图片 URL）、**封号 / 解封**、**匿名化**、复制 UID |
| **广场帖子** | 按关键词巡查、**隐藏 / 恢复**（`is_hidden`，小程序列表需配合过滤隐藏帖） |
| **审计** | 管理操作记录分页查看 |

依赖：`npm install` 安装浏览器端 uniCloud 客户端。页面会调用真实云函数，不包含演示或模拟数据。

## 1. 云端准备

1. 在 **uniCloud 控制台** 上传并部署云函数：`uniCloud-aliyun/cloudfunctions/admin-web`。
2. 打开该云函数 → **环境变量**，新增：
   - `ADMIN_WEB_TOKEN` = 自行生成一串足够长的随机口令（仅你本人知晓）。
3. 上传数据库表结构：`uniCloud-aliyun/database/admin_audit_logs.schema.json`（及已扩展的 `community_posts` / `post_comments` / `travel_notes` 中匿名相关字段，若控制台提示需更新则一并上传）。

## 2. 本地运行

```bash
cd 管理员WEB
npm install
npm run dev
```

浏览器访问终端提示的地址（默认 `http://localhost:5174`）。

首次使用在页面填写：

- **spaceId**、**clientSecret**：从 uniCloud 服务空间配置中获取（仅你自己使用，勿公开仓库）。
- **管理口令**：与云函数环境变量 `ADMIN_WEB_TOKEN` 相同。

填写后点 **连接并校验**。连接成功后可搜索用户、看详情、封号/解封、匿名化，并切换到 **审计** 查看操作记录。

连接信息只保存在当前浏览器标签页的会话存储中；点击“退出连接”会立即清除。

## 3. 打包静态资源

```bash
npm run build
```

将 `dist/` 部署到任意仅你本人可访问的 HTTPS 站点或内网静态服务器。

## 4. 安全说明

- `clientSecret` 在浏览器侧使用存在泄露面，务必 **限制管理页访问范围** + **高强度 ADMIN_WEB_TOKEN**，不要把密钥写入 Vite 环境变量后发布到静态站点。
- 生产环境更推荐：**云函数 URL 化 + 仅内网 IP** 或自建网关鉴权。
