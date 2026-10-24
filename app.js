import * as store from "./storage.js";
import * as st from "./stats.js";

const $ = id => document.getElementById(id);
const eur = n => (n < 0 ? "−" : "") + Math.abs(n).toFixed(2).replace(".", ",") + " €";
const sgn = n => (n > 0 ? "+" : "") + eur(n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

let bets = store.load();

/* ---------- navegação ---------- */
function showTab(tab) {
  document.querySelectorAll(".tab").forEach(s => s.classList.toggle("on", s.id === "t-" + tab));
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  window.scrollTo(0, 0);
}
$("nav").addEventListener("click", e => {
  if (e.target.dataset.tab) showTab(e.target.dataset.tab);
});

/* ---------- resumo ---------- */
function renderSummary() {
  const s = st.summary(bets);
  const P = $("profit");
  P.textContent = sgn(s.profit);
  P.className = "big " + (s.profit > 0 ? "pos" : s.profit < 0 ? "neg" : "");
  $("staked").textContent = eur(s.staked);
  $("count").textContent = s.count;

  $("periods").innerHTML =
    `Hoje <b>${eur(st.stakedSince(bets, st.startOfDay()))}</b> · ` +
    `Semana <b>${eur(st.stakedSince(bets, st.startOfWeek()))}</b> · ` +
    `Mês <b>${eur(st.stakedSince(bets, st.startOfMonth()))}</b>`;

  $("rates").textContent = s.hitRate === null ? "" :
    `Acerto ${Math.round(s.hitRate * 100)}% · precisas de ${Math.round(s.breakEvenRate * 100)}% para ficar em zero` +
    (s.inPlay > 0 ? ` · em jogo ${eur(s.inPlay)}` : "");
}

function renderBreakdown() {
  const months = st.breakdown(bets);
  $("breakdown").innerHTML = months.length ? months.map((m, i) => `
    <details ${i === 0 ? "open" : ""}>
      <summary>${st.monthLabel(m.month)} · apostado <b>${eur(m.staked)}</b> · ${m.count} apostas ·
        <span class="${m.profit > 0 ? "pos" : m.profit < 0 ? "neg" : ""}">${sgn(m.profit)}</span></summary>
      ${m.days.map(d => `<div class="day"><span>${d.day.slice(8)}/${d.day.slice(5, 7)} · ${d.count} apostas</span>
        <span>${eur(d.staked)} · <span class="${d.profit > 0 ? "pos" : d.profit < 0 ? "neg" : ""}">${sgn(d.profit)}</span></span></div>`).join("")}
    </details>`).join("") : '<p class="sub">Ainda sem apostas.</p>';
}

/* ---------- lista de apostas ---------- */
function renderList() {
  const labels = { open: "Aberta", won: "Ganha", lost: "Perdida", void: "Anulada" };
  const sorted = [...bets].sort((a, b) => (a.date < b.date ? 1 : -1));
  $("list").innerHTML = sorted.length ? sorted.map(b => {
    const r = st.profitOf(b);
    return `<div class="card bet" data-id="${b.id}">
      <div class="top"><span>${esc(b.desc)}</span>
        <span class="${r > 0 ? "pos" : r < 0 ? "neg" : ""}">${b.status === "open" ? "" : sgn(r)}</span></div>
      <div class="meta">${esc(b.market)}${b.book ? " · " + esc(b.book) : ""} · ${eur(b.stake)} @ ${b.odd.toFixed(2).replace(".", ",")} · ${new Date(b.date).toLocaleDateString("pt-PT")}</div>
      <div class="acts"><span class="tag">${labels[b.status]}</span>
        ${b.status === "open"
          ? '<button data-a="won">Ganha</button><button data-a="lost">Perdida</button><button data-a="void">Anulada</button>'
          : '<button data-a="open">Reabrir</button>'}
        <button data-a="del">Apagar</button></div></div>`;
  }).join("") : '<p class="sub">Ainda sem apostas. Regista a primeira no separador Nova.</p>';
}

$("list").addEventListener("click", e => {
  const action = e.target.dataset.a, card = e.target.closest(".bet");
  if (!action || !card) return;
  const id = card.dataset.id;
  if (action === "del") {
    if (confirm("Apagar esta aposta?")) bets = store.removeBet(bets, id);
  } else {
    bets = store.updateBet(bets, id, { status: action });
  }
  render();
});

/* ---------- nova aposta ---------- */
function preview() {
  const s = parseFloat($("stake").value), o = parseFloat($("odd").value), pb = parseFloat($("prob").value);
  const el = $("prev");
  if (!(s > 0) || !(o > 1)) {
    el.className = "prev";
    el.textContent = "Preenche o stake e a odd para ver a análise.";
    return;
  }
  let text = `Se ganhares, o lucro é ${eur(s * (o - 1))}. Com esta odd, tens de acertar ${Math.round(100 / o)}% das apostas para ficares em zero.`;
  let cls = "mid", tag = "";
  if (pb > 0) {
    const ev = pb / 100 * o - 1;
    cls = ev >= 0.05 ? "pos" : ev <= -0.05 ? "neg" : "mid";
    tag = ev >= 0.05 ? "Positiva" : ev <= -0.05 ? "A perder" : "Normal";
    text += ` Com a tua probabilidade, o retorno esperado é ${(ev > 0 ? "+" : "") + (ev * 100).toFixed(0)}% (${sgn(s * ev)}).`;
  } else {
    const closed = bets.filter(b => b.status === "won" || b.status === "lost");
    if (closed.length >= 10) {
      const hit = closed.filter(b => b.status === "won").length / closed.length, d = hit - 1 / o;
      cls = d > 0.05 ? "pos" : d < -0.05 ? "neg" : "mid";
      tag = d > 0.05 ? "Positiva" : d < -0.05 ? "A perder" : "Normal";
      text += ` O teu histórico tem ${Math.round(hit * 100)}% de acerto.`;
    } else {
      text += " Ainda tens poucas apostas fechadas para uma avaliação (precisas de 10).";
    }
  }
  el.className = "prev " + cls;
  el.innerHTML = (tag ? `<b>${tag}.</b> ` : "") + text;
}
["stake", "odd", "prob"].forEach(id => $(id).addEventListener("input", preview));

$("add").addEventListener("click", () => {
  const stake = parseFloat($("stake").value), odd = parseFloat($("odd").value), desc = $("desc").value.trim();
  if (!desc || !(stake > 0) || !(odd > 1)) {
    alert("Preenche a descrição, um stake maior que 0 e uma odd maior que 1.");
    return;
  }
  const prob = parseFloat($("prob").value);
  bets = store.addBet(bets, {
    date: new Date($("date").value + "T12:00:00").toISOString(),
    desc, stake, odd,
    market: $("market").value,
    book: $("book").value.trim(),
    ...(prob > 0 ? { prob } : {}),
  });
  ["desc", "stake", "odd", "prob"].forEach(id => ($(id).value = ""));
  preview();
  render();
  showTab("apostas");
});

function renderChart() {
  const series = st.cumulativeSeries(bets);
  const el = $("chart");
  if (series.length < 2) {
    el.textContent = "O gráfico aparece quando tiveres 2 apostas fechadas.";
    return;
  }
  const pts = [0, ...series.map(p => p.value)];  // começa sempre no zero
  const W = 320, H = 150, padX = 10, padY = 14;
  const min = Math.min(...pts, 0), max = Math.max(...pts, 0), range = (max - min) || 1;
  const x = i => padX + i * (W - 2 * padX) / (pts.length - 1);
  const y = v => H - padY - (v - min) / range * (H - 2 * padY);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  const color = last >= 0 ? "var(--win)" : "var(--loss)";
  const zero = y(0).toFixed(1);
  const endX = x(pts.length - 1).toFixed(1);

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lucro acumulado ao longo das apostas fechadas">
      <line x1="${padX}" x2="${W - padX}" y1="${zero}" y2="${zero}" style="stroke:var(--line)" stroke-dasharray="3 3"/>
      <path d="${line}L${endX} ${zero}L${x(0)} ${zero}Z" style="fill:${color}" opacity=".13"/>
      <path d="${line}" fill="none" style="stroke:${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${endX}" cy="${y(last).toFixed(1)}" r="4" style="fill:${color}"/>
    </svg>
    <p class="sub">Melhor ponto ${sgn(max)} · Pior ponto ${sgn(min)} · Maior queda ${eur(st.maxDrawdown(series))}</p>`;
}

/* ---------- cópia de segurança ---------- */
$("exp").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([store.exportJSON(bets)], { type: "application/json" }));
  a.download = `caderneta-${todayStr()}.json`;
  a.click();
});

$("imp").addEventListener("click", () => $("file").click());

$("file").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (!Array.isArray(JSON.parse(reader.result))) throw new Error();
      if (confirm("Isto substitui as apostas atuais. Continuar?")) {
        bets = store.importJSON(reader.result);
        render();
      }
    } catch {
      alert("Ficheiro inválido.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------- arranque ---------- */
function render() {
  renderSummary();
  renderChart();
  renderBreakdown();
  renderList();
}
$("date").value = todayStr();
render();