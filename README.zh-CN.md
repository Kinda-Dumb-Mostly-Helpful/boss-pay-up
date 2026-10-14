<p align="center">
  <img src="frontend/public/branding/boss-pay-up-logo-zh-CN.png" alt="老板打钱" width="200" />
</p>

# 老板打钱 · Boss Pay Up

[English](README.md) | **简体中文**

票都贴好了，老板，该打钱了。

面向团队的开源费用报销应用，基于 React、FastAPI 和 PostgreSQL。

## 功能

- 报销明细、多图附件、筛选与分页。
- 批次审批、历史留档，整批一键标记已报销。
- Excel 导出，通过浏览器打印窗口保存 PDF。
- 用户管理，语言与币种偏好保存到账号。
- 七种语言及对应 Logo，八种显示币种。

所有登录用户共享报销数据，仅用户管理限定管理员。切换币种不进行汇率换算。

## 快速启动

安装 Docker 和 Compose，在 PowerShell 中执行：

```powershell
git clone https://github.com/Kinda-Dumb-Mostly-Helpful/boss-pay-up.git boss-pay-up
cd boss-pay-up
Copy-Item .env.example .env
# 在 .env 中设置自己的 DB_PASSWORD。
docker compose up -d --build
```

访问 <http://localhost:8080>，创建管理员账号即可使用。

使用域名或其他端口时，修改 `.env` 中的 `CORS_ORIGINS`。已有安装请保留原来的 `COMPOSE_PROJECT_NAME`，继续使用原有数据卷。

执行 `docker compose down` 停止服务；加上 `-v` 会删除数据库和附件卷。

## 参与贡献

欢迎提交 Issue 和 PR：[GitHub](https://github.com/Kinda-Dumb-Mostly-Helpful/boss-pay-up)。

[登录说明](backend/LOGIN.md) · [字体说明](frontend/public/fonts/README.md) · [MIT 许可证](LICENSE)

第三方依赖与字体遵循各自许可证，本地 Helvetica 字体不随公开仓库分发。
