/**
 * server.js —— Node.js + Express + Socket.io 后端
 * 房间制多人牌局：炸金花(zjh) / 德州扑克(texas)，最多 8 人
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const G = require('./game-logic');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const START_CHIPS = 10000;   // 初始筹码
const ANTE = 10;         // 底注
const ZJH_RAISE = 10;    // 炸金花每次加注额
const TEXAS_BET = 20;    // 德州每次下注/加注额
const ALLIN_CAP = 1000;  // 德州 All-in 封顶
const BANK_BORROW = 1000; // 每次向银行借款额
const BANK_LIMIT = 10000;  // 单人累计借款上限
const RAISE_LEVELS = [50, 100, 200, 500]; // 加注档位

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // roomId -> room

/* ---------------- 工具 ---------------- */
function genRoomId() {
  let id;
  do { id = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[id]);
  return id;
}
function activePlayers(room) { return room.players.filter(p => !p.folded); }
function getPlayer(room, id) { return room.players.find(p => p.id === id); }

function nextTurn(room) {
  const n = room.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (room.turn + k) % n;
    if (!room.players[j].folded && room.players[j].chips > 0 && !room.players[j].allIn) { room.turn = j; return; }
  }
}

/** 德州：有人 All-in（封顶1000，本人本局锁定）后，其余玩家只能跟注/弃牌，本人不能再加注 */
function allInLocked(room) {
  return room.mode === 'texas' && room.firstAllInId != null;
}

/** 给每个客户端发送脱敏后的房间状态（只看得到自己的手牌） */
function broadcast(room) {
  room.players.forEach(viewer => {
    const state = sanitize(room, viewer.id);
    io.to(viewer.id).emit('state', state);
  });
}

function sanitize(room, viewerId) {
  const showAll = room.state === 'ended' && room.result; // 结算时亮牌
  return {
    roomId: room.id,
    mode: room.mode,
    state: room.state,
    hostId: room.hostId,
    pot: room.pot,
    currentBet: room.currentBet,
    stage: room.stage,
    community: room.mode === 'texas' ? room.community : [],
    turnId: room.state === 'playing' ? room.players[room.turn].id : null,
    canOpen: room.mode === 'zjh' && room.turnCount >= activePlayers(room).length,
    firstAllInId: room.firstAllInId || null,
    awaitingLookId: room.awaitingLookId || null,
    allInLocked: allInLocked(room),
    result: room.result || null,
    log: room.log.slice(-6),
    players: room.players.map(p => {
      const revealed = showAll && !p.folded;
      const isSelf = p.id === viewerId;
      // 炸金花：自己看牌后才可见；德州：自己���底牌始终可见
      const canSee = revealed || isSelf;
      return {
        id: p.id, name: p.name, chips: p.chips, loan: p.loan,
        folded: p.folded, looked: p.looked, seenCount: p.seenCount, allIn: !!p.allIn,
        betThisRound: p.betThisRound,
        cardCount: p.cards.length,
        cards: canSee ? p.cards : []
      };
    })
  };
}

function log(room, msg) {
  room.log.push(msg);
  if (room.log.length > 30) room.log.shift();
}

/* ---------------- 牌局流程 ---------------- */
function startHand(room) {
  room.deck = G.newDeck();
  room.pot = 0;
  room.community = [];
  room.stage = 0;        // 德州: 0翻牌前 1翻牌 2转牌 3河牌
  room.turnCount = 0;    // 已行动次数（炸金花开牌解锁用）
  room.result = null;
  room.state = 'playing';
  room.firstAllInId = null;
  room.awaitingLookId = null;
  if (room._lookTimer) { clearTimeout(room._lookTimer); room._lookTimer = null; }
  room.players.forEach(p => {
    p.cards = [];
    p.folded = false;
    p.looked = false;
    p.seenCount = 0;
    p.allIn = false;
    p.betThisRound = 0;
    p.acted = false;
    // 底注（没钱则贡献0，可后续向银行借款继续）
    const need = Math.min(ANTE, p.chips);
    p.chips -= need;
    room.pot += need;
  });
  const cardNum = room.mode === 'zjh' ? 3 : 2;
  for (let i = 0; i < cardNum; i++) room.players.forEach(p => p.cards.push(room.deck.pop()));
  room.currentBet = room.mode === 'zjh' ? ZJH_RAISE : 0;
  room.turn = room.handCount % room.players.length; // 轮流坐庄先手
  room.handCount++;
  if (room.players[room.turn].folded) nextTurn(room);
  log(room, `—— 第 ${room.handCount} 局开始（底注 ${ANTE}）——`);
}

