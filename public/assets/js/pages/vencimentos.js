// public/assets/js/pages/vencimentos.js
(function () {
  const tabs = document.getElementById("vencTabs");
  const tituloPeriodoEl = document.getElementById("tituloPeriodo");
  const listEl = document.getElementById("vencList");

  const searchInput = document.getElementById("vencSearch");
  const grupoFilter =
    document.getElementById("vencGrupoFilter") ||
    document.getElementById("vencimentosGrupoFilter");

  if (!tabs || !listEl) return;

  const buttons = Array.from(tabs.querySelectorAll(".tab"));
  const API = "/KRAx/public/api.php";

  let currentPeriod = "por_data";
  window.refreshVencimentos = () => load(currentPeriod);

  let cache = {
    period: "por_data",
    periodo_label: "Hoje",
    lista: [],
  };

  const expanded = {};

  function isExpanded(section, key) {
    if (!expanded[section]) expanded[section] = new Set();
    return expanded[section].has(key);
  }

  function toggleExpanded(section, key) {
    if (!expanded[section]) expanded[section] = new Set();
    if (expanded[section].has(key)) expanded[section].delete(key);
    else expanded[section].add(key);
  }

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
    return `<span class="badge">Pendente</span>`;
  }

  function normalizarGrupo(grupo) {
    const g = String(grupo ?? "PADRAO").trim().toUpperCase();
    return g || "PADRAO";
  }

  function grupoEhNovo(grupo) {
    return normalizarGrupo(grupo) === "MARIA";
  }

  function grupoEhAntigo(grupo) {
    return !grupoEhNovo(grupo);
  }

  function badgeGrupoHtml(grupo) {
    return grupoEhNovo(grupo)
      ? `<span class="badge badge--maria">Novo</span>`
      : ``;
  }

  function passaFiltroGrupo(grupo, filtroSelecionado) {
    const filtro = String(filtroSelecionado ?? "todos").trim().toLowerCase();
    const g = normalizarGrupo(grupo);

    if (filtro === "novo") return grupoEhNovo(g);
    if (filtro === "antigo") return grupoEhAntigo(g);

    return true;
  }

  function getPeriodoLabel(period) {
    if (period === "por_data") return "Hoje";
    if (period === "amanha") return "Mensais";
    if (period === "semana") return "Semanais";
    if (period === "atrasados") return "Atrasados";
    return "Diários";
  }

  function setTituloPeriodo(label, qtd) {
    if (!tituloPeriodoEl) return;
    const nome = label || "Hoje";
    tituloPeriodoEl.textContent = `${nome} (${qtd || 0})`;
  }

  // ======== BUSCA INTELIGENTE (SEM PONTUAÇÃO) ========
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
    const grupo = row.grupo || "";

    // Versões limpas (só números) do CPF e Telefone
    const cpfLimpo = cpf.replace(/\D/g, "");
    const telLimpo = tel.replace(/\D/g, "");

    // Junta tudo (com e sem pontuação) num "linguição" gigante para o buscador
    return norm([nome, cpf, tel, cpfLimpo, telLimpo, grupo].filter(Boolean).join(" "));
  }

  function applyFilter(rows, q) {
    const rawQ = String(q || "");
    const qNorm = norm(rawQ);
    const qNumeros = rawQ.replace(/\D/g, ""); // Pega só os números do que o usuário digitou
    const termos = qNorm.split(/\s+/).filter(Boolean); // Divide a busca por espaços (ex: "Kaua 61")

    const grupoSelecionado = grupoFilter ? grupoFilter.value : "todos";

    return (Array.isArray(rows) ? rows : []).filter((r) => {
      const textoBusca = rowSearchText(r);

      let matchTexto = true;
      
      // Se o usuário digitou algo na busca
      if (termos.length > 0) {
        // Verifica se a sequência de números exata existe (ex: 6185101778)
        const bateNumeros = qNumeros && textoBusca.includes(qNumeros);
        
        // Verifica se todas as palavras digitadas existem na linha (ex: "Kaua" e "61")
        const bateTermos = termos.every(t => textoBusca.includes(t));

        if (!bateNumeros && !bateTermos) {
          matchTexto = false;
        }
      }

      const matchGrupo = passaFiltroGrupo(r.grupo, grupoSelecionado);
      return matchTexto && matchGrupo;
    });
  }
  // ===================================================

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
          grupo: normalizarGrupo(row.grupo),
          rows: [],
        });
      }
      map.get(key).rows.push(row);
    });

    return Array.from(map.values()).sort((a, b) => {
      return String(a.cliente_nome).localeCompare(String(b.cliente_nome), "pt-BR", { sensitivity: "base" });
    });
  }

  function buildGroupedHtml(rows, section) {
    if (!Array.isArray(rows) || rows.length === 0) return "";

    const groups = groupByCliente(rows);

    return groups
      .map((g) => {
        const keyRaw = String(g.key);
        const keyAttr = esc(keyRaw);
        const nome = esc(g.cliente_nome || "—");
        const qtd = g.rows.length;
        const grupo = normalizarGrupo(g.grupo);

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
            const grupoRow = normalizarGrupo(row.grupo);

            const emprestimoInfo = `Prestação ${parcelaNum} • ${valorTxt} • Venc: ${venc}`;

            return `
              <article class="list-item venc-item" data-status="${isAtrasado ? "atrasado" : "pendente"}" data-grupo="${esc(grupoRow)}">
                <div class="venc-left">
                  <div class="venc-title">
                    ${isAtrasado ? `<span class="warn-dot">!</span>` : ``}
                    <strong>${nome}</strong>
                    ${badgeHtml(status)}
                    ${badgeGrupoHtml(grupoRow)}
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
          <div class="venc-group" data-venc-key="${keyAttr}" data-venc-section="${esc(section)}" data-grupo="${esc(grupo)}">
            <button
              class="venc-group__head"
              type="button"
              data-venc-toggle="1"
              data-venc-key="${keyAttr}"
              data-venc-section="${esc(section)}"
              aria-expanded="${open ? "true" : "false"}"
            >
              <span class="venc-group__count">(${qtd})</span>
              <span class="venc-group__name">
                <strong>${nome}</strong>
                ${badgeGrupoHtml(grupo)}
              </span>
              <span class="venc-group__arrow" aria-hidden="true">${arrow}</span>
            </button>

            <div class="venc-group__body" style="display:${open ? "" : "none"};">
              ${itemsHtml}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function buildMasterAccordion(title, list, keySection, theme = "normal") {
    if (!list || list.length === 0) return "";

    const open = isExpanded("master_accordion", keySection);
    const arrow = open ? "▾" : "▸";
    const qtd = list.length;

    const innerHtml = buildGroupedHtml(list, "inner_" + keySection);
    
    const bgCor = theme === "danger" ? "#fef2f2" : "#f8fafc"; 
    const txtCor = theme === "danger" ? "#dc2626" : "#334155";
    const borderCor = theme === "danger" ? "#fca5a5" : "#e2e8f0";
    const iconHtml = theme === "danger" ? `<span class="warn-icon" style="margin-right: 8px; font-size: 1.1em;">⛔</span>` : ``;

    return `
      <div class="venc-group" data-venc-key="${keySection}" data-venc-section="master_accordion" style="margin-bottom: 16px; border: 1px solid ${borderCor}; border-radius: 8px; overflow: hidden; background-color: #fff;">
        <button
          class="venc-group__head"
          type="button"
          data-venc-toggle="1"
          data-venc-section="master_accordion"
          data-venc-key="${keySection}"
          aria-expanded="${open ? "true" : "false"}"
          style="background-color: ${bgCor}; color: ${txtCor}; border: none; padding: 14px 20px; display: flex; align-items: center; border-bottom: ${open ? `1px solid ${borderCor}` : 'none'}; border-radius: 0;"
        >
          <span class="venc-group__name" style="flex-grow: 1; font-size: 1.05em; font-weight: bold; letter-spacing: 0.3px;">
            ${iconHtml}
            ${title}
          </span>
          <span class="venc-group__count" style="margin-right: 12px; font-weight: bold; background: rgba(0,0,0,0.06); padding: 2px 10px; border-radius: 12px; font-size: 0.9em;">${qtd}</span>
          <span class="venc-group__arrow" aria-hidden="true" style="font-size: 1.2em;">${arrow}</span>
        </button>

        <div class="venc-group__body" style="display:${open ? "block" : "none"}; padding: 16px 12px 16px 24px;">
          ${innerHtml}
        </div>
      </div>
    `;
  }

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

      toggleExpanded(section, key);

      const open = isExpanded(section, key);

      const body = group.querySelector(".venc-group__body");
      const arrow = group.querySelector(".venc-group__arrow");
      
      if (body) body.style.display = open ? "block" : "none";
      if (arrow) arrow.textContent = open ? "▾" : "▸";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      
      if (section === "master_accordion") {
        const isDanger = btn.style.backgroundColor.includes("fef2f2") || btn.style.backgroundColor.includes("rgb(254, 242, 242)");
        const borderCor = isDanger ? "#fca5a5" : "#e2e8f0";
        btn.style.borderBottom = open ? `1px solid ${borderCor}` : 'none';
      }
    });
  }

  wireAccordionClicks(listEl);

  async function fetchVencimentos(period) {
    const map = {
      por_data: "vencimentos/por_data",
      hoje: "vencimentos/hoje",
      semana: "vencimentos/semana",
      amanha: "vencimentos/amanha",
      atrasados: "vencimentos/atrasados",
    };

    const route = map[period] || map.por_data;
    const url = `${API}?route=${route}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.ok) throw new Error(json.mensagem || "Erro ao buscar vencimentos");

    return json.dados || { lista: [], atrasados: [], periodo_label: "" };
  }

  function rerenderWithSearch() {
    const q = searchInput ? searchInput.value : "";
    const listaFiltrada = applyFilter(cache.lista, q);

    const titleLabel = cache.period === "por_data" ? "Hoje" : (cache.periodo_label || getPeriodoLabel(cache.period));
    setTituloPeriodo(titleLabel, listaFiltrada.length);

    if (cache.period === "atrasados" || cache.period === "por_data") {
      const diarios = listaFiltrada.filter((r) => String(r.tipo_vencimento).toUpperCase() === "DIARIO");
      const semanais = listaFiltrada.filter((r) => String(r.tipo_vencimento).toUpperCase() === "SEMANAL");
      const mensais = listaFiltrada.filter((r) => String(r.tipo_vencimento).toUpperCase() === "MENSAL");

      let html = "";

      if (cache.period === "atrasados") {
        html += buildMasterAccordion("Atrasados Diários", diarios, "atrasados_diario", "danger");
        html += buildMasterAccordion("Atrasados Semanais", semanais, "atrasados_semanal", "danger");
        html += buildMasterAccordion("Atrasados Mensais", mensais, "atrasados_mensal", "danger");
      } else {
        html += buildMasterAccordion("Vencimentos Diários", diarios, "hoje_diario", "normal");
        html += buildMasterAccordion("Vencimentos Semanais", semanais, "hoje_semanal", "normal");
        html += buildMasterAccordion("Vencimentos Mensais", mensais, "hoje_mensal", "normal");
      }

      if (!html) {
        html = `<div class="muted" style="padding:12px;">Nenhum vencimento encontrado.</div>`;
      }

      listEl.innerHTML = html;
    } else {
      const htmlNormal = buildGroupedHtml(listaFiltrada, "periodo");
      listEl.innerHTML = htmlNormal || `<div class="muted" style="padding:12px;">Nenhum vencimento encontrado.</div>`;
    }
  }

  async function load(period) {
    const fallbackLabel = getPeriodoLabel(period);

    listEl.innerHTML = `<div class="muted" style="padding:12px;">Carregando...</div>`;
    setTituloPeriodo(fallbackLabel, 0);

    try {
      const dados = await fetchVencimentos(period);

      const atrasados = Array.isArray(dados.atrasados) ? dados.atrasados : [];
      const normais = Array.isArray(dados.lista) ? dados.lista : [];

      cache = {
        period,
        periodo_label: String(dados.periodo_label || "").trim() || fallbackLabel,
        lista: [...atrasados, ...normais],
      };

      rerenderWithSearch();
    } catch (e) {
      console.error(e);

      cache = { period, periodo_label: fallbackLabel, lista: [] };

      listEl.innerHTML = `<div class="muted" style="padding:12px;">Erro: ${esc(e.message)}</div>`;
      setTituloPeriodo(fallbackLabel, 0);
    }
  }

  // --- CONTROLE DE ABAS ---
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      currentPeriod = btn.getAttribute("data-filter") || "por_data";
      load(currentPeriod);
    });
  });

  if (searchInput) {
    let t = null;
    searchInput.addEventListener("input", () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => rerenderWithSearch(), 120);
    });
  }

  if (grupoFilter) {
    grupoFilter.addEventListener("change", () => {
      rerenderWithSearch();
    });
  }

  load(currentPeriod);
})();