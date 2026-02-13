// public/assets/js/pages/vencimentos.js
(function () {
  const tabs = document.getElementById("vencTabs");

  const secAtrasados = document.getElementById("secAtrasados");
  const countAtrasadosEl = document.getElementById("countAtrasados");
  const listAtrasadosEl = document.getElementById("vencListAtrasados");

  const tituloPeriodoEl = document.getElementById("tituloPeriodo");
  const listEl = document.getElementById("vencList");

  const searchInput = document.getElementById("vencSearch"); // ✅ searchbar

  if (!tabs || !listEl) return;

  const buttons = Array.from(tabs.querySelectorAll(".tab"));
  const API = "/KRAx/public/api.php";

  let currentPeriod = "hoje";
  window.refreshVencimentos = () => load(currentPeriod);

  // ======== state ========
  let cache = {
    period: "hoje",
    periodo_label: "Hoje",
    atrasados: [],
    lista: [],
  };

  // ✅ tudo começa FECHADO (atrasados e período)
  const expanded = {
    atrasados: new Set(),
    periodo: new Set(),
  };

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

  // ======== search helpers ========
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function rowSearchText(row) {
    const nome = row.cliente_nome || row.nome || "";
    const cpf = row.cliente_cpf || row.cpf || row.documento || "";
    const tel = row.cliente_telefone || row.telefone || row.fone || "";
    return norm([nome, cpf, tel].filter(Boolean).join(" "));
  }

  function applyFilter(rows, q) {
    const query = norm(q);
    if (!query) return rows;
    return (Array.isArray(rows) ? rows : []).filter((r) => rowSearchText(r).includes(query));
  }

  // ======== grouping ========
  function clienteKey(row) {
    const id = row.cliente_id ?? row.id_cliente ?? "";
    const nome = row.cliente_nome ?? row.nome ?? "";
    return String(id || nome || "sem_cliente");
  }

  function groupByCliente(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = clienteKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          cliente_id: row.cliente_id ?? row.id_cliente ?? null,
          cliente_nome: row.cliente_nome ?? row.nome ?? "—",
          rows: [],
        });
      }
      map.get(key).rows.push(row);
    });

    return Array.from(map.values()).sort((a, b) => {
      return String(a.cliente_nome).localeCompare(String(b.cliente_nome), "pt-BR", { sensitivity: "base" });
    });
  }

  function isExpanded(section, key) {
    return expanded[section].has(key);
  }

  function toggleExpanded(section, key) {
    if (expanded[section].has(key)) expanded[section].delete(key);
    else expanded[section].add(key);
  }

  // ======== render ========
  function renderGrouped(targetEl, rows, { section, emptyMode = "show" } = {}) {
    if (!targetEl) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      targetEl.innerHTML =
        emptyMode === "hide"
          ? ``
          : `<div class="muted" style="padding:12px;">Nenhum vencimento.</div>`;
      return;
    }

    const groups = groupByCliente(rows);

    targetEl.innerHTML = groups
      .map((g) => {
        const keyRaw = String(g.key);
        const keyAttr = esc(keyRaw);
        const nome = esc(g.cliente_nome || "—");
        const qtd = g.rows.length;

        const open = isExpanded(section, keyRaw);
        const arrow = open ? "▾" : "▸";

        const itemsHtml = g.rows
          .map((row) => {
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
                    <strong>${nome}</strong>
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
                    data-origem="vencimentos"
                    data-cliente-nome="${nome}"
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

        return `
          <div class="venc-group" data-venc-key="${keyAttr}" data-venc-section="${esc(section)}">
            <button
              class="venc-group__head"
              type="button"
              data-venc-toggle="1"
              data-venc-key="${keyAttr}"
              data-venc-section="${esc(section)}"
              aria-expanded="${open ? "true" : "false"}"
            >
              <span class="venc-group__arrow" aria-hidden="true">${arrow}</span>
              <span class="venc-group__name"><strong>${nome}</strong></span>
              <span class="venc-group__count">(${qtd})</span>
            </button>

            <div class="venc-group__body" style="display:${open ? "" : "none"};">
              ${itemsHtml}
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ======== accordion click (delegation) ========
  function wireAccordionClicks(container) {
    if (!container) return;

    container.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-venc-toggle]");
      if (!btn) return;

      const group = btn.closest(".venc-group");
      if (!group) return;

      const section = String(btn.getAttribute("data-venc-section") || "periodo");
      const key = String(btn.getAttribute("data-venc-key") || "");

      if (!key) return;

      // toggle state
      toggleExpanded(section, key);

      const open = isExpanded(section, key);

      const body = group.querySelector(".venc-group__body");
      const arrow = group.querySelector(".venc-group__arrow");

      if (body) body.style.display = open ? "" : "none";
      if (arrow) arrow.textContent = open ? "▾" : "▸";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  wireAccordionClicks(listAtrasadosEl);
  wireAccordionClicks(listEl);

  // ======== fetch/load ========
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

    return json.dados || { atrasados: [], lista: [], periodo_label: "" };
  }

  function rerenderWithSearch() {
    const q = searchInput ? searchInput.value : "";

    const atrasadosFiltrados = applyFilter(cache.atrasados, q);
    const listaFiltrada = applyFilter(cache.lista, q);

    setAtrasados(atrasadosFiltrados.length);
    setTituloPeriodo(cache.periodo_label || getPeriodoLabel(cache.period), listaFiltrada.length);

    if (listAtrasadosEl) {
      renderGrouped(listAtrasadosEl, atrasadosFiltrados, {
        section: "atrasados",
        emptyMode: "hide",
      });
    }

    renderGrouped(listEl, listaFiltrada, { section: "periodo" });
  }

  async function load(period) {
    const fallbackLabel = getPeriodoLabel(period);

    if (listAtrasadosEl) listAtrasadosEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;
    listEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;

    setAtrasados(0);
    setTituloPeriodo(fallbackLabel, 0);

    try {
      const dados = await fetchVencimentos(period);

      cache = {
        period,
        periodo_label: String(dados.periodo_label || "").trim() || fallbackLabel,
        atrasados: Array.isArray(dados.atrasados) ? dados.atrasados : [],
        lista: Array.isArray(dados.lista) ? dados.lista : [],
      };

      rerenderWithSearch();
    } catch (e) {
      console.error(e);

      cache = { period, periodo_label: fallbackLabel, atrasados: [], lista: [] };

      setAtrasados(0);
      if (listAtrasadosEl) listAtrasadosEl.innerHTML = "";
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Erro: ${esc(e.message)}</div>`;
      setTituloPeriodo(fallbackLabel, 0);
    }
  }

  // ======== tabs ========
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      currentPeriod = btn.getAttribute("data-filter") || "hoje";
      load(currentPeriod);
    });
  });

  // ======== search ========
  if (searchInput) {
    let t = null;
    searchInput.addEventListener("input", () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => rerenderWithSearch(), 120);
    });
  }

  load(currentPeriod);
})();