function pay(room, p, amount) {
  const real = Math.min(amount, p.chips); // 简化处理：不够就全下
  p.chips -= real;
  p.betThisRound += real;
  room.pot += real;
  return real;
}

/* --- 炸金花动作 --- */
function zjhAction(room, p, act) {
  if (act.type === 'look') {
    const n = act.n === 2 ? 2 : 1;
    p.seenCount = Math.min(p.cards.length, p.seenCount + n);
    p.looked = p.seenCount > 0;
    log(room, `${p.name} 看了 ${n} 张牌`);
    return; // 看牌不消耗回合
  }
  if (act.type === 'fold') {
    p.folded = true;
    log(room, `${p.name} 弃牌`);
  } else if (act.type === 'call') {
    pay(room, p, room.currentBet);
    log(room, `${p.name} 跟注 ${room.currentBet}`);
  } else if (act.type === 'raise') {
    const amt = (typeof act.amount === 'number' && act.amount > 0) ? act.amount : ZJH_RAISE;
    room.currentBet += amt;
    pay(room, p, room.currentBet - p.betThisRound);
    room.players.forEach(q => { if (!q.folded) q.acted = false; });
    p.acted = true;
    log(room, `${p.name} 加注到 ${room.currentBet}`);
  } else if (act.type === 'open') {
    // 开牌：需每人都至少行动过一轮
    if (room.turnCount < activePlayers(room).length) return;
    pay(room, p, room.currentBet);
    log(room, `${p.name} 开牌！`);
    return finishZjh(room);
  } else return;

  room.turnCount++;
  const act2 = activePlayers(room);
  if (act2.length === 1) return win(room, [act2[0]], '其余玩家弃牌');
  nextTurn(room);
}

function finishZjh(room) {
  const act = activePlayers(room);
  const hands = {};
  let best = null, winners = [];
  act.forEach(p => {
    const ev = G.zjhEval(p.cards);
    hands[p.id] = { cards: p.cards, name: ev.name };
    if (!best || G.cmpScore(ev.score, best) > 0) { best = ev.score; winners = [p]; }
    else if (G.cmpScore(ev.score, best) === 0) winners.push(p);
  });
  win(room, winners, '比牌', hands);
}

