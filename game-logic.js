/**
 * game-logic.js —— 纯牌局逻辑：发牌、炸金花牌型、德州扑克牌型
 * 牌表示: { r: 2~14 (14=A), s: 0~3 (♠♥♣♦) }
 */

function newDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 2; r <= 14; r++) deck.push({ r, s });
  }
  // Fisher-Yates 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 比较分值数组（字典序），a>b 返回 1，a<b 返回 -1，相等返回 0 */
function cmpScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/* ================= 炸金花（3张牌） ================= */
// 牌型: 6豹子 5顺金 4金花 3顺子 2对子 1散牌
function zjhEval(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a); // 降序
  const flush = cards[0].s === cards[1].s && cards[1].s === cards[2].s;
  // 顺子判断（A23 算最小顺，高牌记 3）
  let straight = false, sHigh = 0;
  if (rs[0] - rs[1] === 1 && rs[1] - rs[2] === 1) { straight = true; sHigh = rs[0]; }
  if (rs[0] === 14 && rs[1] === 3 && rs[2] === 2) { straight = true; sHigh = 3; }

  if (rs[0] === rs[1] && rs[1] === rs[2]) return { score: [6, rs[0]], name: '豹子' };
  if (straight && flush) return { score: [5, sHigh], name: '顺金' };
  if (flush) return { score: [4, ...rs], name: '金花' };
  if (straight) return { score: [3, sHigh], name: '顺子' };
  if (rs[0] === rs[1]) return { score: [2, rs[0], rs[2]], name: '对子' };
  if (rs[1] === rs[2]) return { score: [2, rs[1], rs[0]], name: '对子' };
  return { score: [1, ...rs], name: '散牌' };
}

/* ================= 德州扑克（7选5） ================= */
const TEXAS_NAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺', '皇家同花顺'];

// 评估 5 张牌，返回分值数组 [类别, 决胜牌...]
function eval5(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  // 顺子（含 A-5）
  let straight = false, sHigh = 0;
  const uniq = [...new Set(rs)];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) { straight = true; sHigh = uniq[0]; }
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; sHigh = 5; }
  }
  // 统计相同点数
  const cnt = {};
  rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.entries(cnt)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  if (straight && flush) return sHigh === 14 ? [9] : [8, sHigh];
  if (groups[0].c === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].c === 3 && groups[1].c === 2) return [6, groups[0].r, groups[1].r];
  if (flush) return [5, ...rs];
  if (straight) return [4, sHigh];
  if (groups[0].c === 3) return [3, groups[0].r, groups[1].r, groups[2].r];
  if (groups[0].c === 2 && groups[1].c === 2) return [2, groups[0].r, groups[1].r, groups[2].r];
  if (groups[0].c === 2) return [1, groups[0].r, groups[1].r, groups[2].r, groups[3].r];
  return [0, ...rs];
}

// 7 张牌里选最佳 5 张
function texasEval7(cards7) {
  let best = null;
  const n = cards7.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const s = eval5([cards7[a], cards7[b], cards7[c], cards7[d], cards7[e]]);
            if (!best || cmpScore(s, best) > 0) best = s;
          }
  return { score: best, name: TEXAS_NAMES[best[0]] };
}

module.exports = { newDeck, cmpScore, zjhEval, texasEval7 };
