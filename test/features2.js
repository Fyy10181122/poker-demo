/**
 * test/features2.js —— 新功能自动化测试
 * 1) 逐张看牌(look n)：seenCount 按 n 累加并封顶 cardCount
 * 2) 加注档位(raise amount)：currentBet 按档位增加
 * 3) 德州 All-in 锁定：本人锁定、他人只能跟注/弃牌，全员决定后进入摊牌看牌(showdown-look)，最先 All-in 者看1/2次后结算
 * 运行前先启动服务器: node server.js
 */
const { io } = require('socket.io-client');
const URL = process.env.GAME_URL || 'http://localhost:3000';

function makeClient(name) {
  const c = { name, socket: io(URL), state: null };
  c.socket.on('state', s => { c.state = s; });
  return c;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function me(c) { return c.state.players.find(p => p.id === c.socket.id); }

async function waitFor(client, pred, desc, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (client.state && pred(client.state)) return client.state;
    await sleep(40);
  }
  throw new Error(`超时: ${desc}。最后: ${JSON.stringify(client.state && client.state.state)}`);
}
function myTurn(c) { return c.state && c.state.turnId === c.socket.id; }

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.log('  ❌', msg); }
}

async function setup(mode) {
  const A = makeClient('张三'), B = makeClient('李四');
  await sleep(300);
  const roomId = await new Promise(res =>
    A.socket.emit('createRoom', { name: A.name, mode }, r => res(r.roomId)));
  await new Promise((res, rej) =>
    B.socket.emit('joinRoom', { roomId, name: B.name }, r => r.error ? rej(new Error(r.error)) : res()));
  A.socket.emit('startGame');
  await waitFor(A, s => s.state === 'playing', '开局');
  return { A, B };
}

async function autoFinishTexas(A, B, maxSteps = 80) {
  let steps = 0;
  while (steps < maxSteps) {
    const cur = [A, B].find(myTurn);
    if (!cur) {
      if (A.state.state === 'ended' || A.state.state === 'showdown-look') break;
      await sleep(60); steps++; continue;
    }
    const m = me(cur);
    const diff = cur.state.currentBet - m.betThisRound;
    cur.socket.emit('action', { type: diff > 0 ? 'call' : 'check' });
    await sleep(90); steps++;
  }
}

