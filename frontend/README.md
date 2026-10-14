# 老板打钱 · Boss Pay Up · 前端

React 19、TypeScript 和 Vite 7。完整安装、功能及开源说明见[中文文档](../README.zh-CN.md) / [English](../README.md)。

```sh
npm ci
npm run dev -- --host localhost --port 5173 --strictPort
npm run build
```

前端使用同源 `/api`，开发时由 Vite 代理到 `http://127.0.0.1:8001`，需要先启动后端；Docker 中由 Nginx 转发。构建产物位于 `dist/`，字体配置见 [public/fonts/README.md](public/fonts/README.md)。
