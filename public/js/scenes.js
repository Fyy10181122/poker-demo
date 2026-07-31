/** scenes.js —— 四个场景：大厅 / 房间 / 游戏 / 结算 */

/* ================= 大厅（开始页） ================= */
class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }
  create() {
    NET.connect();
    NET.onState = null;
    const { W, H, COLORS } = UI;
    this.add.graphics().fillGradientStyle(0x10131a, 0x10131a, 0x1b2a4a, 0x1b2a4a, 1).fillRect(0, 0, W, H);

    // 标题 + 装饰牌
    UI.card(this, W / 2 - 130, 250, { r: 14, s: 0 }, true, 130).setAngle(-12);
    UI.card(this, W / 2 + 130, 250, { r: 14, s: 1 }, true, 130).setAngle(12);
    UI.card(this, W / 2, 235, null, false, 130);
    UI.text(this, W / 2, 470, '像 素 牌 局', 72, '#ffd54f');
    UI.text(this, W / 2, 545, '炸金花 · 德州扑克 · 最多8人联机', 26, '#9aa4b5');

    UI.button(this, W / 2, 700, 480, 96, '创建房间 · 炸金花', COLORS.gold, () => this.createRoom('zjh'));
    UI.button(this, W / 2, 830, 480, 96, '创建房间 · 德州扑克', COLORS.blue, () => this.createRoom('texas'));
    UI.button(this, W / 2, 960, 480, 96, '加入房间', COLORS.green, () => this.joinRoom());
    UI.text(this, W / 2, 1130, '提示: 手机与电脑需连接同一局域网\n用房间号或分享链接加入', 22, '#9aa4b5');

    // 分享链接自动加入 ?room=xxxx
    const params = new URLSearchParams(location.search);
    const rid = params.get('room');
    if (rid) {
      history.replaceState(null, '', location.pathname);
      const name = UI.askName();
      const tryJoin = () => NET.joinRoom(rid, name, res => {
        if (res.error) alert(res.error);
        else this.scene.start('Room');
      });
      if (NET.socket.connected) tryJoin();
      else NET.socket.once('connect', tryJoin);
    }
  }
  createRoom(mode) {
    const name = UI.askName();
    NET.createRoom(name, mode, res => {
      if (res.error) return alert(res.error);
      this.scene.start('Room');
    });
  }
  joinRoom() {
    const rid = window.prompt('请输入4位房间号');
    if (!rid) return;
    const name = UI.askName();
    NET.joinRoom(rid.trim(), name, res => {
      if (res.error) return alert(res.error);
      this.scene.start('Room');
    });
  }
}

