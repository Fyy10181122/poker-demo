/** ui.js —— 像素风 UI 绘制助手：卡牌 / 按钮 / 面板（全部代码绘制，无外部素材） */
const UI = {
  W: 720, H: 1280,
  COLORS: {
    bg: 0x1b5e3b, bgDark: 0x14482d, panel: 0x2a2f3a, panelLight: 0x3a4152,
    gold: 0xffd54f, red: 0xe05555, green: 0x66bb6a, blue: 0x5c9ce6,
    white: 0xffffff, gray: 0x9aa4b5
  },
  SUITS: ['♠', '♥', '♣', '♦'],
  SUIT_COLOR: ['#222831', '#d43a3a', '#222831', '#d43a3a'],
  RANKS: { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' },

  rankText(r) { return this.RANKS[r] || String(r); },

  /** 像素风卡牌，返回 Container。w 默认 110 */
  card(scene, x, y, card, faceUp, w) {
    w = w || 110;
    const h = w * 1.4, bw = Math.max(3, w * 0.045);
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    if (faceUp && card) {
      g.fillStyle(0xf5f0e6, 1).fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(bw, 0x222831, 1).strokeRect(-w / 2, -h / 2, w, h);
      const col = this.SUIT_COLOR[card.s];
      c.add(g);
      c.add(scene.add.text(-w / 2 + w * 0.09, -h / 2 + w * 0.05, this.rankText(card.r),
        { fontFamily: 'monospace', fontSize: Math.round(w * 0.30) + 'px', color: col, fontStyle: 'bold' }));
      c.add(scene.add.text(0, h * 0.12, this.SUITS[card.s],
        { fontFamily: 'monospace', fontSize: Math.round(w * 0.52) + 'px', color: col }).setOrigin(0.5));
    } else {
      g.fillStyle(0x3b5bd6, 1).fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(bw, 0x222831, 1).strokeRect(-w / 2, -h / 2, w, h);
      // 像素格背纹
      g.fillStyle(0x5c7ae6, 1);
      const cell = w / 7;
      for (let i = 1; i < 6; i++)
        for (let j = 1; j < 9; j++)
          if ((i + j) % 2 === 0) g.fillRect(-w / 2 + i * cell, -h / 2 + j * cell, cell, cell);
      c.add(g);
      c.add(scene.add.text(0, 0, '★', { fontFamily: 'monospace', fontSize: Math.round(w * 0.4) + 'px', color: '#ffd54f' }).setOrigin(0.5));
    }
    return c;
  },

  /** 像素风按钮（带按压反馈 + 点击音效） */
  button(scene, x, y, w, h, label, color, cb, fontSize) {
    const c = scene.add.container(x, y);
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
    const g = scene.add.graphics();
    g.fillStyle(color, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(4, 0x10131a, 1).strokeRect(-w / 2, -h / 2, w, h);
    const t = scene.add.text(0, 0, label,
      { fontFamily: 'monospace', fontSize: (fontSize || 30) + 'px', color: '#10131a', fontStyle: 'bold' }).setOrigin(0.5);
    c.add([shadow, g, t]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => { c.y += 3; SFX.click(); });
    c.on('pointerup', () => { c.y -= 3; cb && cb(); });
    c.on('pointerout', () => { c.y = y; });
    c.btnText = t;
    return c;
  },

  /** 深色面板 */
  panel(scene, x, y, w, h, color) {
    const g = scene.add.graphics();
    g.fillStyle(color || this.COLORS.panel, 0.95).fillRect(x - w / 2, y - h / 2, w, h);
    g.lineStyle(4, 0x10131a, 1).strokeRect(x - w / 2, y - h / 2, w, h);
    return g;
  },

  text(scene, x, y, str, size, color, origin) {
    const t = scene.add.text(x, y, str, {
      fontFamily: 'monospace', fontSize: (size || 26) + 'px',
      color: color || '#ffffff', fontStyle: 'bold', align: 'center'
    });
    t.setOrigin(origin === undefined ? 0.5 : origin);
    return t;
  },

  /** 玩家名字随机默认值 */
  defaultName() {
    const saved = localStorage.getItem('pp_name');
    if (saved) return saved;
    return '玩家' + Math.floor(Math.random() * 900 + 100);
  },
  askName() {
    const n = window.prompt('请输入你的昵称（8字以内）', this.defaultName());
    const name = (n || this.defaultName()).slice(0, 8);
    localStorage.setItem('pp_name', name);
    return name;
  }
};
