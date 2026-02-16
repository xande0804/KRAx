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
    const targetMonth = dt.getMonth() + Number(months || 0);
    // preserva dia o máximo possível
    dt.setMonth(targetMonth);
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

    // JS: 0=Dom,1=Seg...6=Sáb. Nós queremos 1..6 (Seg..Sáb).
    const target = wd; // 1..6
    let dt = new Date(start.getTime());
    for (let i = 0; i < 14; i++) {
      const jsDay = dt.getDay(); // 0..6
      if (jsDay === target) {
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      }
      dt.setDate(dt.getDate() + 1);
    }
    return "";
  }

  function tipoLabel(tipo) {
    const t = String(tipo || "").toUpperCase();
    if (t === "SEMANAL") return "Semanal";
    if (t === "MENSAL") return "Mensal";
    return "Diário";
  }

  // =========================
  // Autocomplete state/cache
  // =========================
  let clientesCache = null; // [{id:"", nome:""}, ...]
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
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .trim();
  }

  // ✅ Highlight 100% correto ignorando acentos:
  // cria uma string normalizada + um mapa de posições (cada char normalizado aponta pro índice no original)
  function buildNormalizedMap(original) {
    const src = String(original ?? "");
    let norm = "";
    const map = []; // map[normIndex] = originalIndex

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      // NFD separa diacríticos; removemos diacríticos; pode virar 0..N chars
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
    const endOrig = map[idx + q.length - 1] + 1; // +1 pra cortar corretamente

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

      // ordenação alfabética pt-BR (ignorando acentos)
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
          <div class="form-grid">

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

            <!-- ✅ SIMULAÇÃO (fica na área que você destacou ao lado do Juros) -->
            <div class="field form-span-2" style="margin-top:-2px;">
              <div class="simcard" id="simCardNovoEmprestimo">
                <div class="simcard__title">Simulação</div>

                <div class="simgrid">
                  <div class="simitem">
                    <div class="simlabel">Tipo</div>
                    <div class="simvalue" id="simTipo">—</div>
                  </div>
                  <div class="simitem">
                    <div class="simlabel">Parcelas</div>
                    <div class="simvalue" id="simParcelas">—</div>
                  </div>

                  <div class="simitem">
                    <div class="simlabel">Juros (R$)</div>
                    <div class="simvalue" id="simJurosValor">—</div>
                  </div>
                  <div class="simitem">
                    <div class="simlabel">Total com juros</div>
                    <div class="simvalue" id="simTotal">—</div>
                  </div>

                  <div class="simitem simitem--span2">
                    <div class="simlabel">Parcela estimada</div>
                    <div class="simvalue simvalue--big" id="simParcela">—</div>
                  </div>

                  <div class="simitem">
                    <div class="simlabel">1º venc.</div>
                    <div class="simvalue" id="simPrimeiroVenc">—</div>
                  </div>
                  <div class="simitem">
                    <div class="simlabel">Último venc.</div>
                    <div class="simvalue" id="simUltimoVenc">—</div>
                  </div>
                </div>

                <div class="simhint" id="simHint">Preencha valor, juros, parcelas e tipo.</div>
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
            <div class="field form-span-2" id="wrapRegraVencimento">
              <label id="labelRegraVencimento">Primeiro vencimento</label>
              <input type="date" name="regra_vencimento" required id="regraVencimentoInput" />
              <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
            </div>

          </div>

          <!-- ✅ Footer com resumo à esquerda (área inferior que você destacou) -->
          <footer class="modal__footer" style="display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div class="simfooter" id="simFooterNovoEmprestimo">
              <div class="simfooter__line">
                <span class="simfooter__k">Total:</span>
                <span class="simfooter__v" id="simFooterTotal">—</span>
                <span class="simfooter__sep">•</span>
                <span class="simfooter__k">Parcela:</span>
                <span class="simfooter__v" id="simFooterParcela">—</span>
              </div>
              <div class="simfooter__sub" id="simFooterSub">—</div>
            </div>

            <div class="modal__footer__actions" style="display:flex; gap:10px; align-items:center; justify-content:flex-end;">
              <button class="btn" type="button" data-modal-close="modalNovoEmprestimo">Cancelar</button>
              <button class="btn btn--primary" type="submit" id="btnSubmitNovoEmprestimo">Salvar empréstimo</button>
            </div>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // =========================
    // CSS mínimo pro "X" + Simulação (inline safe)
    // =========================
    const styleId = "novoEmprestimoSimStyle";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
        /* botão X do cliente */
        #modalNovoEmprestimo #clienteClearBtn{ position:absolute; right:10px; top:50%; transform:translateY(-50%);
          width:28px; height:28px; border-radius:999px; border:1px solid #e6e8ef; background:#fff;
          cursor:pointer; line-height:26px; font-size:18px; padding:0; }

        /* Simulação */
        #modalNovoEmprestimo .simcard{
          border: 1px solid #e6e8ef;
          background: #fff;
          border-radius: 14px;
          padding: 12px 12px;
          box-shadow: 0 1px 0 rgba(0,0,0,.02);
        }
        #modalNovoEmprestimo .simcard__title{
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 10px;
          letter-spacing: .2px;
        }
        #modalNovoEmprestimo .simgrid{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 12px;
          align-items: start;
        }
        #modalNovoEmprestimo .simitem{
          padding: 10px 10px;
          border-radius: 12px;
          background: #f7f8fb;
          border: 1px solid #eef0f6;
        }
        #modalNovoEmprestimo .simitem--span2{ grid-column: 1 / -1; }
        #modalNovoEmprestimo .simlabel{
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        #modalNovoEmprestimo .simvalue{
          font-weight: 700;
          font-size: 14px;
          color: #111827;
        }
        #modalNovoEmprestimo .simvalue--big{
          font-size: 18px;
          letter-spacing: .2px;
        }
        #modalNovoEmprestimo .simhint{
          margin-top: 10px;
          font-size: 12px;
          color: #6b7280;
        }

        /* Footer resumo */
        #modalNovoEmprestimo .simfooter{
          min-width: 240px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        #modalNovoEmprestimo .simfooter__line{
          display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;
          font-size: 13px;
        }
        #modalNovoEmprestimo .simfooter__k{ color:#6b7280; }
        #modalNovoEmprestimo .simfooter__v{ font-weight:800; color:#111827; }
        #modalNovoEmprestimo .simfooter__sep{ color:#c4c7d2; margin:0 2px; }
        #modalNovoEmprestimo .simfooter__sub{ font-size:12px; color:#6b7280; }
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

    // =========================
    // Simulação (estado + update)
    // =========================
    const simEls = {
      tipo: modal.querySelector("#simTipo"),
      parcelas: modal.querySelector("#simParcelas"),
      jurosValor: modal.querySelector("#simJurosValor"),
      total: modal.querySelector("#simTotal"),
      parcela: modal.querySelector("#simParcela"),
      primeiro: modal.querySelector("#simPrimeiroVenc"),
      ultimo: modal.querySelector("#simUltimoVenc"),
      hint: modal.querySelector("#simHint"),
      fTotal: modal.querySelector("#simFooterTotal"),
      fParcela: modal.querySelector("#simFooterParcela"),
      fSub: modal.querySelector("#simFooterSub"),
    };

    function getRegraInfoAtual() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
      if (tipo === "SEMANAL") {
        const sel = modal.querySelector('select[name="regra_vencimento"]');
        return { tipo, regra: sel ? String(sel.value || "") : "" };
      }
      const inp = modal.querySelector('input[name="regra_vencimento"][type="date"]');
      return { tipo, regra: inp ? String(inp.value || "") : "" };
    }

    function calcSimulacao() {
      const principal = parseMoneyBR(modal.querySelector('input[name="valor_principal"]')?.value);
      const qtd = Math.max(1, toNumber(modal.querySelector('input[name="quantidade_parcelas"]')?.value));
      const jurosPct = Math.max(0, toNumber(modal.querySelector('input[name="porcentagem_juros"]')?.value));
      const baseData = modal.querySelector('input[name="data_emprestimo"]')?.value || todayISO();
      const { tipo, regra } = getRegraInfoAtual();

      // cálculo simples (simulação visual):
      const jurosValor = principal * (jurosPct / 100);
      const total = principal + jurosValor;
      const parcela = qtd > 0 ? (total / qtd) : total;

      // vencimentos estimados
      let primeiroISO = "";
      if (tipo === "SEMANAL") {
        // regra: 1..6 (Seg..Sáb). Hint do sistema fala "mínimo 7 dias"
        primeiroISO = nextWeekdayISO(baseData, regra, 7);
      } else {
        primeiroISO = String(regra || "");
        if (primeiroISO && baseData && primeiroISO < baseData) {
          primeiroISO = baseData;
        }
        if (!primeiroISO) primeiroISO = baseData;
      }

      let ultimoISO = "";
      if (primeiroISO) {
        if (tipo === "DIARIO") ultimoISO = addDaysISO(primeiroISO, qtd - 1);
        else if (tipo === "MENSAL") ultimoISO = addMonthsISO(primeiroISO, qtd - 1);
        else if (tipo === "SEMANAL") ultimoISO = addDaysISO(primeiroISO, 7 * (qtd - 1));
      }

      return {
        principal,
        qtd,
        jurosPct,
        jurosValor,
        total,
        parcela,
        tipo,
        baseData,
        primeiroISO,
        ultimoISO
      };
    }

    function updateSimUI() {
      const s = calcSimulacao();

      if (simEls.tipo) simEls.tipo.textContent = tipoLabel(s.tipo);
      if (simEls.parcelas) simEls.parcelas.textContent = `${s.qtd}x`;
      if (simEls.jurosValor) simEls.jurosValor.textContent = moneyBR(s.jurosValor);
      if (simEls.total) simEls.total.textContent = moneyBR(s.total);
      if (simEls.parcela) simEls.parcela.textContent = moneyBR(s.parcela);

      if (simEls.primeiro) simEls.primeiro.textContent = s.primeiroISO ? fmtDateBR(s.primeiroISO) : "—";
      if (simEls.ultimo) simEls.ultimo.textContent = s.ultimoISO ? fmtDateBR(s.ultimoISO) : "—";

      if (simEls.fTotal) simEls.fTotal.textContent = moneyBR(s.total);
      if (simEls.fParcela) simEls.fParcela.textContent = moneyBR(s.parcela);

      const pronto = s.principal > 0 && s.qtd >= 1;
      const sub = pronto
        ? `Base: ${moneyBR(s.principal)} • Juros: ${s.jurosPct.toLocaleString("pt-BR")}%
           • ${tipoLabel(s.tipo)} • 1º: ${s.primeiroISO ? fmtDateBR(s.primeiroISO) : "—"}`
            .replace(/\s+/g, " ")
            .trim()
        : "Preencha valor, juros, parcelas e tipo para ver a simulação.";

      if (simEls.fSub) simEls.fSub.textContent = sub;
      if (simEls.hint) simEls.hint.textContent = pronto
        ? "Valores estimados (simulação visual). O cálculo final segue a regra do sistema."
        : "Preencha valor, juros, parcelas e tipo.";
    }

    // Debounce simples (pra não recalcular 300x digitando)
    let simRAF = 0;
    function scheduleSimUpdate() {
      if (simRAF) cancelAnimationFrame(simRAF);
      simRAF = requestAnimationFrame(() => {
        simRAF = 0;
        updateSimUI();
      });
    }

    // listeners únicos via delegação (pegam campos re-renderizados)
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
        ) {
          scheduleSimUpdate();
        }
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
        ) {
          scheduleSimUpdate();
        }
      });
    }

    // =========================
    // Regra vencimento dinâmica
    // =========================
    function renderRegraField() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
      if (!wrapRegra) return;

      wrapRegra.innerHTML = `
        <label id="labelRegraVencimento"></label>
        <div id="regraFieldSlot"></div>
        <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
      `;

      const label = wrapRegra.querySelector("#labelRegraVencimento");
      const slot = wrapRegra.querySelector("#regraFieldSlot");
      const hint = wrapRegra.querySelector("#hintRegraVencimento");

      const baseDate = (inputDataEmp && inputDataEmp.value) ? inputDataEmp.value : todayISO();

      function hintSet(t) { if (hint) hint.textContent = t || ""; }

      if (tipo === "SEMANAL") {
        if (label) label.textContent = "Dia da semana";
        if (slot) {
          slot.innerHTML = `
            <select name="regra_vencimento" required id="regraVencimentoSelect">
              <option value="1">Segunda</option>
              <option value="2">Terça</option>
              <option value="3">Quarta</option>
              <option value="4">Quinta</option>
              <option value="5">Sexta</option>
              <option value="6">Sábado</option>
            </select>
          `;
        }
        hintSet("Primeira prestação será no mínimo daqui 7 dias e cairá no dia selecionado (sem domingo).");
      } else {
        if (label) label.textContent = "Primeiro vencimento";
        if (slot) {
          slot.innerHTML = `<input type="date" name="regra_vencimento" required id="regraVencimentoDate" />`;
        }

        const dateEl = wrapRegra.querySelector("#regraVencimentoDate");
        if (dateEl) {
          dateEl.value = baseDate;
          dateEl.min = baseDate;
        }

        hintSet(tipo === "MENSAL"
          ? "Escolha a data do primeiro vencimento. As próximas parcelas serão mês a mês."
          : "Escolha a data do primeiro vencimento. As próximas parcelas serão dia a dia."
        );
      }

      // sempre que re-renderiza, atualiza simulação
      scheduleSimUpdate();
    }

    if (tipoSel) tipoSel.addEventListener("change", renderRegraField);

    if (inputDataEmp) {
      inputDataEmp.addEventListener("change", () => {
        const dateEl = modal.querySelector("#regraVencimentoDate");
        if (dateEl) {
          const base = inputDataEmp.value || todayISO();
          dateEl.min = base;
          if (!dateEl.value || dateEl.value < base) dateEl.value = base;
        }
        scheduleSimUpdate();
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

      // ordem alfabética
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

    // clique / hover na sugestão
    if (suggestBox) {
      suggestBox.addEventListener("mousedown", (e) => {
        const item = e.target.closest(".acitem");
        if (!item) return;
        e.preventDefault(); // evita blur antes de selecionar

        // ignora "Nenhum cliente encontrado"
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

    // digitação
    if (clienteInput) {
      clienteInput.addEventListener("input", async () => {
        // se o usuário começou a digitar manualmente, limpa seleção anterior
        if (clienteHidden) clienteHidden.value = "";
        setLockedUI(false);

        await loadClientesCache();
        renderSuggest(clienteInput.value);
      });

      clienteInput.addEventListener("keydown", (e) => {
        if (!suggestBox || suggestBox.hidden) {
          // Enter sem dropdown: não envia, força escolher
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

      // blur fecha (delay p/ clique)
      clienteInput.addEventListener("blur", () => {
        setTimeout(hideSuggest, 120);
      });
    }

    // ✅ botão X pra destravar e trocar cliente
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        if (clienteHidden) clienteHidden.value = "";
        if (clienteInput) {
          clienteInput.value = "";
          setLockedUI(false);
          clienteInput.focus();
        }
        await loadClientesCache();
        hideSuggest(); // só aparece quando digitar
      });
    }

    // =========================
    // Submit
    // =========================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // evita duplo clique
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.dataset.loading = "1";
      }

      try {
        // ✅ valida cliente selecionado
        if (!clienteHidden || !clienteHidden.value) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError("Selecione um cliente (digite e escolha na lista).");
          return;
        }

        // validação extra: se for date, garante >= data_emprestimo
        const tipo = String((modal.querySelector('select[name="tipo_vencimento"]')?.value) || "").toUpperCase();
        const base = modal.querySelector('input[name="data_emprestimo"]')?.value || "";
        const regraDate = modal.querySelector('input[name="regra_vencimento"][type="date"]')?.value || "";

        if ((tipo === "DIARIO" || tipo === "MENSAL") && base && regraDate && regraDate < base) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError("O primeiro vencimento não pode ser menor que a data do empréstimo.");
          return;
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

        // limpa cliente UI
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

    // defaults iniciais
    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    renderRegraField();
    scheduleSimUpdate(); // ✅ já mostra simulação (mesmo que vazia)
  }

  // ✅ PADRÃO CERTO: recebe payload { clienteId, clienteNome }
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

    // carrega cache (melhora UX na primeira busca)
    await loadClientesCache();

    const clienteId = String(payload.clienteId || "");
    const clienteNome = String(payload.clienteNome || "");

    if (clienteId && clienteHidden && clienteInput) {
      clienteHidden.value = clienteId;
      clienteInput.value = clienteNome || `Cliente #${clienteId}`;
      setLockedUI(true); // ✅ travado e com X pra destravar
    } else if (clienteHidden && clienteInput) {
      clienteHidden.value = "";
      clienteInput.value = "";
      setLockedUI(false);
    }

    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    // re-render (pra ajustar min/default do vencimento)
    const tipoSel = modal.querySelector('#tipoVencimentoNovoEmprestimo');
    if (tipoSel) {
      const ev = new Event('change', { bubbles: true });
      tipoSel.dispatchEvent(ev);
    }

    // atualiza simulação ao abrir
    const form = modal.querySelector("#formNovoEmprestimo");
    if (form) {
      const ev2 = new Event("input", { bubbles: true });
      form.dispatchEvent(ev2);
    }

    GestorModal.open("modalNovoEmprestimo");
  }

  window.injectModalNovoEmprestimo = injectModalNovoEmprestimo;
  window.openNovoEmprestimo = openNovoEmprestimo;
})();
