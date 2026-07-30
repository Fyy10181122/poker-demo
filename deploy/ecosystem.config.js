/**
 * pm2 进程守护配置
 * 用法（在服务器 /opt/poker-demo 目录）：
 *   pm2 start ecosystem.config.js
 *   pm2 save        # 保存当前进程列表
 *   pm2 startup     # 生成开机自启（按提示执行它给出的命令）
 */
module.exports = {
  apps: [
    {
      name: 'pixel-poker',
      script: 'server.js',
      instances: 1,
      autorestart: true,        // 崩溃自动重启
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
