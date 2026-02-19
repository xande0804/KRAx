// public/assets/js/modals/detalhesEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const onSuccess = window.onSuccess || function () { };
  const toast = window.toast || null;
  const GestorModal = window.GestorModal;

  function notifyOk(msg) {
    if (typeof onSuccess === "function") return onSuccess(msg);
    if (toast && typeof toast.success === "function") return toast.success(msg);
    try { alert(msg); } catch (_) { }
  }

  function money(v) {
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v ?? "");
    return s.includes("R$") ? s : (s ? `R$ ${s}` : "—");
  }

  // pt-BR: "1.234,56" -> 1234.56
  function parseMoneyBR(str) {
    const s0 = String(str ?? "").trim();
    if (!s0) return 0;
    let s = s0.replace(/R\$\s?/g, "").replace(/\s+/g, "");
    s = s.replace(/[^0-9,.\-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // ✅ aceita número e string pt-BR
  function toNumber(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    const s = String(v).trim();
    if (!s) return 0;

    if (s.includes(",") || s.includes("R$") || /(\d)\.(\d{3})(\D|$)/.test(s)) return parseMoneyBR(s);
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function formatMoneyInputBR(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "0,00";
    return num.toFixed(2).replace(".", ",");
  }

  // centavos
  function toCents(v) {
    const n = toNumber(v);
    return Math.round(n * 100);
  }

  function moneyFromCents(cents) {
    const n = (Number(cents) || 0) / 100;
    return money(n);
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateBR(yyyyMMdd) {
    const s = String(yyyyMMdd || "");
    if (!s) return "—";
    const only = s.slice(0, 10);
    const [y, m, d] = only.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }

  function statusBadge(status) {
    const s = String(status || "").trim().toUpperCase();
    if (s === "QUITADO") return { text: "Quitado", cls: "badge--success" };
    if (s === "ATRASADO") return { text: "Atrasado", cls: "badge--danger" };
    return { text: "Ativo", cls: "badge--info" };
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function onlyDate(yyyyMMdd) {
    return String(yyyyMMdd || "").slice(0, 10);
  }

  function isBeforeISO(a, b) {
    const aa = onlyDate(a);
    const bb = onlyDate(b);
    if (!aa || !bb) return false;
    return aa < bb;
  }

  function isAfterISO(a, b) {
    const aa = onlyDate(a);
    const bb = onlyDate(b);
    if (!aa || !bb) return false;
    return aa > bb;
  }

  function getParcelaId(p) {
    return Number(p?.id ?? p?.parcela_id ?? 0) || 0;
  }

  // ✅ aceita "DD/MM/AAAA" ou "AAAA-MM-DD" e retorna "AAAA-MM-DD"
  function normalizeDateToISO(input) {
    const s = String(input ?? "").trim();
    if (!s) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    return "";
  }

  // ✅ monta mapa: parcela_id -> MAIOR data_pagamento (PARCELA)
  // + fallback de quitação: maior data_pagamento (QUITACAO/INTEGRAL) com parcela_id null
  function buildPagamentoMaps(pagamentos) {
    const mapParcelaMaxDate = new Map(); // parcelaId -> 'YYYY-MM-DD'
    let quitacaoFallbackDate = ""; // maior entre QUITACAO/INTEGRAL (parcela_id null)

    const arr = Array.isArray(pagamentos) ? pagamentos : [];
    for (const pg of arr) {
      const tipo = String(pg.tipo_pagamento || pg.tipo || "").trim().toUpperCase();
      const dt = onlyDate(pg.data_pagamento || pg.data || "");
      if (!dt) continue;

      const pid = Number(pg.parcela_id ?? pg.parcelaId ?? pg.parcela ?? 0) || 0;

      if (pid && tipo === "PARCELA") {
        const cur = mapParcelaMaxDate.get(pid) || "";
        if (!cur || dt > cur) mapParcelaMaxDate.set(pid, dt);
        continue;
      }

      // QUITACAO/INTEGRAL geralmente vem com parcela_id = null no seu backend
      if (!pid && (tipo === "QUITACAO" || tipo === "INTEGRAL")) {
        if (!quitacaoFallbackDate || dt > quitacaoFallbackDate) quitacaoFallbackDate = dt;
      }
    }

    return { mapParcelaMaxDate, quitacaoFallbackDate };
  }

  function calcSituacaoParcela(p, isQuitado, hojeStr, pgMaps) {
    const stp = String(p.status || p.parcela_status || "").trim().toUpperCase();
    const valorParcela = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
    const valorPago = toNumber(p.valor_pago ?? p.valorPago ?? 0);

    const vparC = toCents(valorParcela);
    const vpC = toCents(valorPago);

    const isPagaReal = isQuitado
      ? true
      : (stp === "PAGA" || stp === "QUITADA" || (vparC > 0 && vpC >= vparC));

    const isParcial = !isQuitado && !isPagaReal && vpC > 0 && vparC > 0 && vpC < vparC;

    const vencISO = onlyDate(p.data_vencimento ?? p.dataVencimento);
    const vencidaPorData = !isQuitado && vencISO && isBeforeISO(vencISO, hojeStr);

    const isAtrasadaReal = vencidaPorData && !isPagaReal;

    // ✅ PAGA (ATRASADA) = data_pagamento REAL > data_vencimento
    const pid = getParcelaId(p);

    let pagoEmISO = "";
    if (pgMaps && pgMaps.mapParcelaMaxDate && pid) {
      pagoEmISO = pgMaps.mapParcelaMaxDate.get(pid) || "";
    }

    // fallback: se foi quitado/integral e a parcela ficou QUITADA sem pagamento por parcela_id
    if (!pagoEmISO && pgMaps && pgMaps.quitacaoFallbackDate) {
      if (isPagaReal) pagoEmISO = pgMaps.quitacaoFallbackDate;
    }

    const isPagaAtrasada = !!(isPagaReal && vencISO && pagoEmISO && isAfterISO(pagoEmISO, vencISO));

    const restanteC = Math.max(0, vparC - vpC);

    return {
      stp,
      valorParcela,
      valorPago,
      isPagaReal,
      isParcial,
      isAtrasadaReal,
      isPagaAtrasada,
      vencISO,
      restanteC,
      pagoEmISO
    };
  }

  function getNextParcelaAberta(parcelas, isQuitado, hojeStr, pgMaps) {
    if (!Array.isArray(parcelas) || !parcelas.length) return null;
    const abertas = parcelas.filter(p => {
      const s = calcSituacaoParcela(p, isQuitado, hojeStr, pgMaps);
      return !s.isPagaReal && (s.isParcial || s.restanteC > 0);
    });
    if (!abertas.length) return null;
    abertas.sort((a, b) => Number(a.numero_parcela ?? a.numeroParcela ?? 0) - Number(b.numero_parcela ?? b.numeroParcela ?? 0));
    return abertas[0];
  }

  // ✅ mesma regra do modal "lançar pagamento"
  function calcQuitacaoNova(emp, parcelasArr, pagamentosArr) {
    const principal = toNumber(emp.valor_principal);
    const jurosPct = toNumber(emp.porcentagem_juros);
    const qtdTotal = Math.max(1, toNumber(emp.quantidade_parcelas || (Array.isArray(parcelasArr) ? parcelasArr.length : 1) || 1));
    const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();

    const jurosTotalContrato = principal * (jurosPct / 100);
    const totalComJuros =
      tipoV === "MENSAL"
        ? (principal + (jurosTotalContrato * qtdTotal))
        : (principal * (1 + jurosPct / 100));

    // DIÁRIO/SEMANAL: total c/juros - apenas parcelas pagas cheias
    if (tipoV === "DIARIO" || tipoV === "SEMANAL") {
      let totalParcelasPagasCheias = 0;
      const arr = Array.isArray(parcelasArr) ? parcelasArr : [];

      for (const p of arr) {
        const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
        const vpar = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
        const vp = toNumber(p.valor_pago ?? p.valorPago ?? 0);

        const pagaCheia = (st === "PAGA" || st === "QUITADA") || (vpar > 0 && vp >= vpar);
        if (pagaCheia && vpar > 0) totalParcelasPagasCheias += vpar;
      }

      return round2(Math.max(0, totalComJuros - totalParcelasPagasCheias));
    }

    // MENSAL: parcelas abertas + 1 juros (sua regra)
    let faltanteParcelas = 0;
    let qtdRestantes = 0;
    const abertas = Array.isArray(parcelasArr) ? parcelasArr : [];

    for (const p of abertas) {
      const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
      const vpar = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
      const vp = toNumber(p.valor_pago ?? p.valorPago ?? 0);

      const ehAberta =
        st === "ABERTA" || st === "PARCIAL" || st === "ATRASADA" || st === "ATRASADO" ||
        (vpar > 0 && vp < vpar);

      if (!ehAberta) continue;

      const falt = vpar - vp;
      if (falt > 0) {
        faltanteParcelas += falt;
        qtdRestantes++;
      }
    }

    if (qtdRestantes <= 0 || faltanteParcelas <= 0) return 0;

    const jurosUnit = jurosTotalContrato;
    let totalQuit = faltanteParcelas - ((qtdRestantes - 1) * jurosUnit);
    if (totalQuit < 0) totalQuit = 0;

    return round2(totalQuit);
  }

  function getCtxFromModal(modal) {
    return {
      origem: modal?.dataset?.origem || "emprestimos",
      clienteId: modal?.dataset?.clienteId || ""
    };
  }

  // ✅ editar pagamento:
  // - se tipo PARCELA: faz "substituição" (exclui + lança novo) pra manter rateio do restante
  // - senão: tenta rota pagamentos/atualizar (se existir)
  async function editarPagamentoUI(pg, emprestimoId, modal, tipoVencimento) {
    const pgId = String(pg?.id ?? pg?.pagamento_id ?? "").trim();
    if (!pgId) return onError("Pagamento sem ID (não dá pra editar).");

    const tipoPg = String(pg.tipo_pagamento || pg.tipo || "").trim().toUpperCase();
    const parcelaId = Number(pg.parcela_id ?? pg.parcelaId ?? pg.parcela ?? 0) || 0;

    const valorAtual = toNumber(pg.valor_pago ?? pg.valor ?? 0);
    const dataAtualISO = onlyDate(pg.data_pagamento || pg.data || todayISO());
    const dataAtualBR = formatDateBR(dataAtualISO);
    const obsAtual = String(pg.observacao || "").trim();

    const novoValorStr = prompt("Novo valor do pagamento (ex: 100,00):", formatMoneyInputBR(valorAtual));
    if (novoValorStr === null) return;
    const novoValor = toNumber(novoValorStr);
    if (!(novoValor > 0)) return onError("Valor inválido.");

    const novaDataStr = prompt("Nova data do pagamento (DD/MM/AAAA ou AAAA-MM-DD):", dataAtualBR);
    if (novaDataStr === null) return;
    if (String(novaDataStr).trim() === "") return;

    const novaDataISO = normalizeDateToISO(novaDataStr);
    if (!novaDataISO) return onError("Data inválida. Use DD/MM/AAAA ou AAAA-MM-DD.");

    const novaObs = prompt("Observação (opcional):", obsAtual);
    if (novaObs === null) return;

    // ✅ Se é PARCELA, usa o mesmo comportamento do lançamento (rateio do resto)
    if (tipoPg === "PARCELA") {
      if (!parcelaId) {
        onError("Esse pagamento é PARCELA mas não tem parcela_id. Não dá pra refazer rateio.");
        return;
      }

      try {
        // 1) excluir antigo
        {
          const fdDel = new FormData();
          fdDel.append("pagamento_id", pgId);

          const rDel = await fetch("/KRAx/public/api.php?route=pagamentos/excluir", {
            method: "POST",
            body: fdDel,
            headers: { "Accept": "application/json" }
          });

          const jDel = await rDel.json().catch(() => null);
          if (!jDel || !jDel.ok) {
            onError((jDel && (jDel.mensagem || jDel.error)) || "Erro ao excluir pagamento antigo (pra refazer rateio).");
            return;
          }
        }

        // 2) lançar novo (o backend vai jogar o restante pra próxima)
        {
          const fd = new FormData();
          fd.append("emprestimo_id", String(emprestimoId));
          fd.append("parcela_id", String(parcelaId));
          fd.append("tipo_pagamento", "PARCELA");
          fd.append("valor_pago", formatMoneyInputBR(novoValor));
          fd.append("data_pagamento", novaDataISO);
          fd.append("observacao", String(novaObs || "").trim());

          const r = await fetch("/KRAx/public/api.php?route=pagamentos/lancar", {
            method: "POST",
            body: fd,
            headers: { "Accept": "application/json" }
          });

          const j = await r.json().catch(() => null);
          if (!j || !j.ok) {
            onError((j && (j.mensagem || j.error)) || "Erro ao lançar novo pagamento (rateio).");
            return;
          }
        }

        notifyOk("Pagamento editado ✅ (com rateio automático)");
        const ctx = getCtxFromModal(modal);
        window.openDetalhesEmprestimo(emprestimoId, ctx);
        return;

      } catch (e) {
        console.error(e);
        onError("Erro de rede ao editar com rateio.");
        return;
      }
    }

    // ✅ Outros tipos: tenta atualizar direto (se você tiver essa rota)
    try {
      const fd = new FormData();
      fd.append("pagamento_id", pgId);
      fd.append("tipo_pagamento", tipoPg || "");
      if (tipoPg === "PARCELA" && parcelaId) fd.append("parcela_id", String(parcelaId));
      fd.append("valor_pago", formatMoneyInputBR(novoValor));
      fd.append("data_pagamento", novaDataISO);
      fd.append("observacao", String(novaObs || "").trim());

      const r = await fetch("/KRAx/public/api.php?route=pagamentos/atualizar", {
        method: "POST",
        body: fd,
        headers: { "Accept": "application/json" }
      });

      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        return onError((j && (j.mensagem || j.error)) || "Erro ao atualizar pagamento.");
      }

      notifyOk("Pagamento atualizado ✅");
      const ctx = getCtxFromModal(modal);
      window.openDetalhesEmprestimo(emprestimoId, ctx);
    } catch (e) {
      console.error(e);
      onError("Erro de rede ao atualizar pagamento.");
    }
  }

  async function excluirPagamentoUI(pg, emprestimoId, modal) {
    const pgId = String(pg?.id ?? pg?.pagamento_id ?? "").trim();
    if (!pgId) return onError("Pagamento sem ID (não dá pra excluir).");

    const tipoRaw = String(pg.tipo_pagamento || pg.tipo || "Pagamento").trim().toUpperCase();
    const data = formatDateBR(pg.data_pagamento || pg.data);
    const val = money(pg.valor_pago || pg.valor);

    const ok = confirm(`Excluir este pagamento?\n\nTipo: ${tipoRaw}\nData: ${data}\nValor: ${val}`);
    if (!ok) return;

    try {
      const fd = new FormData();
      fd.append("pagamento_id", pgId);

      const r = await fetch("/KRAx/public/api.php?route=pagamentos/excluir", {
        method: "POST",
        body: fd,
        headers: { "Accept": "application/json" }
      });

      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        return onError((j && (j.mensagem || j.error)) || "Erro ao excluir pagamento.");
      }

      notifyOk("Pagamento excluído ✅");
      const ctx = getCtxFromModal(modal);
      window.openDetalhesEmprestimo(emprestimoId, ctx);
    } catch (e) {
      console.error(e);
      onError("Erro de rede ao excluir pagamento.");
    }
  }

  async function excluirEmprestimoUI(emprestimoId, modal, clienteNome) {
    const id = String(emprestimoId || "").trim();
    if (!id) return onError("emprestimoId vazio (não dá pra excluir).");

    const ok = confirm(
      `Excluir este empréstimo?\n\n` +
      `Cliente: ${clienteNome || "—"}\n` +
      `Só é permitido se NÃO houver pagamentos.`
    );
    if (!ok) return;

    const btn = modal?.querySelector?.("#btnDeleteLoanBottom");
    if (btn) btn.disabled = true;

    try {
      const fd = new FormData();
      fd.append("emprestimo_id", id);

      const r = await fetch("/KRAx/public/api.php?route=emprestimos/excluir", {
        method: "POST",
        body: fd,
        headers: { "Accept": "application/json" }
      });

      const j = await r.json().catch(() => null);

      if (btn) btn.disabled = false;

      if (!j || !j.ok) {
        return onError((j && (j.mensagem || j.error)) || "Erro ao excluir empréstimo.");
      }

      notifyOk(j.mensagem || "Empréstimo excluído ✅");
      GestorModal.close("modalDetalhesEmprestimo");

      // refresh conforme origem
      const origemSalva = modal?.dataset?.origem || "emprestimos";
      const clienteIdSalvo = modal?.dataset?.clienteId || "";

      if (origemSalva === "cliente" && clienteIdSalvo && typeof window.openDetalhesCliente === "function") {
        window.openDetalhesCliente(clienteIdSalvo);
        if (typeof window.refreshClientesList === "function") window.refreshClientesList();
      } else {
        if (typeof window.refreshEmprestimosList === "function") window.refreshEmprestimosList();
        if (typeof window.refreshClientesList === "function") window.refreshClientesList();
      }
    } catch (e) {
      console.error(e);
      if (btn) btn.disabled = false;
      onError("Erro de rede ao excluir empréstimo.");
    }
  }

  // ========= INJECT =========
  window.injectModalDetalhesEmprestimo = function injectModalDetalhesEmprestimo() {
    if (qs("#modalDetalhesEmprestimo")) return;

    if (typeof window.injectModalEditarEmprestimo === "function") {
      window.injectModalEditarEmprestimo();
    }

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalDetalhesEmprestimo";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog modal__dialog--xl">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Detalhes do empréstimo</h3>
            <p class="modal__subtitle">Informações completas do empréstimo.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalDetalhesEmprestimo">×</button>
        </header>

        <div class="modal__body">
          <div class="loan-head">
            <div class="loan-head__icon">👤</div>
            <div>
              <p class="loan-head__name" data-loan="cliente_nome">Cliente</p>
              <p class="loan-head__sub" data-loan="cliente_tel">—</p>
            </div>
          </div>

          <div class="loan-kpis">
            <div class="kpi">
              <div class="kpi__label">Valor do empréstimo</div>
              <div class="kpi__value" data-loan="valor">—</div>
              <div class="kpi__hint" data-loan="prestacao_hint">Prestação: —</div>
            </div>

            <div class="kpi">
              <div class="kpi__label" data-loan="juros_label">Total com juros</div>
              <div class="kpi__value" data-loan="total_juros">—</div>
              <div class="kpi__hint" data-loan="saldo_hint">Pago: — • Falta: —</div>
            </div>

            <div class="kpi">
              <div class="kpi__label">Parcelas</div>
              <div class="kpi__value" data-loan="parcelas">—</div>
            </div>

            <div class="kpi">
              <div class="kpi__label">Vencimento</div>
              <div class="kpi__value" data-loan="tipo_venc">—</div>
            </div>
          </div>

          <div class="loan-status">
            Status:
            <span class="badge badge--info" data-loan="status">Ativo</span>
            <span>•</span>
            <span>Criado em <strong data-loan="criado_em">—</strong></span>
          </div>

          <div class="loan-actions-row">
            <button class="btn btn--primary" type="button" data-modal-open="lancarPagamento" id="btnPayFromLoan">
              💳 Lançar pagamento
            </button>

            <button class="btn btn--secondary" type="button" id="btnEditLoan">
              ✏️ Editar empréstimo
            </button>

            <button class="btn btn--secondary" type="button" id="btnMarkQuitado">
              Marcar como quitado
            </button>
          </div>

          <div class="hr"></div>

          <div class="modal-section">
            <h4 class="modal-section__title">Prestações</h4>
            <div class="installments">
              <div class="installments__scroll" id="installmentsList"></div>
            </div>
          </div>

          <div class="modal-section">
            <h4 class="modal-section__title">Histórico de pagamentos</h4>
            <div class="pay-history" id="payHistoryList"></div>
          </div>

          <!-- ✅ BOTÃO EXCLUIR NO FINAL (embaixo de tudo) -->
          <div class="hr"></div>
          <div class="modal-section">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <h4 class="modal-section__title" style="margin:0;">Ações avançadas</h4>

              <button class="btn btn--danger" type="button" id="btnDeleteLoanBottom">
                🗑️ Excluir empréstimo
              </button>
            </div>

            <div class="muted" style="margin-top:8px;">
              Só permitido se não houver pagamentos lançados.
            </div>
          </div>


        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // ========= OPEN =========
  window.openDetalhesEmprestimo = async function openDetalhesEmprestimo(emprestimoId, ctx) {
    const modal = document.getElementById("modalDetalhesEmprestimo");
    if (!modal) return;

    const id = String(emprestimoId || "");
    if (!id) return;

    modal.dataset.emprestimoId = id;

    const origem = (ctx && ctx.origem) ? String(ctx.origem) : "emprestimos";
    const clienteIdCtx = (ctx && ctx.clienteId) ? String(ctx.clienteId) : "";
    modal.dataset.origem = origem;
    modal.dataset.clienteId = clienteIdCtx;

    const set = (field, value) => {
      const el = modal.querySelector(`[data-loan="${field}"]`);
      if (el) el.textContent = value ?? "—";
    };

    // loading
    set("cliente_nome", "Carregando...");
    set("cliente_tel", "—");
    set("valor", "—");
    set("prestacao_hint", "Prestação: —");
    set("juros_label", "Total com juros");
    set("total_juros", "—");
    set("saldo_hint", "Pago: — • Falta: —");
    set("parcelas", "—");
    set("tipo_venc", "—");
    set("status", "—");
    set("criado_em", "—");

    const installments = modal.querySelector("#installmentsList");
    const payHist = modal.querySelector("#payHistoryList");
    if (installments) installments.innerHTML = `<div class="muted" style="padding:10px;">Carregando prestações...</div>`;
    if (payHist) payHist.innerHTML = `<div class="muted" style="padding:10px;">Carregando pagamentos...</div>`;

    // botão excluir (final)
    const btnDeleteLoanBottom = modal.querySelector("#btnDeleteLoanBottom");
    if (btnDeleteLoanBottom) {
      btnDeleteLoanBottom.disabled = false;
      btnDeleteLoanBottom.style.display = ""; // default, depois ajusta pelo status
      btnDeleteLoanBottom.onclick = null; // limpa
    }

    try {
      const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(id)}`);
      const json = await res.json();

      if (!json.ok) {
        onError(json.mensagem || "Erro ao buscar empréstimo");
        return;
      }

      const dados = json.dados || {};
      const emp = dados.emprestimo || {};
      const cli = dados.cliente || {};
      const parcelas = Array.isArray(dados.parcelas) ? dados.parcelas : [];
      const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];

      const pgMaps = buildPagamentoMaps(pagamentos);
      const hojeStr = todayISO();

      const statusAtual = String(emp.status || "").trim().toUpperCase();
      const isQuitado = statusAtual === "QUITADO";

      set("cliente_nome", cli.nome || "—");
      set("cliente_tel", cli.telefone || "—");

      const principal = toNumber(emp.valor_principal ?? 0);
      const principalC = toCents(principal);

      const jurosPct = toNumber(emp.porcentagem_juros ?? 0);
      const totalParcelas = Number(emp.quantidade_parcelas ?? parcelas.length ?? 0) || 1;

      const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();
      const tipoTxt = tipoV === "DIARIO" ? "Diário" : tipoV === "SEMANAL" ? "Semanal" : "Mensal";
      set("tipo_venc", tipoTxt);

      // total/parcelas em centavos
      let valorPrestacaoC = 0;
      let totalComJurosC = 0;

      if (tipoV === "MENSAL") {
        const jurosInteiro = principal * (jurosPct / 100);
        const totalComJuros = principal + (jurosInteiro * totalParcelas);
        totalComJurosC = toCents(totalComJuros);

        const prestacao = (principal / totalParcelas) + jurosInteiro;
        valorPrestacaoC = toCents(prestacao);
      } else {
        const totalComJuros = principal * (1 + jurosPct / 100);
        totalComJurosC = toCents(totalComJuros);
        valorPrestacaoC = Math.round(totalComJurosC / totalParcelas);
      }

      // ✅ SETA OS KPIs
      set("valor", moneyFromCents(principalC));
      set("prestacao_hint", `Prestação: ${moneyFromCents(valorPrestacaoC)}`);
      set("juros_label", `Total com juros (${jurosPct || 0}%)`);
      set("total_juros", moneyFromCents(totalComJurosC));

      // ✅ SINCRONIZA "Pago/Falta"
      const quitNova = calcQuitacaoNova(emp, parcelas, pagamentos);
      let faltaC = toCents(quitNova);

      let pagoC = totalComJurosC - faltaC;
      if (pagoC < 0) pagoC = 0;

      if (isQuitado) {
        faltaC = 0;
        pagoC = totalComJurosC;
      }

      if (faltaC <= 1) faltaC = 0;
      if (pagoC <= 1) pagoC = 0;

      set("saldo_hint", `Pago: ${moneyFromCents(pagoC)} • Falta: ${moneyFromCents(faltaC)}`);

      // parcelas pagas
      let pagas = 0;
      if (isQuitado) pagas = totalParcelas;
      else pagas = parcelas.filter((p) => calcSituacaoParcela(p, false, hojeStr, pgMaps).isPagaReal).length;
      set("parcelas", `${pagas} / ${totalParcelas || 0}`);

      const st = statusBadge(emp.status);
      const statusEl = modal.querySelector(`[data-loan="status"]`);
      if (statusEl) {
        statusEl.textContent = st.text;
        statusEl.classList.remove("badge--info", "badge--success", "badge--danger");
        statusEl.classList.add(st.cls);
      }

      set("criado_em", formatDateBR(emp.data_emprestimo || emp.criado_em || emp.created_at));

      const btnPay = modal.querySelector("#btnPayFromLoan");
      const btnQuit = modal.querySelector("#btnMarkQuitado");
      const btnEdit = modal.querySelector("#btnEditLoan");

      if (isQuitado) {
        if (btnPay) btnPay.style.display = "none";
        if (btnQuit) btnQuit.style.display = "none";
        if (btnEdit) btnEdit.style.display = "none";
        // normalmente quitado já tem pagamento, mas deixo escondido pra não poluir
        if (btnDeleteLoanBottom) btnDeleteLoanBottom.style.display = "none";
      } else {
        if (btnPay) btnPay.style.display = "";
        if (btnQuit) btnQuit.style.display = "";
        if (btnEdit) btnEdit.style.display = "";
        if (btnDeleteLoanBottom) btnDeleteLoanBottom.style.display = "";
      }

      // handler do botão excluir (final)
      if (btnDeleteLoanBottom && !isQuitado) {
        btnDeleteLoanBottom.onclick = () => excluirEmprestimoUI(id, modal, cli.nome || "");
      }

      const nextAberta = getNextParcelaAberta(parcelas, isQuitado, hojeStr, pgMaps);
      const nextParcelaId = nextAberta ? String(nextAberta.id ?? nextAberta.parcela_id ?? "") : "";
      const nextVencISO = nextAberta ? onlyDate(nextAberta.data_vencimento ?? nextAberta.dataVencimento) : "";

      if (btnPay) {
        btnPay.dataset.emprestimoId = id;
        btnPay.dataset.clienteNome = cli.nome || "";
        btnPay.dataset.emprestimoInfo = `${moneyFromCents(principalC)} - ${pagas}/${totalParcelas} parcelas`;
        btnPay.dataset.tipoPadrao = "PARCELA";

        btnPay.dataset.parcelaId = nextParcelaId;
        btnPay.dataset.dataPadrao = nextVencISO || "";

        btnPay.dataset.origem = modal.dataset.origem || "emprestimos";
        btnPay.dataset.clienteId = modal.dataset.clienteId || String(emp.cliente_id || "");

        btnPay.dataset.returnTo = "detalhesEmprestimo";
        btnPay.dataset.returnEmprestimoId = id;
        btnPay.dataset.returnClienteId = btnPay.dataset.clienteId || "";
      }

      if (btnEdit) {
        btnEdit.onclick = () => {
          if (typeof window.openEditarEmprestimo !== "function") {
            onError("Modal de edição não carregado. Verifique se editarEmprestimo.modal.js está incluído.");
            return;
          }

          window.openEditarEmprestimo({
            emprestimoId: id,
            clienteId: String(emp.cliente_id || modal.dataset.clienteId || ""),
            clienteNome: String(cli.nome || ""),
            jurosPct: jurosPct,
            quantidadeParcelas: totalParcelas,
            tipoVencimento: tipoV,
            origem: modal.dataset.origem || "emprestimos",
          });
        };
      }

      if (btnQuit) {
        btnQuit.disabled = isQuitado;

        btnQuit.onclick = async () => {
          if (btnQuit.disabled) return;

          const ok = confirm(`Confirmar quitação total deste empréstimo?\nValor: ${money(quitNova)}`);
          if (!ok) return;

          btnQuit.disabled = true;

          try {
            const fd = new FormData();
            fd.append("emprestimo_id", id);
            fd.append("tipo_pagamento", "QUITACAO");
            fd.append("valor_pago", formatMoneyInputBR(quitNova));

            const obs = (tipoV === "DIARIO" || tipoV === "SEMANAL")
              ? "Quitação = total c/juros − apenas parcelas pagas (juros pagos não abatem)"
              : "Quitação (parcelas restantes + 1 juros)";

            fd.append("observacao", obs);

            const r = await fetch("/KRAx/public/api.php?route=pagamentos/lancar", {
              method: "POST",
              body: fd,
              headers: { "Accept": "application/json" }
            });
            const j = await r.json();

            if (!j.ok) {
              btnQuit.disabled = false;
              onError(j.mensagem || "Erro ao quitar empréstimo");
              return;
            }

            GestorModal.close("modalDetalhesEmprestimo");

            const origemSalva = modal.dataset.origem || "emprestimos";
            const clienteIdSalvo = modal.dataset.clienteId || "";

            if (origemSalva === "cliente" && clienteIdSalvo && typeof window.openDetalhesCliente === "function") {
              window.openDetalhesCliente(clienteIdSalvo);
              if (typeof window.refreshClientesList === "function") window.refreshClientesList();
            } else {
              if (typeof window.refreshEmprestimosList === "function") window.refreshEmprestimosList();
              if (typeof window.refreshClientesList === "function") window.refreshClientesList();
            }
          } catch (e) {
            console.error(e);
            btnQuit.disabled = false;
            onError("Erro de rede ao quitar empréstimo.");
          }
        };
      }

      // lista de prestações
      if (installments) {
        if (!parcelas.length) {
          installments.innerHTML = `<div class="muted" style="padding:10px;">Nenhuma prestação encontrada.</div>`;
        } else {
          installments.innerHTML = parcelas.map((p) => {
            const num = p.numero_parcela ?? p.numeroParcela ?? p.num ?? "—";
            const vencISO = onlyDate(p.data_vencimento ?? p.dataVencimento);
            const vencBR = formatDateBR(vencISO);

            const s = calcSituacaoParcela(p, isQuitado, hojeStr, pgMaps);

            let valTxt = "—";
            if (s.isParcial) {
              valTxt = moneyFromCents(s.restanteC);
            } else {
              const valorParcela = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
              valTxt = valorParcela > 0 ? money(valorParcela) : moneyFromCents(valorPrestacaoC);
            }

            const dotCls = s.isPagaReal ? "inst-dot--ok" : s.isParcial ? "inst-dot--warn" : s.isAtrasadaReal ? "inst-dot--danger" : "";

            let badge = "";
            if (isQuitado) badge = `<span class="badge badge--success" style="margin-left:10px;">Paga</span>`;
            else if (s.isAtrasadaReal) badge = `<span class="badge badge--danger" style="margin-left:10px;">Atrasada</span>`;
            else if (s.isPagaReal && s.isPagaAtrasada) badge = `<span class="badge badge--success" style="margin-left:10px; background:#0f766e; border-color:#0f766e; color:#fff;">Paga (atrasada)</span>`;
            else if (s.isPagaReal) badge = `<span class="badge badge--success" style="margin-left:10px;">Paga</span>`;
            else if (s.isParcial) badge = `<span class="badge badge--info" style="margin-left:10px;">Parcial</span>`;

            const subLinha = (!isQuitado && s.isParcial) ? `<span class="muted" style="margin-left:10px;">Restante após adiantamento</span>` : ``;

            const rowStyle = s.isAtrasadaReal ? `style="border-left:4px solid #ef4444; padding-left:10px;"` : ``;
            const vencStyle = s.isAtrasadaReal ? `style="color:#ef4444; font-weight:600;"` : ``;

            return `
              <div class="installment-row" ${rowStyle}>
                <div class="inst-left">
                  <span class="inst-dot ${dotCls}"></span>
                  <span class="inst-title">Prestação ${esc(num)}</span>
                  ${badge}
                  ${subLinha}
                </div>
                <div class="inst-right">
                  <span ${vencStyle}>${esc(vencBR)}</span>
                  <span class="inst-value">${esc(valTxt)}</span>
                </div>
              </div>
            `;
          }).join("");
        }
      }

      // histórico pagamentos (✅ com editar/excluir)
      if (payHist) {
        if (!pagamentos.length) {
          payHist.innerHTML = `<div class="muted" style="padding:10px;">Nenhum pagamento registrado.</div>`;
        } else {
          payHist.innerHTML = pagamentos.map((pg) => {
            const tipoRaw = String(pg.tipo_pagamento || pg.tipo || "Pagamento").trim().toUpperCase();

            let title =
              tipoRaw === "PARCELA" ? "Prestação" :
                tipoRaw === "JUROS" ? "Juros" :
                  tipoRaw === "INTEGRAL" ? "Pagamento integral" :
                    tipoRaw === "EXTRA" ? "Crédito/extra" :
                      tipoRaw;

            let sub = String(pg.observacao || "").trim();

            if (tipoRaw === "QUITACAO") {
              title = "PAGAMENTO";
              sub = (tipoV === "DIARIO" || tipoV === "SEMANAL")
                ? "Quitação = total c/juros − apenas parcelas pagas (juros pagos não abatem)"
                : "Quitação (parcelas restantes + 1 juros)";
            }

            const data = formatDateBR(pg.data_pagamento || pg.data);
            const val = money(pg.valor_pago || pg.valor);

            const pgId = String(pg?.id ?? pg?.pagamento_id ?? "").trim();
            const canAct = !!pgId;

            return `
              <div class="pay-row" data-pagamento-id="${esc(pgId)}">
                <div class="pay-left">
                  <div class="pay-title">${esc(title)}</div>
                  ${sub ? `<div class="pay-sub">${esc(sub)}</div>` : ``}
                </div>
                <div class="pay-right" style="display:flex; align-items:center; gap:10px;">
                  <span>${esc(data)}</span>
                  <span class="pay-value">${esc(val)}</span>
                  ${canAct ? `
                    <button class="iconbtn" type="button" data-pay-edit title="Editar pagamento" style="width:34px; height:34px; border-radius:10px;">✏️</button>
                    <button class="iconbtn" type="button" data-pay-del title="Excluir pagamento" style="width:34px; height:34px; border-radius:10px;">🗑️</button>
                  ` : ``}
                </div>
              </div>
            `;
          }).join("");

          payHist.onclick = async (ev) => {
            const btnEdit = ev.target?.closest?.("[data-pay-edit]");
            const btnDel = ev.target?.closest?.("[data-pay-del]");
            if (!btnEdit && !btnDel) return;

            ev.preventDefault();
            ev.stopPropagation();

            const row = ev.target.closest(".pay-row");
            const pgId = row ? String(row.getAttribute("data-pagamento-id") || "").trim() : "";
            if (!pgId) return onError("Não consegui achar o ID do pagamento nessa linha.");

            const pg = pagamentos.find(x => String(x?.id ?? x?.pagamento_id ?? "") === pgId) || null;
            if (!pg) return onError("Pagamento não encontrado na lista. Reabra o modal.");

            if (btnEdit) await editarPagamentoUI(pg, id, modal, tipoV);
            else await excluirPagamentoUI(pg, id, modal);
          };
        }
      }

      GestorModal.open("modalDetalhesEmprestimo");
    } catch (err) {
      console.error(err);
      onError("Erro de rede ao buscar detalhes do empréstimo.");
    }
  };
})();