/* ================= 房间（等待开局） ================= */
class RoomScene extends Phaser.Scene {
  constructor() { super('Room'); }
  create() {
    const { W, H, COLORS } = UI;
    this.add.graphics().fillStyle(0x10131a, 1).fillRect(0, 0, W, H);
    this.dyn = this.add.container(0, 0);
    NET.onState = s => {
      if (s.state === 'playing') { this.scene.start('Game'); return; }
      this.render(s);
    };
    if (NET.state) this.render(NET.state);
  }
  render(s) {
    const { W, COLORS } = UI;
    this.dyn.removeAll(true);
    const d = this.dyn;
    d.add(UI.text(this, W / 2, 130, s.mode === 'zjh' ? '炸 金 花' : '德 州 扑 克', 56, '#ffd54f'));
    d.add(UI.text(this, W / 2, 230, '房间号', 26, '#9aa4b5'));
    d.add(UI.text(this, W / 2, 300, s.roomId, 88, '#ffffff'));

    d.add(UI.panel(this, W / 2, 620, 560, 420));
    d.add(UI.text(this, W / 2, 450, `玩家 ${s.players.length} / 8`, 28, '#9aa4b5'));
    s.players.forEach((p, i) => {
      const y = 510 + i * 46;
      const tag = p.id === s.hostId ? ' [房主]' : '';
      const self = p.id === NET.myId ? ' ←我' : '';
      d.add(UI.text(this, W / 2, y, `${i + 1}. ${p.name}${tag}${self}`, 28,
        p.id === NET.myId ? '#ffd54f' : '#ffffff'));
    });

    d.add(UI.button(this, W / 2, 920, 480, 90, '分享房间', COLORS.blue, () => this.share(s.roomId)));
    if (NET.isHost()) {
      const ok = s.players.length >= 2;
      d.add(UI.button(this, W / 2, 1040, 480, 96,
        ok ? '开始游戏' : '等待玩家加入…', ok ? COLORS.gold : 0x555c6b,
        () => { if (ok) NET.start(); }));
    } else {
      d.add(UI.text(this, W / 2, 1040, '等待房主开始…', 30, '#9aa4b5'));
    }
    d.add(UI.button(this, W / 2, 1160, 480, 80, '退出房间', COLORS.red, () => {
      NET.leave(); this.scene.start('Lobby');
    }, 26));
  }
  share(roomId) {
    const url = `${location.origin}${location.pathname}?room=${roomId}`;
    const text = `来玩像素牌局！房间号 ${roomId}，点链接直接加入: ${url}`;
    if (navigator.share) {
      navigator.share({ title: '像素牌局', text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('邀请链接已复制，发给好友吧！'));
    } else {
      window.prompt('复制下面的邀请链接:', url);
    }
  }
}

/* ================= 游戏核心 ================= */
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  create() {
    const { W, H } = UI;
    // 桌面背景
    const g = this.add.graphics();
    g.fillStyle(0x10131a, 1).fillRect(0, 0, W, H);
    g.fillStyle(UI.COLORS.bg, 1).fillRoundedRect(30, 120, W - 60, H - 420, 60);
    g.lineStyle(8, 0x0d3a24, 1).strokeRoundedRect(30, 120, W - 60, H - 420, 60);
    this.dyn = this.add.container(0, 0);
    this.prevLogLen = 0;
    this.raiseOpen = false;
    NET.onState = s => {
      if (s.state === 'ended') { this.scene.start('Result'); return; }
      if (s.state === 'waiting') { this.scene.start('Room'); return; }
      this.render(s);
    };
    if (NET.state) {
      if (NET.state.state === 'ended') this.scene.start('Result');
      else this.render(NET.state);
    }
    SFX.deal();
  }

  /** 座位坐标：自己永远在下方，其余按顺序排到桌子四周（最多8人） */
  seatPos(idxFromMe, total) {
    const { W } = UI;
    if (idxFromMe === 0) return { x: W / 2, y: 880, self: true };
    const others = total - 1;
    const spots = [];
    if (others === 1) spots.push([W / 2, 235]);
    else if (others <= 3) {
      const xs = [W / 4, W / 2, (3 * W) / 4];
      for (let i = 0; i < others; i++) spots.push([xs[Math.floor(i * 3 / others) % 3], 235]);
      if (others === 2) { spots.length = 0; spots.push([W / 3, 235], [(2 * W) / 3, 235]); }
    } else {
      // 4~7 名其他玩家：两侧 + 顶部
      const top = Math.min(3, others - 2);
      const sides = others - top;
      const layout = [];
      layout.push([110, 560]); // 左
      if (sides >= 2) layout.push([W - 110, 560]); // 右
      if (sides >= 3) layout.push([110, 380]);
      if (sides >= 4) layout.push([W - 110, 380]);
      const xs = top === 1 ? [W / 2] : top === 2 ? [W / 3, (2 * W) / 3] : [W / 4, W / 2, (3 * W) / 4];
      xs.forEach(x => layout.push([x, 225]));
      spots.push(...layout);
    }
    const [x, y] = spots[idxFromMe - 1] || [UI.W / 2, 235];
    return { x, y, self: false };
  }

