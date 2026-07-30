/** main.js —— Phaser 启动配置（720x1280 竖屏，自适应缩放） */
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: UI.W,
  height: UI.H,
  backgroundColor: '#10131a',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [LobbyScene, RoomScene, GameScene, ResultScene]
};
new Phaser.Game(config);
