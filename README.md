# 像素牌局 · 炸金花 / 德州扑克 联机 Demo

Phaser.js + Node.js + Socket.io 全 JavaScript 实现的多人桌游最小可运行 Demo。

## 功能一览

| 模块 | 说明 |
|---|---|
| 开始页 | 像素风大厅，创建/加入房间 |
| 房间制 | 4 位房间号，最多 **8 人**一桌，房主开局 |
| 游戏核心 | **炸金花**（看牌/跟注/加注/弃牌/开牌）和 **德州扑克**（让牌/跟注/加注/弃牌，翻牌前→翻牌→转牌→河牌→摊牌） |
| 实时同步 | Socket.io 服务器权威状态，手牌按玩家脱敏下发（看不到别人的牌） |
| 结算页 | 亮牌、牌型名称、筹码榜，房主可"再来一局" |
| 音效 | WebAudio 代码合成（发牌/下注/胜利/失败），无音频文件 |
| 分享 | 生成 `?room=xxxx` 邀请链接，支持系统分享/复制，点开自动进房 |
| 美术 | 全部 Phaser Graphics 代码绘制的像素/卡通风格，**零外部素材** |
| 移动端 | 720×1280 竖屏设计，FIT 自适应缩放，纯触摸操作 |

## 运行方法

```bash
cd poker-demo
npm install        # 安装 express / socket.io / phaser
npm start          # 启动服务器，默认 3000 端口
```

浏览器打开 `http://localhost:3000`。

**两人联机测试（同一台电脑）**：开两个浏览器窗口（或一个用隐身模式），
一个创建房间，另一个输入 4 位房间号加入，房主点击"开始游戏"。

**手机联机**：手机与电脑连同一 Wi-Fi，手机浏览器访问 `http://<电脑局域网IP>:3000`
（Windows 查 IP：`ipconfig` 看 IPv4 地址），或直接点分享出来的邀请链接。

## 异地联机（相隔千里也能玩）

双击 `start-online.bat`（或手动执行下面两步）：

```bash
npm start                                                          # 终端1: 启动游戏服务器
cloudflared tunnel --url http://localhost:3000 --no-autoupdate     # 终端2: 开公网隧道
```

隧道启动后会打印一个 `https://xxxx.trycloudflare.com` 地址，把它发给朋友，
对方在任何地方用手机/电脑浏览器打开即可一起玩（游戏内"分享"按钮生成的
邀请链接也会自动使用该公网域名）。

注意：
- 免费隧道**每次重启地址都会变**，重开服后要重新发新链接。
- 电脑不能关机/睡眠，关掉窗口 = 关服。
- 备用方案：已安装 `localtunnel`，可用 `npx localtunnel --port 3000` 开隧道
  （朋友首次访问需按页面提示输入你的公网 IP）。
- 想要固定地址长期开服，需部署到云服务器（Node 环境 + 开放端口即可，代码零改动）。

## 部署到云服务器（固定地址 · 24h 在线）

适合：你有一台带公网 IP 的云服务器（腾讯云 / 阿里云 / AWS / 任意厂商，Ubuntu 22.04+ 推荐）。
代码零改动，只靠 `PORT` 环境变量 + 进程守护 + 反向代理即可长期运行。

### 准备（一次性）
1. 云服务器**安全组**放行入站：`22`(SSH)、`80`、`443`(Web)；用 IP 直连还需放行 `3000`。
2. 本地装 `rsync`（Windows 用 Git Bash / WSL；Mac / Linux 自带）。

### 一键上线
```bash
# 1) 本地：把代码上传到服务器（替换成你的 用户@公网IP）
bash deploy/deploy.sh ubuntu@1.2.3.4

# 2) 服务器上首次初始化（装 Node / nginx / pm2 + 启动服务）
ssh ubuntu@1.2.3.4
cd /opt/poker-demo && bash deploy/setup-server.sh
```
脚本会自动安装 Node 20、nginx、pm2，并用 pm2 守护 `server.js`（崩溃自启、开机自启）。

### 用域名 + HTTPS（可选但建议）
- 域名 A 记录指向服务器 IP，然后：
  ```bash
  sudo cp deploy/poker-demo.conf /etc/nginx/sites-available/poker-demo
  sudo ln -s /etc/nginx/sites-available/poker-demo /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d poker.yourdomain.com   # 自动签发并续期 HTTPS
  ```
- 配好后访问 `https://poker.yourdomain.com`，游戏内"分享"链接自动带该域名。
- 不想配域名：直接用 `http://服务器IP:3000` 也能玩（记得放行 3000 端口）。

