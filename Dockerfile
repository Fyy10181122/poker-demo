# 通用容器镜像（Railway / Render / 任意支持容器的平台均可用）
# 不强制用 Docker，Node 项目平台也能直接 build；这里给一个备选。
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# server.js 读取 process.env.PORT，平台会注入；默认 3000
EXPOSE 3000
CMD ["node", "server.js"]
