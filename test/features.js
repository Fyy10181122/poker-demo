/**
 * test/features.js —— 验证新增功能：银行借款 + 德州 All-in（封顶1000）
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

async function waitFor(client, pred, desc, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (client.state && pred(client.state)) return client.state;
    await sleep(50);
  }
  throw new Error(`超时: 等待 ${desc} 失败。最后状态: ${JSON.stringify(client.state)}`);
}
function meOf(c) { return c.state.players.find(p => p.id === c.socket.id); }

(async () => {
  let pass = 0, fail = 0;
  const assert = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.error('  ❌', msg); } };

  try {
    /* ---------- 场景1：银行借款 ---------- */
    console.log('\n===== 场景1：银行借款 =====');
    const A = makeClient('甲'), B = makeClient('乙');
    await sleep(300);
    const roomId = await new Promise(res => A.socket.emit('createRoom', { name: A.name, mode: 'texas' }, r => res(r.roomId)));
    await new Promise((res, rej) => B.socket.emit('joinRoom', { roomId, name: B.name }, r => r.error ? rej(new Error(r.error)) : res()));
    A.socket.emit('startGame');
    await waitFor(A, s => s.state === 'playing', '开局');

    const before = meOf(A).chips;
    A.socket.emit('borrow');
    await waitFor(A, s => meOf(source(A, s)).loan === 1000, '甲借款1000');
    let m = meOf(A);
    assert(m.loan === 1000, `借款后 loan=1000 (实际 ${m.loan})`);
    assert(m.chips === before + 1000, `借款后筹码 +1000 (${before} -> ${m.chips})`);

    // 多次借款累计（再借一次 = 2000）
    A.socket.emit('borrow');
    await waitFor(A, s => meOf(source(A, s)).loan === 2000, '甲再借1000');
    assert(meOf(A).loan === 2000, `两次借款 loan=2000`);

    // 借款上限保护：连借到上限 10000 后不再增长
    for (let i = 0; i < 12; i++) A.socket.emit('borrow');
    await sleep(600);
    assert(meOf(A).loan === 10000, `借款上限封顶 10000 (实际 ${meOf(A).loan})`);

    A.socket.disconnect(); B.socket.disconnect();

    /* ---------- 场景2：德州 All-in（封顶1000） ---------- */
    console.log('\n===== 场景2：德州 All-in（封顶1000） =====');
    const C = makeClient('丙'), D = makeClient('丁');
    await sleep(300);
    const rid2 = await new Promise(res => C.socket.emit('createRoom', { name: C.name, mode: 'texas' }, r => res(r.roomId)));
    await new Promise((res, rej) => D.socket.emit('joinRoom', { roomId: rid2, name: D.name }, r => r.error ? rej(new Error(r.error)) : res()));
    C.socket.emit('startGame');
    await waitFor(C, s => s.state === 'playing', '开局');

    // 等到丙轮到，直接 All-in
    await waitFor(C, s => s.turnId === C.socket.id, '丙轮到');
    const chipsBefore = meOf(C).chips;
    C.socket.emit('action', { type: 'allin' });
    await waitFor(C, s => meOf(source(C, s)).betThisRound === 1000, '丙 All-in 到 1000');
    const cm = meOf(C);
    assert(cm.betThisRound === 1000, `All-in 后 betThisRound=1000 (实际 ${cm.betThisRound})`);
    assert(C.state.currentBet === 1000, `currentBet 被顶到 1000 (实际 ${C.state.currentBet})`);
    assert(cm.chips === chipsBefore - 1000, `All-in 扣除 1000 筹码 (${chipsBefore} -> ${cm.chips})`);

    // 丁跟注/弃牌，确保能正常结算（不卡死）
    let steps = 0;
    while (steps < 40) {
      const cur = [C, D].find(c => c.state && c.state.turnId === c.socket.id);
      if (!cur) { if (C.state.state === 'ended') break; await sleep(80); steps++; continue; }
      const me = meOf(cur);
      const diff = cur.state.currentBet - me.betThisRound;
      cur.socket.emit('action', { type: diff > 0 ? 'call' : 'check' });
      await sleep(120); steps++;
    }
    const end = await waitFor(C, s => s.state === 'ended', '结算', 10000);
    assert(end.state === 'ended', `All-in 后正常结算: 赢家 ${end.result.winnerNames}`);

    C.socket.disconnect(); D.socket.disconnect();

    console.log(`\n结果: 通过 ${pass} 项, 失败 ${fail} 项`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('\n❌ 测试异常:', e.message);
    process.exit(1);
  }
})();

// 拿 A 自己那份 state（state 里 players 含自己，me() 已在外部定义）
function source(c) { return c; }