/* --- 德州动作 --- */
function texasAction(room, p, act) {
  if (act.type === 'look') {
    const n = act.n === 2 ? 2 : 1;
    p.seenCount = Math.min(p.cards.length, p.seenCount + n);
    log(room, `${p.name} 看了 ${n} 张牌`);
    return; // 看牌不消耗回合
  }
  const diff = room.currentBet - p.betThisRound;
  if (act.type === 'fold') {
    p.folded = true;
    log(room, `${p.name} 弃牌`);
  } else if (act.type === 'check') {
    if (diff > 0 || allInLocked(room)) return;
    p.acted = true;
    log(room, `${p.name} 让牌`);
  } else if (act.type === 'call') {
    pay(room, p, diff);
    p.acted = true;
    log(room, `${p.name} 跟注 ${diff}`);
  } else if (act.type === 'raise') {
    if (allInLocked(room)) return; // All-in 锁定后禁止加注
    const amt = (typeof act.amount === 'number' && act.amount > 0) ? act.amount : TEXAS_BET;
    room.currentBet += amt;
    pay(room, p, room.currentBet - p.betThisRound);
    room.players.forEach(q => { if (!q.folded) q.acted = false; });
    p.acted = true;
    log(room, `${p.name} 加注到 ${room.currentBet}`);
  } else if (act.type === 'allin') {
    if (p.chips <= 0) return;
    if (room.firstAllInId == null) room.firstAllInId = p.id;
    p.allIn = true; // 本局锁定，不能再加注/跟注
    const amt = Math.min(p.chips, ALLIN_CAP); // 封顶1000
    const diff = room.currentBet - p.betThisRound;
    if (amt >= diff) {
      room.currentBet = Math.max(room.currentBet, amt);
      pay(room, p, amt - p.betThisRound);
      room.players.forEach(q => { if (!q.folded) q.acted = false; });
    } else {
      pay(room, p, amt - p.betThisRound); // 短码：只投入全部筹码
    }
    p.acted = true;
    log(room, `${p.name} All-in ${amt}` + (amt < diff ? '（短码）' : ''));
  } else return;

  const act2 = activePlayers(room);
  if (act2.length === 1) return win(room, [act2[0]], '其余玩家弃牌');

  const roundDone = act2.every(q => (q.acted && q.betThisRound === room.currentBet) || q.chips === 0 || q.allIn);
  if (roundDone) {
    // 有人 All-in 且本轮下注结束 → 补满公共牌，让最先 All-in 的玩家看牌后摊牌
    if (room.firstAllInId != null) {
      while (room.community.length < 5) room.community.push(room.deck.pop());
      return texasShowdownWithLook(room);
    }
    if (room.stage === 3) return finishTexas(room);
    room.stage++;
    const dealN = room.stage === 1 ? 3 : 1;
    for (let i = 0; i < dealN; i++) room.community.push(room.deck.pop());
    room.currentBet = 0;
    room.players.forEach(q => { q.betThisRound = 0; q.acted = false; });
    room.turn = -1; nextTurn(room); // 从第一个未弃牌玩家开始
    const stageName = ['', '翻牌', '转牌', '河牌'][room.stage];
    log(room, `—— ${stageName}圈 ——`);
  } else {
    nextTurn(room);
  }
}

function finishTexas(room) {
  const act = activePlayers(room);
  const hands = {};
  let best = null, winners = [];
  act.forEach(p => {
    const ev = G.texasEval7([...p.cards, ...room.community]);
    hands[p.id] = { cards: p.cards, name: ev.name };
    if (!best || G.cmpScore(ev.score, best) > 0) { best = ev.score; winners = [p]; }
    else if (G.cmpScore(ev.score, best) === 0) winners.push(p);
  });
  win(room, winners, '摊牌', hands);
}

/** 德州 All-in 后：补满公共牌，让最先 All-in 的玩家先看 1/2 次牌，再摊牌 */
function texasShowdownWithLook(room) {
  const fp = room.firstAllInId ? getPlayer(room, room.firstAllInId) : null;
  if (!fp || fp.folded) return finishTexas(room); // 该玩家已弃牌/断开 → 直接摊牌
  room.state = 'showdown-look';
  room.awaitingLookId = fp.id;
  broadcast(room);
  // 20 秒未选择则默认看 2 张
  room._lookTimer = setTimeout(() => {
    if (room.state === 'showdown-look' && rooms[room.id]) {
      fp.seenCount = fp.cards.length;
      room.state = 'playing';
      finishTexas(room);
    }
  }, 20000);
}

function win(room, winners, reason, hands) {
  const share = Math.floor(room.pot / winners.length);
  winners.forEach(w => w.chips += share);
  winners[0].chips += room.pot - share * winners.length; // 余数给第一位
  room.state = 'ended';
  room.result = {
    winnerIds: winners.map(w => w.id),
    winnerNames: winners.map(w => w.name),
    pot: room.pot,
    reason,
    hands: hands || null
  };
  log(room, `${winners.map(w => w.name).join('、')} 赢得底池 ${room.pot}（${reason}）`);
  broadcast(room);
}

