# Taro Game Assistant

阿瓦隆桌游小助手前端，基于 Taro + React。

## 环境

- Node.js: 24
- 包管理器: npm

安装依赖：

```bash
npm ci
```

## 后端地址

本地后端：

```text
API: http://localhost:3000/api
WS:  ws://localhost:3000/ws
```

线上后端：

```text
API: https://lucas-avalon-service.duckdns.org/api
WS:  wss://lucas-avalon-service.duckdns.org/ws
```

## 本地开发

连接本地后端：

```bash
npm run dev:h5:local
```

连接线上后端：

```bash
npm run dev:h5:remote
```

默认 H5 开发命令：

```bash
npm run dev:h5
```

默认命令使用 `config/dev.ts` 中的开发环境配置。

## 构建

构建 H5，使用生产配置：

```bash
npm run build:h5
```

构建 H5，指定本地后端：

```bash
npm run build:h5:local
```

构建 H5，指定线上后端：

```bash
npm run build:h5:remote
```

构建产物输出到：

```text
dist/
```

## 本地预览构建产物

```bash
npx serve dist
```

如果端口冲突：

```bash
npx serve dist -l 8080
```

## Vercel 部署

Vercel 项目配置：

```text
Framework Preset: Other
Install Command: npm ci
Build Command: npm run build:h5:remote
Output Directory: dist
```

`build:h5:remote` 会使用线上后端：

```text
https://lucas-avalon-service.duckdns.org/api
wss://lucas-avalon-service.duckdns.org/ws
```

如果改用 `npm run build:h5`，也会使用 `config/prod.ts` 中的生产环境地址。

## 临时覆盖后端地址

可以通过环境变量覆盖默认配置：

```bash
TARO_APP_API_BASE_URL=http://localhost:3000/api \
TARO_APP_WS_BASE_URL=ws://localhost:3000/ws \
npm run build:h5
```

线上 HTTPS 页面必须连接 HTTPS/WSS 后端，不能连接 HTTP/WS。
