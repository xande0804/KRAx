(function () {
  const tabsContainer = document.getElementById("emprestimosTabs");
  const listEl = document.getElementById("emprestimosList");
  const grupoFilter = document.getElementById("emprestimosGrupoFilter");
  if (!tabsContainer || !listEl) return;

  const tabs = Array.from(tabsContainer.querySelectorAll(".tab"));

  const pageCountEl = document.getElementById("emprestimosCount");
  const tabAll = document.getElementById("tabAll");
  const tabAtivo = document.getElementById("tabAtivo");
  const tabAtrasado = document.getElementById("tabAtrasado");
  const tabQuitado = document.getElementById("tabQuitado");

  let currentFilter = "all";
  let currentGrupoFilter = grupoFilter ? (grupoFilter.value || "todos") : "todos";
  let lastFullList = [];

  function money(v) {
    if (v == null) return "—";
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    return `R$ ${v}`;
  }

  function formatDateBR(yyyyMMdd) {
    const s = String(yyyyMMdd || "").slice(0, 10);
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    if (!y) return s;
    return `${d}/${m}/${y}`;
  }

  function todayYMD() {
    return new Date().toISOString().slice(0, 10);
  }

  function getProximoVencYMD(row) {
    return String(row?.proximo_vencimento || "").slice(0, 10);
  }

  function isAtrasado(row) {
    const status = String(row?.status || "").toUpperCase();
    if (status === "QUITADO") return false;
    const dv = getProximoVencYMD(row);
    if (!dv) return false;
    return dv < todayYMD();
  }

  function badgeHtml(status) {
    if (status === "QUITADO") return `<span class="badge badge--success">Quitado</span>`;
    if (status === "ATRASADO") return `<span class="badge badge--danger">Atrasado</span>`;
    return `<span class="badge badge--info">Ativo</span>`;
  }

  function normalizarGrupo(grupo) {
    const g = String(grupo ?? "PADRAO").trim().toUpperCase();
    return g || "PADRAO";
  }

  function grupoBadgeHtml(grupo) {
    const g = normalizarGrupo(grupo);
    if (g === "MARIA") {
      return `<span class="badge badge--maria">Novo</span>`;
    }
    return "";
  }

  function grupoEhNovo(grupo) {
    return normalizarGrupo(grupo) === "MARIA";
  }

  function grupoEhAntigo(grupo) {
    return !grupoEhNovo(grupo);
  }

  function passaFiltroGrupo(grupo, filtroSelecionado) {
    const filtro = String(filtroSelecionado ?? "todos").trim().toLowerCase();
    const g = normalizarGrupo(grupo);

    if (filtro === "novo") return grupoEhNovo(g);
    if (filtro === "antigo") return grupoEhAntigo(g);

    return true;
  }

  function getStatusTela(row) {
    if (String(row?.status || "").toUpperCase() === "QUITADO") return "QUITADO";
    if (isAtrasado(row)) return "ATRASADO";
    return "ATIVO";
  }

  function renderList(lista) {
    if (!Array.isArray(lista) || lista.length === 0) {
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Nenhum empréstimo encontrado.</div>`;
      return;
    }

    const html = lista.map((row) => {
      const statusTela = getStatusTela(row);
      const isQuitado = statusTela === "QUITADO";

      const statusData =
        statusTela === "QUITADO" ? "quitado" :
        statusTela === "ATRASADO" ? "atrasado" :
        "ativo";

      const parcelasTxt = row.parcelas || "—";
      const proxVenc = formatDateBR(row.proximo_vencimento);
      const grupo = normalizarGrupo(row.grupo);

      const pagamentoBtn = !isQuitado
        ? `
        <button
          class="linkbtn"
          type="button"
          data-modal-open="lancarPagamento"
          data-emprestimo-id="${row.emprestimo_id}"
          data-cliente-nome="${(row.cliente_nome || "").replace(/"/g, "&quot;")}"
          data-emprestimo-info="${`${money(row.valor_principal)} - ${parcelasTxt} parcelas`.replace(/"/g, "&quot;")}"
          data-origem="emprestimos"
          data-cliente-id="${row.cliente_id}"
        >💳 Pagamento</button>
        `
        : "";

      return `
<article class="list-item" data-status="${statusData}" data-grupo="${grupo}">
  <div class="list-item__main">
    <div class="list-item__title">
      <strong>${row.cliente_nome ?? "—"}</strong>
      ${badgeHtml(statusTela)}
      ${grupoBadgeHtml(grupo)}
    </div>
    <div class="list-item__meta">
      <span>${money(row.valor_principal)}</span>
      <span>${parcelasTxt} parcelas</span>
      ${proxVenc !== "—" ? `<span>Vence: ${proxVenc}</span>` : ""}
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
    }).join("");

    listEl.innerHTML = html;
  }

  function updateCounts(allList) {
    const listaGrupo = allList.filter((x) => passaFiltroGrupo(x.grupo, currentGrupoFilter));

    const total = listaGrupo.length;
    const quitados = listaGrupo.filter((x) => getStatusTela(x) === "QUITADO").length;
    const atrasados = listaGrupo.filter((x) => getStatusTela(x) === "ATRASADO").length;
    const ativos = listaGrupo.filter((x) => getStatusTela(x) === "ATIVO").length;

    if (pageCountEl) pageCountEl.textContent = `${total} empréstimos cadastrados`;
    if (tabAll) tabAll.textContent = `Todos (${total})`;
    if (tabAtivo) tabAtivo.textContent = `Ativos (${ativos})`;
    if (tabAtrasado) tabAtrasado.textContent = `Atrasados (${atrasados})`;
    if (tabQuitado) tabQuitado.textContent = `Quitados (${quitados})`;
  }

  async function fetchList() {
    const res = await fetch(`/KRAx/public/api.php?route=emprestimos/listar`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.mensagem || "Erro ao listar empréstimos");
    return json.dados || [];
  }

  function applyFrontFilter(lista, filterKey, grupoKey) {
    let filtrada = Array.isArray(lista) ? [...lista] : [];

    filtrada = filtrada.filter((x) => passaFiltroGrupo(x.grupo, grupoKey));

    if (filterKey === "all") return filtrada;

    return filtrada.filter((x) => getStatusTela(x) === filterKey.toUpperCase());
  }

  function aplicarFiltrosNaListaAtual() {
    updateCounts(lastFullList);
    const lista = applyFrontFilter(lastFullList, currentFilter, currentGrupoFilter);
    renderList(lista);
  }

  async function load(filterKey) {
    try {
      listEl.classList.add("is-loading");

      const all = await fetchList();
      lastFullList = all;

      updateCounts(all);
      const lista = applyFrontFilter(all, filterKey, currentGrupoFilter);
      renderList(lista);

    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div class="muted" style="padding:12px;">Erro ao carregar empréstimos.</div>`;
    } finally {
      listEl.classList.remove("is-loading");
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

      aplicarFiltrosNaListaAtual();
    });
  });

  if (grupoFilter) {
    grupoFilter.addEventListener("change", () => {
      currentGrupoFilter = grupoFilter.value || "todos";
      aplicarFiltrosNaListaAtual();
    });
  }

  currentFilter = "all";
  load("all");
})();