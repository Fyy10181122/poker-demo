/**
 * test/sim.js —— 2 客户端联机自动化测试
 * 用 socket.io-client 模拟两名玩家，分别完整跑一局炸金花和一局德州扑克
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

function myTurn(c) { return c.state && c.state.turnId === c.socket.id; }

async function playRound(mode) {
  console.log(`\n===== 测试 ${mode === 'zjh' ? '炸金花' : '德州扑克'} =====`);
  const A = makeClient('张三'), B = makeClient('李四');
  await sleep(300);

  // 创建 + 加入
  const roomId = await new Promise(res =>
    A.socket.emit('createRoom', { name: A.name, mode }, r => res(r.roomId)));
  console.log('房间创建:', roomId);
  await new Promise((res, rej) =>
    B.socket.emit('joinRoom', { roomId, name: B.name }, r => r.error ? rej(new Error(r.error)) : res()));
  console.log('李四加入成功');

  // 开始
  A.socket.emit('startGame');
  await waitFor(A, s => s.state === 'playing', '开局');
  console.log('对局开始, 底池 =', A.state.pot);

  // 自动打完一局
  let steps = 0;
  while (steps < 60) {
    const cur = [A, B].find(myTurn);
    if (!cur) {
      if (A.state.state === 'ended') break;
      await sleep(80); steps++; continue;
    }
    if (mode === 'zjh') {
      // 各跟一轮后开牌
      if (cur.state.canOpen) cur.socket.emit('action', { type: 'open' });
      else cur.socket.emit('action', { type: 'call' });
    } else {
      const me = cur.state.players.find(p => p.id === cur.socket.id);
      const diff = cur.state.currentBet - me.betThisRound;
      cur.socket.emit('action', { type: diff > 0 ? 'call' : 'check' });
    }
    await sleep(120);
    steps++;
  }

  const end = await waitFor(A, s => s.state === 'ended', '结算');
  console.log('✅ 结算完成:', JSON.stringify(end.result.winnerNames), '赢得', end.result.pot);
  if (end.result.hands) {
    Object.values(end.result.hands).forEach(h =>
      console.log('   牌型:', h.name, h.cards.map(c => `${'♠♥♣♦'[c.s]}${c.r}`).join(' ')));
  }
  console.log('   筹码:', end.players.map(p => `${p.name}=${p.chips}`).join(', '));

  // 再来一局（验证 restart）
  A.socket.emit('restart');
  await waitFor(A, s => s.state === 'playing', '重开');
  console.log('✅ 再来一局正常');

  A.socket.disconnect(); B.socket.disconnect();
}

(async () => {
  try {
    await playRound('zjh');
    await playRound('texas');
    console.log('\n🎉 全部测试通过：2人联机、炸金花、德州扑克核心流程均跑通');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ 测试失败:', e.message);
    process.exit(1);
  }
})();