  render(s) {
    const { W, H, COLORS } = UI;
    this.dyn.removeAll(true);
    const d = this.dyn;
    const me = NET.me();
    const myIdx = s.players.findIndex(p => p.id === NET.myId);

    // 顶部信息条
    d.add(UI.text(this, 60, 60, `房间 ${s.roomId}`, 24, '#9aa4b5', 0));
    d.add(UI.text(this, W - 60, 60, s.mode === 'zjh' ? '炸金花' : '德州扑克', 24, '#ffd54f', 1));

    // 底池
    d.add(UI.text(this, W / 2, 470, `底池 ${s.pot}`, 40, '#ffd54f'));
    d.add(UI.text(this, W / 2, 520, `当前注 ${s.currentBet}`, 24, '#9aa4b5'));

    // 公共牌（德州）
    if (s.mode === 'texas') {
      const cw = 92, gap = 12;
      const startX = W / 2 - 2 * (cw + gap);
      for (let i = 0; i < 5; i++) {
        const cd = s.community[i];
        d.add(UI.card(this, startX + i * (cw + gap), 620, cd || null, !!cd, cw));
      }
    }

    // 玩家
    s.players.forEach((p, i) => {
      const rel = (i - myIdx + s.players.length) % s.players.length;
      const pos = this.seatPos(rel, s.players.length);
      this.drawPlayer(d, p, pos, s);
    });

    // 日志
    const logStr = (s.log || []).slice(-3).join('\n');
    d.add(UI.text(this, W / 2, 1035, logStr, 20, '#cfd8e6'));
    if (s.log && s.log.length !== this.prevLogLen) { this.prevLogLen = s.log.length; SFX.chip(); }

    // 操作按钮
    this.drawActions(d, s, me);

    // 摊牌前看牌选择（最先 All-in 的玩家）
    if (s.state === 'showdown-look') {
      if (s.awaitingLookId === NET.myId) {
        d.add(UI.text(this, W / 2, 1080, '你最先 All-in！选择看牌：', 30, '#ffd54f'));
        d.add(UI.button(this, W / 2 - 180, 1180, 320, 96, '看1次', COLORS.blue, () => NET.action({ type: 'look', n: 1 }), 28));
        d.add(UI.button(this, W / 2 + 180, 1180, 320, 96, '看2次', COLORS.blue, () => NET.action({ type: 'look', n: 2 }), 28));
      } else {
        const fp = s.players.find(q => q.id === s.awaitingLookId);
        d.add(UI.text(this, W / 2, 1160, `等待 ${fp ? fp.name : '最先 All-in 玩家'} 看牌…`, 28, '#9aa4b5'));
      }
    }
  }

  drawPlayer(d, p, pos, s) {
    const isTurn = s.turnId === p.id;
    const w = pos.self ? 0 : 180;
    const loanStr = p.loan > 0 ? ` 借${p.loan}` : '';
    if (!pos.self) {
      d.add(UI.panel(this, pos.x, pos.y, 190, 150, isTurn ? 0x4a5a2a : UI.COLORS.panel));
      d.add(UI.text(this, pos.x, pos.y - 50, p.name + (isTurn ? ' ◀' : '') + loanStr + (p.allIn ? ' [All-in]' : ''), 24, isTurn ? '#ffd54f' : '#ffffff'));
      d.add(UI.text(this, pos.x, pos.y + 48, `筹码 ${p.chips}`, 20, '#66bb6a'));
      // 对手手牌（背面小牌）
      const n = p.cardCount, cw = 40;
      for (let i = 0; i < n; i++) {
        const cx = pos.x - ((n - 1) * (cw * 0.6)) / 2 + i * cw * 0.6;
        if (p.folded) {
          d.add(UI.text(this, pos.x, pos.y, '弃牌', 26, '#e05555'));
          break;
        }
        d.add(UI.card(this, cx, pos.y, p.cards[i] || null, p.cards.length > 0, cw));
      }
      if (p.betThisRound > 0) d.add(UI.text(this, pos.x, pos.y + 78, `注 ${p.betThisRound}`, 18, '#ffd54f'));
    } else {
      // 自己：大牌在底部，按 seenCount 显示已看的牌，其余背面
      const n = p.cardCount, cw = 150;
      const seen = p.seenCount || 0;
      d.add(UI.text(this, UI.W / 2, 760, (isTurn ? '▶ 轮到你了 ◀' : p.name) + `　筹码 ${p.chips}` + loanStr,
        28, isTurn ? '#ffd54f' : '#ffffff'));
      for (let i = 0; i < n; i++) {
        const cx = UI.W / 2 - ((n - 1) * (cw * 0.72)) / 2 + i * cw * 0.72;
        const faceUp = i < seen;
        const cardC = UI.card(this, cx, 900, faceUp ? p.cards[i] : null, faceUp, cw);
        if (p.folded) cardC.setAlpha(0.35);
        d.add(cardC);
      }
      if (p.folded) d.add(UI.text(this, UI.W / 2, 900, '已弃牌', 40, '#e05555'));
      else if (seen < n) d.add(UI.text(this, UI.W / 2, 985, `（已看 ${seen}/${n} 张）`, 22, '#9aa4b5'));
    }
  }