### 以后更新代码
改完本地代码，重跑 `bash deploy/deploy.sh ubuntu@1.2.3.4` 即可，pm2 自动重启。

### 不想管 Linux？零服务器 PaaS 方案
把代码推到 GitHub，用 PaaS 连仓库一键部署（端口读 `$PORT`，Start=`node server.js`）：
- **Railway** / **Render**：连仓库 → Start Command 填 `node server.js`
- **腾讯云 CloudBase**（国内快）：用「Web 应用」托管 Node，或静态托管 + 云函数

### deploy/ 目录清单
```
deploy/
├── deploy.sh           # 本地一键上传 + 重启（rsync + pm2）
├── setup-server.sh     # 服务器首次初始化（装 Node/nginx/pm2）
├── ecosystem.config.js # pm2 进程守护配置
├── poker-demo.conf     # nginx 反代配置（含 WebSocket Upgrade + HTTPS 模板）
└── poker-demo.service  # systemd 服务（不装 pm2 时的轻量替代）
```

## 没有云服务器？用 PaaS 零成本上线

没有自有服务器也能拿到**固定地址 + 24h 在线**，把代码交给托管平台替你跑 Node 进程即可。
项目已兼容：读 `process.env.PORT`、`start` 命令 `node server.js`，并附 `Procfile` / `railway.json` / `Dockerfile`。

### 路线 A：Railway（推荐，免费额度够 2~8 人玩）
1. 注册 [railway.app](https://railway.app)（可用 GitHub 登录）。
2. 把本仓库推到你的 GitHub（已帮你在本地 `git init` 并初次提交，补一行即可）：
   ```bash
   git remote add origin <你的GitHub仓库地址>
   git push -u origin main
   ```
3. Railway 控制台 → New Project → **Deploy from GitHub repo** → 选中仓库。
4. 平台自动识别 Node，部署完会给一个固定 `*.up.railway.app` 域名（可再绑自己的域名）。
5. 分享该地址给朋友，随时联机。

### 路线 B：Render（同样免费）
1. 注册 [render.com](https://render.com)。
2. New → **Web Service** → 连 GitHub 仓库。
3. Build Command: `npm install --omit=dev`，Start Command: `node server.js`，选 **Free** 计划。
4. 生成固定 `*.onrender.com` 地址。

### 路线 C：腾讯云 CloudBase（国内朋友延迟更低）
1. 注册腾讯云，开通 CloudBase「Web 应用」。
2. 连 GitHub 仓库或本地上传，`node server.js` 启动，平台分配域名。

> 本地已 `git init` 并提交初始版本；推仓库只需补 remote + push。
> 之后若买了自有云服务器，回到上一节的 `deploy/` 脚本即可 SSH 部署。

## 自动化测试

```bash
npm start          # 终端1: 先启动服务器
npm test           # 终端2: 模拟2个客户端各打完一局炸金花+一局德州
```

## 玩法说明（Demo 简化规则）

**通用**：每人初始 1000 筹码，每局底注 10，破产自动补码（仅 Demo）。

**炸金花**：每人 3 张暗牌。可随时"看牌"；轮到自己可 跟注 / 加注(+10) / 弃牌；
每人都行动过一轮后可"开牌"，所有未弃牌玩家比牌型：
豹子 > 顺金 > 金花 > 顺子 > 对子 > 散牌。

**德州扑克**：每人 2 张底牌 + 5 张公共牌，四轮下注（翻牌前/翻牌/转牌/河牌），
加注为固定额 +20，最后摊牌以 7 选 5 最大牌型定胜负。

## 项目结构

```
poker-demo/
├── server.js            # 后端入口：房间管理 + 回合状态机 + 状态脱敏广播
├── game-logic.js        # 纯逻辑：洗牌、炸金花/德州牌型判定与比较
├── public/
│   ├── index.html
│   ├── lib/phaser.min.js
│   └── js/
│       ├── main.js      # Phaser 启动配置（竖屏 FIT）
│       ├── scenes.js    # 大厅 / 房间 / 游戏 / 结算 四个场景
│       ├── ui.js        # 像素卡牌、按钮、面板绘制助手
│       ├── net.js       # Socket.io 客户端封装
│       └── audio.js     # WebAudio 合成音效
├── deploy/              # 云部署脚本（deploy.sh / setup-server.sh / nginx / pm2）
└── test/sim.js          # 2 客户端联机自动化测试
```

## Demo 简化项（后续可扩展）

- 下注为固定额，未实现自由加注额 / 边池 / 大小盲结构
- 炸金花未实现闷牌双倍、指定玩家单挑比牌
- 断线即弃牌离场，未做重连恢复
- 无账号体系与持久化，筹码仅存在于内存