/* ---------------- Socket.io ---------------- */
io.on('connection', socket => {
  socket.on('createRoom', ({ name, mode }, cb) => {
    if (mode !== 'zjh' && mode !== 'texas') return cb && cb({ error: '模式错误' });
    const id = genRoomId();
    const room = {
      id, mode, hostId: socket.id, state: 'waiting',
      players: [], deck: [], pot: 0, currentBet: 0,
      turn: 0, stage: 0, community: [], turnCount: 0,
      handCount: 0, result: null, log: []
    };
    room.players.push({ id: socket.id, name: String(name || '玩家').slice(0, 8), chips: START_CHIPS, loan: 0, cards: [], folded: false, looked: false, seenCount: 0, betThisRound: 0, acted: false });
    rooms[id] = room;
    socket.join(id);
    socket.data.roomId = id;
    cb && cb({ roomId: id });
    broadcast(room);
  });

  socket.on('joinRoom', ({ roomId, name }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb && cb({ error: '房间不存在' });
    if (room.state !== 'waiting') return cb && cb({ error: '游戏已开始' });
    if (room.players.length >= MAX_PLAYERS) return cb && cb({ error: '房间已满(8人)' });
    room.players.push({ id: socket.id, name: String(name || '玩家').slice(0, 8), chips: START_CHIPS, loan: 0, cards: [], folded: false, looked: false, seenCount: 0, betThisRound: 0, acted: false });
    socket.join(roomId);
    socket.data.roomId = roomId;
    log(room, `${name} 加入了房间`);
    cb && cb({ roomId });
    broadcast(room);
  });

  socket.on('startGame', () => {
    const room = rooms[socket.data.roomId];
    if (!room || room.hostId !== socket.id) return;
    if (room.state === 'playing') return;
    if (room.players.length < 2) return;
    startHand(room);
    broadcast(room);
  });

  socket.on('action', act => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    // 摊牌前：最先 All-in 的玩家选择看 1/2 次牌
    if (room.state === 'showdown-look') {
      if (act.type === 'look' && socket.id === room.awaitingLookId) {
        const p = getPlayer(room, socket.id);
        if (p) p.seenCount = Math.min(p.cards.length, p.seenCount + (act.n === 2 ? 2 : 1));
        clearTimeout(room._lookTimer);
        room.state = 'playing';
        finishTexas(room);
      }
      return;
    }
    if (room.state !== 'playing') return;
    const p = getPlayer(room, socket.id);
    if (!p || p.folded) return;
    // 看牌可以随时进行，其它动作必须轮到自己
    if (act.type !== 'look' && room.players[room.turn].id !== socket.id) return;
    if (room.mode === 'zjh') zjhAction(room, p, act);
    else texasAction(room, p, act);
    if (room.state === 'playing') broadcast(room);
  });

  socket.on('restart', () => {
    const room = rooms[socket.data.roomId];
    if (!room || room.hostId !== socket.id || room.state !== 'ended') return;
    startHand(room);
    broadcast(room);
  });

  // 向银行借款（每次 +BANK_BORROW，累计不超过 BANK_LIMIT）
  socket.on('borrow', () => {
    const room = rooms[socket.data.roomId];
    if (!room || room.state !== 'playing') return;
    const p = getPlayer(room, socket.id);
    if (!p || p.loan >= BANK_LIMIT) return;
    const amt = Math.min(BANK_BORROW, BANK_LIMIT - p.loan);
    p.chips += amt;
    p.loan += amt;
    log(room, `${p.name} 向银行借款 ${amt}`);
    broadcast(room);
  });

  socket.on('leaveRoom', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));

  function leaveRoom(socket) {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;
    const p = room.players[idx];
    if (room.state === 'playing') {
      p.folded = true;
      const act = activePlayers(room);
      if (act.length === 1) win(room, [act[0]], '对手离开');
      else if (room.players[room.turn].id === p.id) nextTurn(room);
    }
    room.players.splice(idx, 1);
    // 修正 turn 下标
    if (room.turn >= room.players.length) room.turn = 0;
    socket.leave(room.id);
    socket.data.roomId = null;
    if (room.players.length === 0) { delete rooms[room.id]; return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    log(room, `${p.name} 离开了房间`);
    broadcast(room);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`像素牌局 Demo 已启动: http://0.0.0.0:${PORT}`);
});