  drawActions(d, s, me) {
    const { W, COLORS } = UI;
    if (!me || me.folded) return;
    if (s.state !== 'playing') return; // 摊牌看牌阶段不显示常规按钮
    const myTurn = NET.isMyTurn();
    const y1 = 1120, y2 = 1215, bw = 158, bh = 82;
    const xs = [W / 2 - 255, W / 2 - 85, W / 2 + 85, W / 2 + 255];
    const dis = 0x555c6b;
    const btn = (x, y, label, color, enabled, cb, fs) =>
      d.add(UI.button(this, x, y, bw, bh, label, enabled ? color : dis, () => { if (enabled) cb(); }, fs || 24));
    const levels = [50, 100, 200, 500];

    // 向银行借款（始终可用，每次 +1000）
    btn(xs[0], y2, '借款+1000', 0x8d6e63, true, () => { NET.borrow(); SFX.chip(); });

    // 加注档位展开
    if (this.raiseOpen) {
      levels.forEach((lv, i) => btn(xs[i], y1, `+${lv}`, COLORS.gold, myTurn,
        () => { NET.action({ type: 'raise', amount: lv }); this.raiseOpen = false; }, 24));
      btn(xs[3], y2, '取消', dis, true, () => { this.raiseOpen = false; this.render(NET.state); }, 22);
      return;
    }

    if (s.mode === 'zjh') {
      const seen = me.seenCount || 0;
      const canLook = seen < me.cardCount;
      btn(xs[0], y1, '看1张', COLORS.blue, canLook, () => { NET.action({ type: 'look', n: 1 }); SFX.deal(); }, 22);
      btn(xs[1], y1, '看2张', COLORS.blue, canLook && seen < me.cardCount - 1, () => { NET.action({ type: 'look', n: 2 }); SFX.deal(); }, 22);
      btn(xs[2], y1, '加注', COLORS.gold, myTurn, () => { this.raiseOpen = true; this.render(NET.state); }, 22);
      btn(xs[3], y1, '弃牌', COLORS.red, myTurn, () => { NET.action({ type: 'fold' }); SFX.fold(); });
      btn(xs[1], y2, `跟注${s.currentBet}`, COLORS.green, myTurn, () => NET.action({ type: 'call' }), 22);
      btn(xs[2], y2, '开牌', 0xb388ff, myTurn && s.canOpen, () => NET.action({ type: 'open' }), 24);
    } else {
      const diff = s.currentBet - me.betThisRound;
      const iAmAllIn = me.allIn;
      if (iAmAllIn) {
        btn(xs[1], y1, '已 All-in', dis, false, () => {});
      } else if (s.allInLocked) {
        // All-in 锁定：本人不能加注，他人只能跟注 / 弃牌
        if (diff <= 0) btn(xs[0], y1, '跟注', COLORS.green, myTurn, () => NET.action({ type: 'call' }), 22);
        else btn(xs[0], y1, `跟注${diff}`, COLORS.green, myTurn, () => NET.action({ type: 'call' }), 22);
        btn(xs[1], y1, '加注', COLORS.gold, false, () => {});
        btn(xs[2], y1, 'All-in', 0xff7043, false, () => {});
        btn(xs[3], y1, '弃牌', COLORS.red, myTurn, () => { NET.action({ type: 'fold' }); SFX.fold(); });
      } else {
        if (diff <= 0) btn(xs[0], y1, '让牌', COLORS.blue, myTurn, () => NET.action({ type: 'check' }));
        else btn(xs[0], y1, `跟注${diff}`, COLORS.green, myTurn, () => NET.action({ type: 'call' }), 22);
        btn(xs[1], y1, '加注', COLORS.gold, myTurn, () => { this.raiseOpen = true; this.render(NET.state); }, 22);
        btn(xs[2], y1, 'All-in≤1000', 0xff7043, myTurn && me.chips > 0, () => NET.action({ type: 'allin' }), 18);
        btn(xs[3], y1, '弃牌', COLORS.red, myTurn, () => { NET.action({ type: 'fold' }); SFX.fold(); });
      }
      // 德州也支持闷牌看牌
      const seen = me.seenCount || 0;
      const canLook = seen < me.cardCount;
      btn(xs[1], y2, '看1张', COLORS.blue, canLook, () => { NET.action({ type: 'look', n: 1 }); SFX.deal(); }, 22);
      btn(xs[2], y2, '看2张', COLORS.blue, canLook && seen < me.cardCount - 1, () => { NET.action({ type: 'look', n: 2 }); SFX.deal(); }, 22);
      const stageName = ['翻牌前', '翻牌圈', '转牌圈', '河牌圈'][s.stage] || '';
      d.add(UI.text(this, xs[3], y2, stageName, 24, '#9aa4b5'));
    }
  }
}