(async () => {
  try {
    /* ---------- 德州：看牌 + 加注档位 ---------- */
    console.log('\n===== 德州：逐张看牌 + 加注档位 =====');
    const { A, B } = await setup('texas');
    await waitFor(A, s => s.turnId === A.socket.id, 'A 先手');
    // A 看1张
    A.socket.emit('action', { type: 'look', n: 1 });
    await waitFor(A, s => (s.players.find(p => p.id === A.socket.id).seenCount === 1), 'A 看1张');
    assert(me(A).seenCount === 1, 'A 看1张后 seenCount=1');
    // A 再看2张（德州共2张，封顶2）
    A.socket.emit('action', { type: 'look', n: 2 });
    await waitFor(A, s => (s.players.find(p => p.id === A.socket.id).seenCount === 2), 'A 看2张封顶');
    assert(me(A).seenCount === 2, 'A 再2张后 seenCount 封顶=2（德州2张）');

    // A 加注档位 100（翻牌前 currentBet 初始 0）
    const before = A.state.currentBet;
    A.socket.emit('action', { type: 'raise', amount: 100 });
    await waitFor(A, s => s.currentBet === before + 100, 'A 加注+100');
    assert(A.state.currentBet === before + 100, `加注档位生效 currentBet ${before}→${A.state.currentBet}`);

    await autoFinishTexas(A, B);
    const end1 = await waitFor(A, s => s.state === 'ended', '德州正常结算');
    assert(end1.state === 'ended', '无 All-in 时德州正常打到结算');
    console.log('  结算:', end1.result.winnerNames, '赢得', end1.result.pot);

    /* ---------- 德州：All-in 锁定 + 摊牌看牌 ---------- */
    console.log('\n===== 德州：All-in 锁定 + 摊牌看牌 =====');
    A.socket.emit('restart');
    await waitFor(A, s => s.state === 'playing', '重开');
    // 等到 A 行动（若 B 先手则 B 让牌让出）
    let guard = 0;
    while (guard++ < 12) {
      const cur = [A, B].find(myTurn);
      if (!cur) { await sleep(60); continue; }
      if (cur === A) break;
      const m = me(B);
      const diff = B.state.currentBet - m.betThisRound;
      B.socket.emit('action', { type: diff > 0 ? 'call' : 'check' });
      await sleep(100);
    }
    // A 选择 All-in（封顶1000）
    const chipsBeforeAllIn = me(A).chips;
    A.socket.emit('action', { type: 'allin' });
    await waitFor(A, s => s.firstAllInId === A.socket.id, '记录最先 All-in');
    assert(A.state.firstAllInId === A.socket.id, 'firstAllInId = A');
    assert(me(A).allIn === true, 'A 标记为 allIn（本人锁定）');
    assert(me(A).chips === chipsBeforeAllIn - 1000, `A 筹码扣除 1000 封顶（${chipsBeforeAllIn}→${me(A).chips}）`);
    // B 视角：allInLocked = true
    await waitFor(B, s => s.allInLocked === true, 'B 看到锁定');
    assert(B.state.allInLocked === true, 'allInLocked=true（他人只能跟注/弃牌）');
    const curBet = B.state.currentBet;
    // B 试图加注（应被忽略）
    B.socket.emit('action', { type: 'raise', amount: 200 });
    await sleep(150);
    assert(B.state.currentBet === curBet, '锁定后 B 加注被忽略（currentBet 不变）');
    // B 跟注
    B.socket.emit('action', { type: 'call' });
    // 进入摊牌看牌阶段
    const sd = await waitFor(A, s => s.state === 'showdown-look', '进入摊牌看牌');
    assert(sd.state === 'showdown-look', '全员决定后进入 showdown-look');
    assert(sd.awaitingLookId === A.socket.id, 'awaitingLookId = 最先 All-in 的 A');
    assert(sd.community.length === 5, '公共牌已补满至 5 张');
    // A 选择看2次
    A.socket.emit('action', { type: 'look', n: 2 });
    const end2 = await waitFor(A, s => s.state === 'ended', '看牌后结算');
    assert(end2.state === 'ended', 'A 看牌后正常结算');
    assert(me(A).seenCount === 2, 'A 摊牌前看满 2 张');
    console.log('  结算:', end2.result.winnerNames, '赢得', end2.result.pot);

    A.socket.disconnect(); B.socket.disconnect();

    /* ---------- 炸金花：逐张看牌 + 加注档位 ---------- */
    console.log('\n===== 炸金花：逐张看牌 + 加注档位 =====');
    const { A: C, B: D } = await setup('zjh');
    await waitFor(C, s => s.turnId === C.socket.id, 'C 先手');
    C.socket.emit('action', { type: 'look', n: 1 });
    await waitFor(C, s => (s.players.find(p => p.id === C.socket.id).seenCount === 1), 'C 看1张');
    assert(me(C).seenCount === 1, '炸金花看1张 seenCount=1');
    C.socket.emit('action', { type: 'look', n: 2 });
    await waitFor(C, s => (s.players.find(p => p.id === C.socket.id).seenCount === 3), 'C 看2张封顶3');
    assert(me(C).seenCount === 3, '炸金花再2张后封顶=3（共3张）');
    // 加注档位：炸金花 currentBet 初始=10，加注 50 → 60
    const zBefore = C.state.currentBet;
    C.socket.emit('action', { type: 'raise', amount: 50 });
    await waitFor(C, s => s.currentBet === zBefore + 50, 'C 加注+50');
    assert(C.state.currentBet === zBefore + 50, `炸金花加注档位生效 ${zBefore}→${C.state.currentBet}`);
    C.socket.disconnect(); D.socket.disconnect();

    console.log(`\n🎉 测试完成：通过 ${pass}，失败 ${fail}`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('\n❌ 测试异常:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
