// public/assets/js/pages/vencimentos.js
(function () {
  const tabs = document.getElementById("vencTabs");

  const secAtrasados = document.getElementById("secAtrasados");
  const countAtrasadosEl = document.getElementById("countAtrasados");
  const listAtrasadosEl = document.getElementById("vencListAtrasados");

  const tituloPeriodoEl = document.getElementById("tituloPeriodo");
  const listEl = document.getElementById("vencList");

  if (!tabs || !listEl) return;

  const buttons = Array.from(tabs.querySelectorAll(".tab"));
  const API = "/KRAx/public/api.php";

  let currentPeriod = "hoje";
  window.refreshVencimentos = () => load(currentPeriod);

  function money(v) {
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v ?? "");
    return s.includes("R$") ? s : s ? `R$ ${s}` : "—";
  }

  function moneyInput(v) {
    const num = Number(v);
    if (!Number.isFinite(num)) return "";
    return num.toFixed(2).replace(".", ",");
  }

  function formatDateBR(yyyyMMdd) {
    const s = String(yyyyMMdd || "");
    if (!s) return "—";
    const only = s.slice(0, 10);
    const [y, m, d] = only.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function badgeHtml(status) {
    const st = String(status || "").toUpperCase();
    if (st === "ATRASADO") return `<span class="badge badge--danger">Atrasado</span>`;
    if (st === "HOJE") return `<span class="badge badge--info">Hoje</span>`;
    if (st === "AMANHA") return `<span class="badge">Amanhã</span>`;
    return `<span class="badge">Pendente</span>`;
  }

  function getPeriodoLabel(period) {
    return period === "amanha" ? "Amanhã" : period === "semana" ? "Semana" : "Hoje";
  }

  function setTituloPeriodo(label, qtd) {
    if (!tituloPeriodoEl) return;
    const nome = label || "Hoje";
    tituloPeriodoEl.textContent = `${nome} (${qtd || 0})`;
  }

  function setAtrasados(qtd) {
    if (countAtrasadosEl) countAtrasadosEl.textContent = `Atrasados (${qtd || 0})`;
    if (secAtrasados) secAtrasados.style.display = qtd > 0 ? "" : "none";
  }

  function renderList(targetEl, rows, { emptyMode = "show" } = {}) {
    if (!targetEl) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      // emptyMode "hide": deixa limpo (pra seção escondida)
      targetEl.innerHTML =
        emptyMode === "hide"
          ? ``
          : `<div class="muted" style="padding:12px;">Nenhum vencimento.</div>`;
      return;
    }

    targetEl.innerHTML = rows
      .map((row) => {
        const clienteNome = esc(row.cliente_nome || "—");
        const parcelaNum = row.parcela_num ?? "—";

        const vencISO = row.data_vencimento || "";
        const venc = formatDateBR(vencISO);

        const valorNum = Number(row.valor ?? 0);
        const valorTxt = money(valorNum);

        const emprestimoId = row.emprestimo_id ?? "";
        const parcelaId = row.parcela_id ?? "";

        const status = String(row.status || "").toUpperCase();
        const isAtrasado = status === "ATRASADO";

        const emprestimoInfo = `Prestação ${parcelaNum} • ${valorTxt} • Venc: ${venc}`;

        return `
          <article class="list-item venc-item" data-status="${isAtrasado ? "atrasado" : "pendente"}">
            <div class="venc-left">
              <div class="venc-title">
                ${isAtrasado ? `<span class="warn-dot">!</span>` : ``}
                <strong>${clienteNome}</strong>
                ${badgeHtml(status)}
              </div>

              <div class="venc-meta">
                <span>Prestação ${esc(parcelaNum)}</span>
                <span>${esc(valorTxt)}</span>
                <span>Vencimento: ${esc(venc)}</span>
              </div>
            </div>

            <div class="venc-right">
              <button
                class="btn btn--primary btn--compact"
                type="button"
                data-modal-open="lancarPagamento"
                data-cliente-nome="${clienteNome}"
                data-emprestimo-id="${esc(emprestimoId)}"
                data-parcela-id="${esc(parcelaId)}"
                data-emprestimo-info="${esc(emprestimoInfo)}"
                data-valor-padrao="${esc(moneyInput(valorNum))}"
                data-tipo-padrao="PARCELA"
              >
                Lançar pagamento
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function fetchVencimentos(period) {
    const map = {
      hoje: "vencimentos/hoje",
      amanha: "vencimentos/amanha",
      semana: "vencimentos/semana",
    };

    const route = map[period] || map.hoje;

    const res = await fetch(`${API}?route=${route}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.mensagem || "Erro ao buscar vencimentos");

    // esperado: { atrasados: [], lista: [], periodo_label: "" }
    return json.dados || { atrasados: [], lista: [], periodo_label: "" };
  }

  async function load(period) {
    const fallbackLabel = getPeriodoLabel(period);

    // loading nas duas listas
    if (listAtrasadosEl) listAtrasadosEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;
    listEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;

    setAtrasados(0);
    setTituloPeriodo(fallbackLabel, 0);

    try {
      const dados = await fetchVencimentos(period);

      const atrasados = Array.isArray(dados.atrasados) ? dados.atrasados : [];
      const lista = Array.isArray(dados.lista) ? dados.lista : [];
      const label = String(dados.periodo_label || "").trim() || fallbackLabel;

      // atrasados
      setAtrasados(atrasados.length);
      if (listAtrasadosEl) {
        renderList(listAtrasadosEl, atrasados, {
          emptyMode: "hide", // quando não tiver, deixa limpo (e a seção some)
        });
      }

      // período
      setTituloPeriodo(label, lista.length);
      renderList(listEl, lista);
    } catch (e) {
      console.error(e);

      setAtrasados(0);
      if (listAtrasadosEl) listAtrasadosEl.innerHTML = "";
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Erro: ${esc(e.message)}</div>`;
      setTituloPeriodo(fallbackLabel, 0);
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      currentPeriod = btn.getAttribute("data-filter") || "hoje"; // ✅ agora atualiza de verdade
      load(currentPeriod);
    });
  });

  // inicial
  load(currentPeriod);
})();