/* ================= 结算页 ================= */
class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  create() {
    const { W, H, COLORS } = UI;
    this.add.graphics().fillStyle(0x10131a, 1).fillRect(0, 0, W, H);
    this.dyn = this.add.container(0, 0);
    NET.onState = s => {
      if (s.state === 'playing') { this.scene.start('Game'); return; }
      if (s.state === 'waiting') { this.scene.start('Room'); return; }
      this.render(s);
    };
    if (NET.state) this.render(NET.state);
  }
  render(s) {
    const { W, COLORS } = UI;
    this.dyn.removeAll(true);
    const d = this.dyn;
    const r = s.result;
    if (!r) return;
    const iWon = r.winnerIds.includes(NET.myId);
    if (!this.played) { this.played = true; iWon ? SFX.win() : SFX.lose(); }

    d.add(UI.text(this, W / 2, 150, iWon ? '🏆 你赢了！' : '本局结束', 60, iWon ? '#ffd54f' : '#ffffff'));
    d.add(UI.text(this, W / 2, 240, `${r.winnerNames.join('、')} 赢得底池 ${r.pot}`, 30, '#66bb6a'));
    d.add(UI.text(this, W / 2, 290, `（${r.reason}）`, 24, '#9aa4b5'));

    // 亮牌区
    let y = 400;
    if (r.hands) {
      Object.entries(r.hands).forEach(([pid, h]) => {
        const p = s.players.find(q => q.id === pid);
        const isW = r.winnerIds.includes(pid);
        d.add(UI.text(this, 130, y, `${p ? p.name : '?'}\n${h.name}`, 26, isW ? '#ffd54f' : '#ffffff'));
        h.cards.forEach((c, i) => d.add(UI.card(this, 300 + i * 90, y, c, true, 80)));
        if (isW) d.add(UI.text(this, 640, y, '胜', 36, '#ffd54f'));
        y += 160;
      });
    }
    // 筹码榜
    d.add(UI.text(this, W / 2, y + 30, '—— 筹码榜 ——', 26, '#9aa4b5'));
    [...s.players].sort((a, b) => b.chips - a.chips).forEach((p, i) => {
      const loanTxt = p.loan > 0 ? ` (借${p.loan})` : '';
      d.add(UI.text(this, W / 2, y + 80 + i * 40, `${i + 1}. ${p.name}  ${p.chips}${loanTxt}`, 26,
        p.id === NET.myId ? '#ffd54f' : '#ffffff'));
    });

    if (NET.isHost()) {
      d.add(UI.button(this, W / 2, 1120, 480, 92, '再来一局', COLORS.gold, () => { this.played = false; NET.restart(); }));
    } else {
      d.add(UI.text(this, W / 2, 1120, '等待房主开始下一局…', 26, '#9aa4b5'));
    }
    d.add(UI.button(this, W / 2, 1220, 480, 76, '退出房间', COLORS.red, () => {
      NET.leave(); this.scene.start('Lobby');
    }, 24));
  }
}
