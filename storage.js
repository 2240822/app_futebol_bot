const KEY = "caderneta-v1";

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function save(bets) {
  try { localStorage.setItem(KEY, JSON.stringify(bets)); return true; }
  catch { return false; }
}

export function addBet(bets, data) {
  const bet = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    status: "open",
    ...data,
  };
  const next = [...bets, bet];
  save(next);
  return next;
}

export function updateBet(bets, id, changes) {
  const next = bets.map(b => (b.id === id ? { ...b, ...changes } : b));
  save(next);
  return next;
}

export function removeBet(bets, id) {
  const next = bets.filter(b => b.id !== id);
  save(next);
  return next;
}

export const exportJSON = bets => JSON.stringify(bets);

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Ficheiro inválido");
  save(data);
  return data;
}