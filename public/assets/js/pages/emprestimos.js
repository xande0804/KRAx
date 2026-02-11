// public/assets/js/pages/emprestimos.js
(function () {
  const tabsContainer = document.getElementById("emprestimosTabs");
  const listEl = document.getElementById("emprestimosList");
  if (!tabsContainer || !listEl) return;

  const tabs = Array.from(tabsContainer.querySelectorAll(".tab"));

  const pageCountEl = document.getElementById("emprestimosCount");
  const tabAll = document.getElementById("tabAll");
  const tabAtivo = document.getElementById("tabAtivo");
  const tabAtrasado = document.getElementById("tabAtrasado");
  const tabQuitado = document.getElementById("tabQuitado");

  let currentFilter = "all";

  function badgeHtml(status) {
    const s = (status || "").toUpperCase();
    if (s === "QUITADO") return `<span class="badge badge--success">Quitado</span>`;
    if (s === "ATRASADO") return `<span class="badge badge--danger">Atrasado</span>`;
    return `<span class="badge badge--info">Ativo</span>`;
  }

  function money(v) {
    if (v == null) return "—";
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v);
    return s.includes("R$") ? s : `R$ ${s}`;
  }

  function formatDateBR(yyyyMMdd) {
    const s = String(yyyyMMdd || "");
    if (!s) return "—";
    const only = s.slice(0, 10);
    const [y, m, d] = only.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }

  function renderList(lista) {
    if (!Array.isArray(lista) || lista.length === 0) {
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Nenhum empréstimo encontrado.</div>`;
      return;
    }

    listEl.innerHTML = lista
      .map((row) => {
        const status = (row.status || "").toUpperCase();
        const isQuitado = status === "QUITADO";

        const statusData =
          status === "QUITADO" ? "quitado" : status === "ATRASADO" ? "atrasado" : "ativo";

        const parcelasTxt = row.parcelas || "—";

        const rawVenc = row.proximo_vencimento || "";
        const proxVenc = rawVenc ? formatDateBR(rawVenc) : "";
        const showVenc = proxVenc && proxVenc !== "—";

        // ✅ Só mostra botão de pagamento se NÃO estiver quitado
        const pagamentoBtn = !isQuitado
          ? `
    <button
      class="linkbtn"
      type="button"
      data-modal-open="lancarPagamento"
      data-emprestimo-id="${row.emprestimo_id}"
      data-cliente-nome="${(row.cliente_nome || "").replace(/"/g, "&quot;")}"
      data-emprestimo-info="${`${money(row.valor_principal)} - ${parcelasTxt} parcelas`.replace(
        /"/g,
        "&quot;"
      )}"
      data-origem="emprestimos"
      data-cliente-id="${row.cliente_id}"
    >💳 Pagamento</button>
          `
          : "";

        return `
<article class="list-item" data-status="${statusData}">
  <div class="list-item__main">
    <div class="list-item__title">
      <strong>${row.cliente_nome ?? "—"}</strong>
      ${badgeHtml(status)}
    </div>
    <div class="list-item__meta">
      <span>${money(row.valor_principal)}</span>
      <span>${parcelasTxt} parcelas</span>
      ${showVenc ? `<span>Vence: ${proxVenc}</span>` : ""}
    </div>
  </div>

  <div class="list-item__actions">
    <button
      class="linkbtn"
      type="button"
      data-modal-open="detalhesEmprestimo"
      data-emprestimo-id="${row.emprestimo_id}"
    >👁️ Detalhes</button>

    ${pagamentoBtn}
  </div>
</article>
        `;
      })
      .join("");
  }

  function updateCounts(allList) {
    const total = allList.length;
    const ativos = allList.filter((x) => (x.status || "").toUpperCase() === "ATIVO").length;
    const quitados = allList.filter((x) => (x.status || "").toUpperCase() === "QUITADO").length;
    const atrasados = allList.filter((x) => (x.status || "").toUpperCase() === "ATRASADO").length;

    if (pageCountEl) pageCountEl.textContent = `${total} empréstimos cadastrados`;

    if (tabAll) tabAll.textContent = `Todos (${total})`;
    if (tabAtivo) tabAtivo.textContent = `Ativos (${ativos})`;
    if (tabAtrasado) tabAtrasado.textContent = `Atrasados (${atrasados})`;
    if (tabQuitado) tabQuitado.textContent = `Quitados (${quitados})`;
  }

  async function fetchList(filterKey) {
    const map = { all: null, ativo: "ATIVO", atrasado: "ATRASADO", quitado: "QUITADO" };
    const filtro = map[filterKey] ?? null;

    const url = filtro
      ? `/KRAx/public/api.php?route=emprestimos/listar&filtro=${encodeURIComponent(filtro)}`
      : `/KRAx/public/api.php?route=emprestimos/listar`;

    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) throw new Error(json.mensagem || "Erro ao listar empréstimos");
    return json.dados || [];
  }

  async function load(filterKey) {
    listEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;
    try {
      const all = await fetchList("all");
      updateCounts(all);

      const lista = filterKey === "all" ? all : await fetchList(filterKey);
      renderList(lista);
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Erro: ${e.message}</div>`;
    }
  }

  window.refreshEmprestimosList = function () {
    load(currentFilter);
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const filter = tab.getAttribute("data-filter") || "all";
      currentFilter = filter;

      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      load(filter);
    });
  });

  currentFilter = "all";
  load("all");
})();
