const sum = arr => arr.reduce((a, b) => a + b, 0);
const isClosed = b => b.status === "won" || b.status === "lost";
const isPlaced = b => b.status !== "void";

export const profitOf = b =>
  b.status === "won" ? b.stake * (b.odd - 1) : b.status === "lost" ? -b.stake : 0;

export function summary(bets) {
  const placed = bets.filter(isPlaced);
  const closed = bets.filter(isClosed);
  const won = closed.filter(b => b.status === "won").length;
  const staked = sum(placed.map(b => b.stake));
  const stakedClosed = sum(closed.map(b => b.stake));
  const profit = sum(closed.map(profitOf));
  const withProb = closed.filter(b => b.prob > 0);
  return {
    count: placed.length,
    staked,
    inPlay: sum(bets.filter(b => b.status === "open").map(b => b.stake)),
    profit,
    roi: stakedClosed ? profit / stakedClosed : null,
    hitRate: closed.length ? won / closed.length : null,
    breakEvenRate: closed.length ? sum(closed.map(b => 1 / b.odd)) / closed.length : null,
    avgOdd: placed.length ? sum(placed.map(b => b.odd)) / placed.length : null,
    avgStake: placed.length ? staked / placed.length : null,
    expectedProfit: withProb.length
      ? sum(withProb.map(b => b.stake * (b.prob / 100 * b.odd - 1))) : null,
    expectedSample: withProb.length,
  };
}

export function stakedSince(bets, from) {
  return sum(bets.filter(b => isPlaced(b) && new Date(b.date) >= from).map(b => b.stake));
}
export const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const startOfWeek = () => { const d = startOfDay(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
export const startOfMonth = () => { const d = startOfDay(); d.setDate(1); return d; };

export function cumulativeSeries(bets) {
  let acc = 0;
  return bets.filter(isClosed)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(b => ({ date: b.date, value: (acc += profitOf(b)) }));
}

export function groupBy(bets, keyFn) {
  const groups = {};
  for (const b of bets) (groups[keyFn(b) || "Sem indicação"] ??= []).push(b);
  return Object.entries(groups)
    .map(([key, list]) => ({ key, ...summary(list) }))
    .sort((a, b) => b.profit - a.profit);
}
export const oddBucket = b =>
  b.odd < 1.5 ? "Até 1,50" : b.odd < 2 ? "1,50 a 2,00" : b.odd < 3 ? "2,00 a 3,00"
  : b.odd < 5 ? "3,00 a 5,00" : "Acima de 5,00";

export function weeklyStaked(bets) {
  const weeks = {};
  for (const b of bets.filter(isPlaced)) {
    const d = new Date(b.date); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    weeks[k] = (weeks[k] || 0) + b.stake;
  }
  return Object.entries(weeks).sort().map(([week, staked]) => ({ week, staked }));
}

export function streaks(bets) {
  const rs = bets.filter(isClosed).sort((a, b) => (a.date < b.date ? -1 : 1));
  let cur = 0, bestW = 0, bestL = 0;
  for (const b of rs) {
    const w = b.status === "won";
    cur = w ? (cur > 0 ? cur + 1 : 1) : (cur < 0 ? cur - 1 : -1);
    bestW = Math.max(bestW, cur); bestL = Math.max(bestL, -cur);
  }
  return { current: cur, bestWin: bestW, bestLoss: bestL };
}

export function maxDrawdown(series) {
  let peak = 0, dd = 0;
  for (const p of series) { peak = Math.max(peak, p.value); dd = Math.max(dd, peak - p.value); }
  return dd;
}

export function breakdown(bets) {
  const pad = n => String(n).padStart(2, "0");
  const months = {};
  for (const b of bets.filter(isPlaced)) {
    const d = new Date(b.date);
    const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const day = `${month}-${pad(d.getDate())}`;
    const m = (months[month] ??= { month, staked: 0, count: 0, profit: 0, days: {} });
    const dd = (m.days[day] ??= { day, staked: 0, count: 0, profit: 0 });
    for (const t of [m, dd]) { t.staked += b.stake; t.count++; t.profit += profitOf(b); }
  }
  return Object.values(months)
    .map(m => ({ ...m, days: Object.values(m.days).sort((a, b) => (a.day < b.day ? 1 : -1)) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}