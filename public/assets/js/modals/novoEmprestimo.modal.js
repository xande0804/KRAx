// public/assets/js/modals/novoEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const toast = window.toast || function () { };
  const GestorModal = window.GestorModal;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // =========================
  // Helpers (money/date)
  // =========================
  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ✅ pt-BR: "1.234,56" -> 1234.56
  function parseMoneyBR(str) {
    const s0 = String(str ?? "").trim();
    if (!s0) return 0;
    let s = s0.replace(/R\$\s?/g, "");
    s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function moneyBR(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtDateBR(iso) {
    const s = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function addDaysISO(iso, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
    const [y, m, d] = iso.split("-").map((x) => Number(x));
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(days || 0));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function addMonthsISO(iso, months) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
    const [y, m, d] = iso.split("-").map((x) => Number(x));
    const dt = new Date(y, m - 1, d);
    dt.setMonth(dt.getMonth() + Number(months || 0));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  // weekday: 1..6 (Seg..Sáb). Retorna próxima data >= base+minDays que cai no weekday.
  function nextWeekdayISO(baseISO, weekday1to6, minDaysAhead) {
    const base = String(baseISO || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
    const wd = Math.min(6, Math.max(1, toNumber(weekday1to6)));
    const minAhead = Math.max(0, toNumber(minDaysAhead));

    const [y, m, d] = base.split("-").map((x) => Number(x));
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() + minAhead);

    const target = wd; // 1..6 (Seg..Sáb)
    let dt = new Date(start.getTime());
    for (let i = 0; i < 14; i++) {
      if (dt.getDay() === target) {
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      }
      dt.setDate(dt.getDate() + 1);
    }
    return "";
  }

  // =========================
  // ✅ NOVO: regra "nunca domingo" no FRONT + ALERT
  // =========================
  function isSundayISO(iso) {
    const s = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getDay() === 0; // 0 = domingo
  }

  function shiftIfSundayISO(iso) {
    return isSundayISO(iso) ? addDaysISO(iso, 1) : String(iso || "");
  }

  /**
   * Ajusta o input de data caso caia em domingo.
   * - mode: "alert" -> mostra alert e ajusta para segunda
   * - mode: "silent" -> só ajusta (sem alert)
   */
  function ensureNotSundayOnDateInput(dateEl, opts = {}) {
    if (!dateEl) return;

    const mode = opts.mode || "silent"; // "alert" | "silent"

    const v0 = String(dateEl.value || "");
    if (!v0) return;

    if (!isSundayISO(v0)) return;

    const v1 = shiftIfSundayISO(v0);
    if (!v1) return;

    if (mode === "alert") {
      const msg =
        `⚠️ Atenção!\n\n` +
        `O dia selecionado (${fmtDateBR(v0)}) cai em um DOMINGO.\n` +
        `A parcela será automaticamente transferida para a SEGUNDA-FEIRA (${fmtDateBR(v1)}).`;
      alert(msg);
    }

    dateEl.value = v1;
  }

  // =========================
  // ✅ SIMULAÇÃO 100% IGUAL AO BACKEND
  // - MENSAL: total = principal + (principal * juros%) * qtd
  // - DIARIO/SEMANAL: total = principal * (1 + juros%)
  // - divide em centavos e resto vai na última parcela
  // =========================
  function calcParcelasLikeBackend(principal, jurosPct, qtd, tipoV) {
    const P = Math.max(0, Number(principal) || 0);
    const n = Math.max(1, Number(qtd) || 1);
    const p = Math.max(0, Number(jurosPct) || 0) / 100;
    const tipo = String(tipoV || "").toUpperCase();

    if (P <= 0) return { total: 0, baseParcela: 0, ultimaParcela: 0 };

    let totalComJuros = 0;
    if (tipo === "MENSAL") {
      const jurosInteiro = P * p;
      totalComJuros = P + (jurosInteiro * n);
    } else {
      totalComJuros = P * (1 + p);
    }

    const totalC = Math.round(totalComJuros * 100);
    const baseC = Math.floor(totalC / n);
    const restoC = totalC - (baseC * n);

    return {
      total: totalC / 100,
      baseParcela: baseC / 100,
      ultimaParcela: (baseC + restoC) / 100,
    };
  }

  // =========================
  // Autocomplete state/cache
  // =========================
  let clientesCache = null;
  let acActiveIndex = -1;

  function escHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTxt(s) {
    return String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function buildNormalizedMap(original) {
    const src = String(original ?? "");
    let norm = "";
    const map = [];
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (let k = 0; k < base.length; k++) {
        norm += base[k].toLowerCase();
        map.push(i);
      }
    }
    return { norm, map, src };
  }

  function highlightMatchAccentsSafe(nome, query) {
    const raw = String(nome ?? "");
    const q = normalizeTxt(query);
    if (!q) return escHtml(raw);

    const { norm, map, src } = buildNormalizedMap(raw);
    const idx = norm.indexOf(q);
    if (idx < 0) return escHtml(raw);

    const startOrig = map[idx];
    const endOrig = map[idx + q.length - 1] + 1;

    const a = src.slice(0, startOrig);
    const b = src.slice(startOrig, endOrig);
    const c = src.slice(endOrig);

    return `${escHtml(a)}<strong>${escHtml(b)}</strong>${escHtml(c)}`;
  }

  async function loadClientesCache() {
    if (Array.isArray(clientesCache)) return clientesCache;

    try {
      const res = await fetch(`/KRAx/public/api.php?route=clientes/listar`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.mensagem || "Erro ao carregar clientes");

      const lista = Array.isArray(json.dados) ? json.dados : [];
      clientesCache = lista
        .map((c) => ({ id: String(c.id), nome: String(c.nome || "") }))
        .filter((c) => c.id && c.nome);

      clientesCache.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );

      return clientesCache;
    } catch (err) {
      console.error(err);
      onError("Erro de rede ao carregar clientes");
      clientesCache = [];
      return clientesCache;
    }
  }

  function injectModalNovoEmprestimo() {
    if (qs("#modalNovoEmprestimo")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalNovoEmprestimo";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Novo empréstimo</h3>
            <p class="modal__subtitle">Preencha os dados do empréstimo.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalNovoEmprestimo">×</button>
        </header>

        <form class="modal__body" id="formNovoEmprestimo" action="/KRAx/public/api.php?route=emprestimos/criar" method="post">
          <div class="form-grid form-grid--3">

            <!-- ✅ CLIENTE (Autocomplete) -->
            <div class="field form-span-2" style="position:relative;">
              <label>Cliente</label>

              <input type="hidden" name="cliente_id" required id="clienteIdHidden" />

              <div style="position:relative;">
                <input
                  type="text"
                  id="clienteSearchInput"
                  autocomplete="off"
                  placeholder="Digite para buscar (ex: AL)..."
                />
                <button
                  type="button"
                  id="clienteClearBtn"
                  title="Trocar cliente"
                  aria-label="Trocar cliente"
                  style="display:none;"
                >×</button>
              </div>

              <div class="acbox" id="clienteSuggestBox" hidden></div>

              <div class="muted" style="margin-top:6px;">
                Digite para buscar.
              </div>
            </div>

            <div class="field form-span-2">
              <label>Data do empréstimo</label>
              <input type="date" name="data_emprestimo" required />
            </div>

            <!-- ✅ mesma linha: Valor, Parcelas, Juros -->
            <div class="field">
              <label>Valor (R$)</label>
              <input name="valor_principal" inputmode="decimal" placeholder="0,00" required />
            </div>

            <div class="field">
              <label>Parcelas</label>
              <input type="number" min="1" name="quantidade_parcelas" value="20" required />
            </div>

            <div class="field">
              <label>Juros (%)</label>
              <input type="number" min="0" step="0.01" name="porcentagem_juros" value="30" required />
            </div>

            <!-- ✅ simulação logo abaixo (1 linha só) -->
            <div class="field form-span-2">
              <div class="simbox" id="simLineNovoEmprestimo" title="Simulação">
                <div class="simline">
                  <span class="simtitle">Simulação:</span>
                  <span class="simitem"><span class="simk">1º</span> <span class="simv" id="simPrimeiroVenc">—</span></span>
                  <span class="simsep">•</span>
                  <span class="simitem"><span class="simk">Últ</span> <span class="simv" id="simUltimoVenc">—</span></span>
                  <span class="simsep">•</span>
                  <span class="simitem"><span class="simk">Total</span> <span class="simv" id="simTotal">—</span></span>
                  <span class="simsep">•</span>
                  <span class="simitem"><span class="simk">Parc</span> <span class="simv" id="simParcela">—</span></span>
                </div>
              </div>
            </div>

            <div class="field form-span-2">
              <label>Tipo de vencimento</label>
              <select name="tipo_vencimento" required id="tipoVencimentoNovoEmprestimo">
                <option value="DIARIO">Diário</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSAL">Mensal</option>
              </select>
            </div>

            <!-- ✅ Dinâmico: semanal (1..6) / diário-mensal (date) -->
            <div class="field form-span-2" id="wrapRegraVencimento"></div>

          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalNovoEmprestimo">Cancelar</button>
            <button class="btn btn--primary" type="submit" id="btnSubmitNovoEmprestimo">Salvar empréstimo</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // =========================
    // CSS mínimo (inline safe)
    // =========================
    const styleId = "novoEmprestimoSimMiniStyle";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
        /* botão X do cliente */
        #modalNovoEmprestimo #clienteClearBtn{
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          width:28px; height:28px; border-radius:999px; border:1px solid #e6e8ef; background:#fff;
          cursor:pointer; line-height:26px; font-size:18px; padding:0;
        }

        /* ✅ grid 3 colunas fixas (Valor / Parcelas / Juros) */
        #modalNovoEmprestimo .form-grid--3{
          display:grid;
          grid-template-columns: 1.4fr 0.8fr 0.8fr;
          gap: 12px;
        }

        /* spans */
        #modalNovoEmprestimo .form-span-2{
          grid-column: 1 / -1;
        }

        /* simulação: 1 linha só (sem quebrar) */
        #modalNovoEmprestimo .simbox{
          height: 40px;
          display:flex;
          align-items:center;
          padding: 0 10px;
          border:1px solid #e6e8ef;
          background:#fff;
          border-radius:14px;
          overflow:hidden;
        }
        #modalNovoEmprestimo .simline{
          width:100%;
          display:block;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          line-height:1;
        }
        #modalNovoEmprestimo .simtitle{
          font-size:12px;
          font-weight:800;
          color:#111827;
          margin-right:8px;
        }
        #modalNovoEmprestimo .simsep{ margin: 0 6px; color:#6b7280; }
        #modalNovoEmprestimo .simk{ font-size:12px; color:#6b7280; }
        #modalNovoEmprestimo .simv{ font-size:12px; font-weight:800; color:#111827; }

        /* responsivo */
        @media (max-width: 720px){
          #modalNovoEmprestimo .form-grid--3{
            grid-template-columns: 1fr 1fr;
          }
          #modalNovoEmprestimo .form-grid--3 .field:nth-of-type(3){
            grid-column: 1 / -1;
          }
        }
      `;
      document.head.appendChild(st);
    }

    // =========================
    // Elements
    // =========================
    const form = qs("#formNovoEmprestimo");
    const btnSubmit = qs("#btnSubmitNovoEmprestimo");

    const tipoSel = modal.querySelector("#tipoVencimentoNovoEmprestimo");
    const wrapRegra = modal.querySelector("#wrapRegraVencimento");
    const inputDataEmp = modal.querySelector('input[name="data_emprestimo"]');

    const clienteHidden = modal.querySelector("#clienteIdHidden");
    const clienteInput = modal.querySelector("#clienteSearchInput");
    const suggestBox = modal.querySelector("#clienteSuggestBox");
    const clearBtn = modal.querySelector("#clienteClearBtn");

    // simulação
    const simPrimeiroEl = modal.querySelector("#simPrimeiroVenc");
    const simTotalEl = modal.querySelector("#simTotal");
    const simParcelaEl = modal.querySelector("#simParcela");
    const simUltimoEl = modal.querySelector("#simUltimoVenc");

    function getRegraInfoAtual() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
      if (tipo === "SEMANAL") {
        const sel = modal.querySelector('select[name="regra_vencimento"]');
        return { tipo, regra: sel ? String(sel.value || "") : "" };
      }
      const inp = modal.querySelector('input[name="regra_vencimento"][type="date"]');
      return { tipo, regra: inp ? String(inp.value || "") : "" };
    }

    function calcPrimeiroVencISO(dataEmp, tipo, regra) {
      const base = String(dataEmp || "");
      const t = String(tipo || "").toUpperCase();
      const r = String(regra || "");
      if (!base) return "";
      if (t === "SEMANAL") return nextWeekdayISO(base, r, 7);
      return shiftIfSundayISO(r || "");
    }

    function calcUltimoVencISO(dataEmp, tipo, regra, qtd) {
      const base = String(dataEmp || "");
      const t = String(tipo || "").toUpperCase();
      const n = Math.max(1, toNumber(qtd));
      const r = String(regra || "");

      if (t === "SEMANAL") {
        const first = nextWeekdayISO(base, r, 7);
        if (!first) return "";
        return addDaysISO(first, 7 * (n - 1));
      }

      const first = shiftIfSundayISO(r || base);
      if (!first) return "";
      if (t === "DIARIO") return addDaysISO(first, n - 1);
      if (t === "MENSAL") return addMonthsISO(first, n - 1);
      return "";
    }

    function updateSimMini() {
      const principal = parseMoneyBR(modal.querySelector('input[name="valor_principal"]')?.value);
      const qtd = Math.max(1, toNumber(modal.querySelector('input[name="quantidade_parcelas"]')?.value));
      const jurosPct = Math.max(0, toNumber(modal.querySelector('input[name="porcentagem_juros"]')?.value));
      const dataEmp = modal.querySelector('input[name="data_emprestimo"]')?.value || todayISO();
      const { tipo, regra } = getRegraInfoAtual();
      const tipoV = String(tipo || "").toUpperCase();

      const { total, baseParcela } = calcParcelasLikeBackend(principal, jurosPct, qtd, tipoV);

      const primeiroISO = calcPrimeiroVencISO(dataEmp, tipoV, regra);
      const ultimoISO = calcUltimoVencISO(dataEmp, tipoV, regra, qtd);

      if (simPrimeiroEl) simPrimeiroEl.textContent = (primeiroISO && principal > 0) ? fmtDateBR(primeiroISO) : "—";
      if (simUltimoEl) simUltimoEl.textContent = (ultimoISO && principal > 0) ? fmtDateBR(ultimoISO) : "—";
      if (simTotalEl) simTotalEl.textContent = principal > 0 ? moneyBR(total) : "—";
      if (simParcelaEl) simParcelaEl.textContent = principal > 0 ? moneyBR(baseParcela) : "—";
    }

    let simRAF = 0;
    function scheduleSimUpdate() {
      if (simRAF) cancelAnimationFrame(simRAF);
      simRAF = requestAnimationFrame(() => {
        simRAF = 0;
        updateSimMini();
      });
    }

    // =========================
    // Regra vencimento dinâmica + DEFAULTS automáticos
    // =========================
    function bindRegraDateEvents() {
      const dateEl = modal.querySelector("#regraVencimentoDate");
      if (!dateEl) return;
      if (dateEl.dataset.boundSunday) return;
      dateEl.dataset.boundSunday = "1";

      // ✅ quando o usuário escolhe manualmente: ALERT + ajuste para segunda
      dateEl.addEventListener("change", () => {
        ensureNotSundayOnDateInput(dateEl, { mode: "alert" });
        scheduleSimUpdate();
      });

      // input: só garante ajuste silencioso
      dateEl.addEventListener("input", () => {
        ensureNotSundayOnDateInput(dateEl, { mode: "silent" });
        scheduleSimUpdate();
      });
    }

    function renderRegraField() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
      if (!wrapRegra) return;

      const baseDate = (inputDataEmp && inputDataEmp.value) ? inputDataEmp.value : todayISO();

      if (tipo === "SEMANAL") {
        wrapRegra.innerHTML = `
          <label>Dia da semana</label>
          <select name="regra_vencimento" required id="regraVencimentoSelect">
            <option value="1">Segunda</option>
            <option value="2">Terça</option>
            <option value="3">Quarta</option>
            <option value="4">Quinta</option>
            <option value="5">Sexta</option>
            <option value="6">Sábado</option>
          </select>
          <div class="muted" style="margin-top:6px;">Primeira prestação será no mínimo daqui 7 dias e cairá no dia selecionado (sem domingo).</div>
        `;
      } else {
        wrapRegra.innerHTML = `
          <label>Primeiro vencimento</label>
          <input type="date" name="regra_vencimento" required id="regraVencimentoDate" />
          <div class="muted" style="margin-top:6px;">
            ${tipo === "MENSAL" ? "Primeiro vencimento automático: mesmo dia do próximo mês." : "Primeiro vencimento automático."}
          </div>
        `;

        const dateEl = wrapRegra.querySelector("#regraVencimentoDate");
        if (dateEl) {
          dateEl.min = baseDate;

          const defRaw = (tipo === "MENSAL") ? addMonthsISO(baseDate, 1) : addDaysISO(baseDate, 1);
          const defVal = shiftIfSundayISO(defRaw);

          dateEl.value = defVal;
          if (dateEl.value && dateEl.value < baseDate) dateEl.value = defVal;

          // ✅ garante no load (sem alert)
          ensureNotSundayOnDateInput(dateEl, { mode: "silent" });

          // ✅ garante nos eventos
          bindRegraDateEvents();
        }
      }

      scheduleSimUpdate();
    }

    if (tipoSel) tipoSel.addEventListener("change", renderRegraField);

    if (inputDataEmp) {
      inputDataEmp.addEventListener("change", () => {
        const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
        const base = inputDataEmp.value || todayISO();

        const dateEl = modal.querySelector("#regraVencimentoDate");
        if (dateEl) {
          dateEl.min = base;

          const desiredRaw = (tipo === "MENSAL") ? addMonthsISO(base, 1) : addDaysISO(base, 1);
          const desired = shiftIfSundayISO(desiredRaw);

          dateEl.value = desired;
          if (dateEl.value && dateEl.value < base) dateEl.value = desired;

          ensureNotSundayOnDateInput(dateEl, { mode: "silent" });
          bindRegraDateEvents();
        }

        scheduleSimUpdate();
      });
    }

    // listeners sim
    if (form && !form.dataset.simBound) {
      form.dataset.simBound = "1";

      form.addEventListener("input", (e) => {
        const t = e.target;
        if (!t) return;
        const name = t.getAttribute("name") || "";
        const id = t.id || "";
        if (
          name === "valor_principal" ||
          name === "quantidade_parcelas" ||
          name === "porcentagem_juros" ||
          name === "tipo_vencimento" ||
          name === "regra_vencimento" ||
          name === "data_emprestimo" ||
          id === "tipoVencimentoNovoEmprestimo"
        ) scheduleSimUpdate();
      });

      form.addEventListener("change", (e) => {
        const t = e.target;
        if (!t) return;
        const name = t.getAttribute("name") || "";
        const id = t.id || "";
        if (
          name === "tipo_vencimento" ||
          name === "regra_vencimento" ||
          name === "data_emprestimo" ||
          id === "tipoVencimentoNovoEmprestimo"
        ) scheduleSimUpdate();
      });
    }

    // =========================
    // Autocomplete behavior
    // =========================
    function hideSuggest() {
      if (!suggestBox) return;
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
      acActiveIndex = -1;
    }

    function setClienteSelecionado(id, nome) {
      if (clienteHidden) clienteHidden.value = String(id || "");
      if (clienteInput) clienteInput.value = String(nome || "");
      hideSuggest();
    }

    function setLockedUI(isLocked) {
      if (!clienteInput || !clearBtn) return;
      clienteInput.disabled = !!isLocked;
      clearBtn.style.display = isLocked ? "" : "none";
      if (isLocked) clienteInput.dataset.locked = "1";
      else clienteInput.removeAttribute("data-locked");
    }

    function renderSuggest(query) {
      if (!suggestBox || !clienteInput) return;

      const q = normalizeTxt(query);
      if (!q) {
        hideSuggest();
        return;
      }

      const list = Array.isArray(clientesCache) ? clientesCache : [];
      const filtered = list.filter((c) => normalizeTxt(c.nome).includes(q));

      filtered.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );

      const limited = filtered.slice(0, 7);

      if (!limited.length) {
        suggestBox.innerHTML = `<div class="acitem">Nenhum cliente encontrado</div>`;
        suggestBox.hidden = false;
        acActiveIndex = -1;
        return;
      }

      suggestBox.innerHTML = limited.map((c, idx) => `
        <div class="acitem" role="option" data-idx="${idx}" data-id="${escHtml(c.id)}" data-nome="${escHtml(c.nome)}">
          ${highlightMatchAccentsSafe(c.nome, query)}
        </div>
      `).join("");

      suggestBox.hidden = false;
      acActiveIndex = -1;
    }

    function setActiveIndex(idx) {
      if (!suggestBox) return;
      const items = Array.from(suggestBox.querySelectorAll(".acitem"));
      items.forEach((i) => i.classList.remove("is-active"));

      if (idx < 0 || idx >= items.length) {
        acActiveIndex = -1;
        return;
      }

      acActiveIndex = idx;
      const el = items[idx];
      el.classList.add("is-active");
      el.scrollIntoView({ block: "nearest" });
    }

    if (suggestBox) {
      suggestBox.addEventListener("mousedown", (e) => {
        const item = e.target.closest(".acitem");
        if (!item) return;
        e.preventDefault();
        if (/Nenhum cliente/i.test(item.textContent || "")) return;

        const id = item.getAttribute("data-id") || "";
        const nome = item.getAttribute("data-nome") || item.textContent || "";
        if (id) setClienteSelecionado(id, nome);
      });

      suggestBox.addEventListener("mousemove", (e) => {
        const item = e.target.closest(".acitem");
        if (!item) return;
        const idx = Number(item.getAttribute("data-idx"));
        if (Number.isFinite(idx)) setActiveIndex(idx);
      });
    }

    if (clienteInput) {
      clienteInput.addEventListener("input", async () => {
        if (clienteHidden) clienteHidden.value = "";
        setLockedUI(false);
        await loadClientesCache();
        renderSuggest(clienteInput.value);
      });

      clienteInput.addEventListener("keydown", (e) => {
        if (!suggestBox || suggestBox.hidden) {
          if (e.key === "Enter") e.preventDefault();
          return;
        }

        const items = Array.from(suggestBox.querySelectorAll(".acitem"));
        const hasRealItems =
          items.length && !/Nenhum cliente/i.test(items[0].textContent || "");

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!hasRealItems) return;
          const next = acActiveIndex < 0 ? 0 : Math.min(items.length - 1, acActiveIndex + 1);
          setActiveIndex(next);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!hasRealItems) return;
          const prev = acActiveIndex <= 0 ? 0 : acActiveIndex - 1;
          setActiveIndex(prev);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (!hasRealItems) return;

          const idx = acActiveIndex >= 0 ? acActiveIndex : 0;
          const el = items[idx];

          const id = el.getAttribute("data-id") || "";
          const nome = el.getAttribute("data-nome") || el.textContent || "";
          if (id) setClienteSelecionado(id, nome);
        } else if (e.key === "Escape") {
          e.preventDefault();
          hideSuggest();
        }
      });

      clienteInput.addEventListener("blur", () => {
        setTimeout(hideSuggest, 120);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        if (clienteHidden) clienteHidden.value = "";
        if (clienteInput) {
          clienteInput.value = "";
          setLockedUI(false);
          clienteInput.focus();
        }
        await loadClientesCache();
        hideSuggest();
      });
    }

    // =========================
    // Submit
    // =========================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.dataset.loading = "1";
      }

      try {
        if (!clienteHidden || !clienteHidden.value) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError("Selecione um cliente (digite e escolha na lista).");
          return;
        }

        const tipo = String((modal.querySelector('select[name="tipo_vencimento"]')?.value) || "").toUpperCase();
        const base = modal.querySelector('input[name="data_emprestimo"]')?.value || "";
        const regraDateEl = modal.querySelector('input[name="regra_vencimento"][type="date"]');

        if ((tipo === "DIARIO" || tipo === "MENSAL") && regraDateEl) {
          // ✅ antes de enviar: garante sem domingo (sem alert duplicado)
          ensureNotSundayOnDateInput(regraDateEl, { mode: "silent" });

          const regraFinal = regraDateEl.value || "";
          if (base && regraFinal && regraFinal < base) {
            if (btnSubmit) btnSubmit.disabled = false;
            onError("O primeiro vencimento não pode ser menor que a data do empréstimo.");
            return;
          }
        }

        const fd = new FormData(form);

        const res = await fetch("/KRAx/public/api.php?route=emprestimos/criar", {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!json.ok) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError(json.mensagem || "Erro ao criar empréstimo");
          return;
        }

        GestorModal.close("modalNovoEmprestimo");
        form.reset();

        if (clienteHidden) clienteHidden.value = "";
        if (clienteInput) clienteInput.value = "";
        setLockedUI(false);
        hideSuggest();

        toast("Empréstimo criado!");
        window.location.href = "emprestimos.php";
      } catch (err) {
        console.error(err);
        if (btnSubmit) btnSubmit.disabled = false;
        onError("Erro de conexão com o servidor");
      }
    });

    // defaults
    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    renderRegraField();
    scheduleSimUpdate();
  }

  async function openNovoEmprestimo(payload = {}) {
    if (!document.getElementById("modalNovoEmprestimo")) {
      injectModalNovoEmprestimo();
    }

    const modal = document.getElementById("modalNovoEmprestimo");
    if (!modal) return;

    const btnSubmit = modal.querySelector("#btnSubmitNovoEmprestimo");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      delete btnSubmit.dataset.loading;
    }

    const clienteHidden = modal.querySelector("#clienteIdHidden");
    const clienteInput = modal.querySelector("#clienteSearchInput");
    const suggestBox = modal.querySelector("#clienteSuggestBox");
    const clearBtn = modal.querySelector("#clienteClearBtn");

    function setLockedUI(isLocked) {
      if (!clienteInput || !clearBtn) return;
      clienteInput.disabled = !!isLocked;
      clearBtn.style.display = isLocked ? "" : "none";
      if (isLocked) clienteInput.dataset.locked = "1";
      else clienteInput.removeAttribute("data-locked");
    }

    if (suggestBox) {
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
    }
    acActiveIndex = -1;

    await loadClientesCache();

    const clienteId = String(payload.clienteId || "");
    const clienteNome = String(payload.clienteNome || "");

    if (clienteId && clienteHidden && clienteInput) {
      clienteHidden.value = clienteId;
      clienteInput.value = clienteNome || `Cliente #${clienteId}`;
      setLockedUI(true);
    } else if (clienteHidden && clienteInput) {
      clienteHidden.value = "";
      clienteInput.value = "";
      setLockedUI(false);
    }

    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    const tipoSel = modal.querySelector("#tipoVencimentoNovoEmprestimo");
    if (tipoSel) {
      const ev = new Event("change", { bubbles: true });
      tipoSel.dispatchEvent(ev);
    }

    GestorModal.open("modalNovoEmprestimo");
  }

  window.injectModalNovoEmprestimo = injectModalNovoEmprestimo;
  window.openNovoEmprestimo = openNovoEmprestimo;
})();
