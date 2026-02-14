// public/assets/js/modals/lancamentoPagamento.modal.js
(function () {
  const qs = window.qs;
  const onSuccess = window.onSuccess || function () { };
  const onError = window.onError || function () { };
  const GestorModal = window.GestorModal;

  function money(v) {
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v ?? "");
    return s.includes("R$") ? s : (s ? `R$ ${s}` : "—");
  }

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  // ✅ pt-BR: "1.234,56" -> 1234.56
  function parseMoneyBR(str) {
    const s0 = String(str ?? "").trim();
    if (!s0) return 0;
    let s = s0.replace(/R\$\s?/g, "").replace(/\s+/g, "");
    s = s.replace(/[^0-9,.\-]/g, "");
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoneyInputBR(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "";
    return num.toFixed(2).replace(".", ",");
  }

  function calcValoresEmprestimo(emp, pagamentos) {
    const principal = toNumber(emp.valor_principal);
    const jurosPct = toNumber(emp.porcentagem_juros);
    const qtd = Math.max(1, toNumber(emp.quantidade_parcelas));
    const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();

    let prestacao = 0;
    let totalComJuros = 0;
    let jurosPrestacao = 0;

    if (tipoV === "MENSAL") {
      const jurosInteiro = principal * (jurosPct / 100);
      prestacao = (principal / qtd) + jurosInteiro;
      totalComJuros = prestacao * qtd;
      jurosPrestacao = jurosInteiro;
    } else {
      totalComJuros = principal * (1 + jurosPct / 100);
      prestacao = totalComJuros / qtd;
      jurosPrestacao = (principal * (jurosPct / 100)) / qtd;
    }

    const totalPago = Array.isArray(pagamentos)
      ? pagamentos.reduce((acc, pg) => acc + toNumber(pg.valor_pago || pg.valor), 0)
      : 0;

    const saldoQuitacao = Math.max(0, totalComJuros - totalPago);

    return { principal, jurosPct, qtd, tipoV, prestacao, totalComJuros, jurosPrestacao, totalPago, saldoQuitacao };
  }

  // ✅ NOVO: calcula sugestão de QUITAÇÃO pela regra (parcelas restantes + 1 juros)
  function calcQuitacaoNova(emp, parcelasArr, pagamentosArr) {
  const principal = toNumber(emp.valor_principal);
  const jurosPct = toNumber(emp.porcentagem_juros);
  const qtdTotal = Math.max(1, Number(emp.quantidade_parcelas || parcelasArr.length || 1) || 1);
  const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();

  // total pago (vem do histórico de pagamentos)
  const totalPago = Array.isArray(pagamentosArr)
    ? pagamentosArr.reduce((acc, pg) => acc + toNumber(pg.valor_pago || pg.valor), 0)
    : 0;

  const jurosTotalContrato = principal * (jurosPct / 100);

  // total com juros do contrato
  const totalComJuros =
    tipoV === "MENSAL"
      ? (principal + (jurosTotalContrato * qtdTotal))
      : (principal * (1 + jurosPct / 100));

  // ✅ NOVA REGRA:
  // DIÁRIO e SEMANAL → quitação = saldo atual (total com juros - já pago)
  if (tipoV === "DIARIO" || tipoV === "SEMANAL") {
    const saldo = Math.max(0, totalComJuros - totalPago);
    return round2(saldo);
  }

  // ✅ MENSAL → parcelas restantes + 1 juros (regra que você definiu)
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

  const jurosUnit = jurosTotalContrato; // mensal: juros por prestação (fixo)

  // Quitação = saldoParcelasAbertas - (qtdRestantes - 1) * jurosUnit
  let totalQuit = faltanteParcelas - ((qtdRestantes - 1) * jurosUnit);
  if (totalQuit < 0) totalQuit = 0;

  return round2(totalQuit);
}


  function closeAnyOpenModal() {
    document.querySelectorAll(".modal").forEach((m) => {
      const isHidden = m.getAttribute("aria-hidden");
      if (isHidden === "false") {
        const id = m.id;
        if (id && GestorModal && typeof GestorModal.close === "function") {
          GestorModal.close(id);
        }
      }
    });
  }

  async function safeReadJson(res) {
    const text = await res.text();

    try {
      return { ok: true, json: JSON.parse(text), raw: text };
    } catch (e) {
      console.error("❌ Resposta NÃO é JSON. Conteúdo completo abaixo:");
      console.error(text);

      const snippet = String(text || "")
        .replace(/\s+/g, " ")
        .slice(0, 180);

      return { ok: false, error: e, raw: text, snippet };
    }
  }

  function injectModalLancamentoPagamento() {
    if (qs("#modalLancarPagamento")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalLancarPagamento";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Lançar pagamento</h3>
            <p class="modal__subtitle">Registre o pagamento recebido.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalLancarPagamento">×</button>
        </header>

        <form class="modal__body" id="formLancarPagamento" method="post">
          <input type="hidden" name="emprestimo_id" data-pay="emprestimo_id" />
          <input type="hidden" name="parcela_id" data-pay="parcela_id" />

          <div class="form-grid">
            <div class="field form-span-2">
              <label>Cliente</label>
              <input name="cliente_nome" data-pay="cliente_nome" readonly value="—" />
            </div>

            <div class="field form-span-2">
              <label>Empréstimo</label>
              <div class="emprestimo-resumo" data-pay="emprestimo_info">—</div>
            </div>

            <div class="field form-span-2">
              <label>Tipo de pagamento</label>
              <select name="tipo_pagamento" data-pay="tipo_pagamento" required>
                <option value="PARCELA">Prestação</option>
                <option value="JUROS">Apenas juros</option>
                <option value="QUITACAO">Quitação</option>
                <option value="EXTRA">Valor parcial</option>
              </select>
              <div class="muted" style="margin-top:6px;" data-pay="hint"></div>
            </div>

            <div class="field">
              <label>Valor pago (R$)</label>
              <input name="valor_pago" data-pay="valor_pago" inputmode="decimal" placeholder="0,00" required />
            </div>

            <div class="field">
              <label>Data do pagamento</label>
              <input name="data_pagamento" data-pay="data_pagamento" type="date" required />
            </div>

            <div class="field form-span-2">
              <label>Observação (opcional)</label>
              <textarea name="observacao" data-pay="observacao" rows="4" placeholder="Alguma anotação..."></textarea>
            </div>
          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalLancarPagamento">Cancelar</button>
            <button class="btn btn--primary" type="submit">Confirmar pagamento</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const setPay = (field, value) => {
      const el = modal.querySelector(`[data-pay="${field}"]`);
      if (!el) return;

      const tag = (el.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        el.value = value ?? "";
      } else {
        el.innerHTML = value ?? "";
      }
    };

    const setHint = (text) => {
      const el = modal.querySelector(`[data-pay="hint"]`);
      if (el) el.textContent = text || "";
    };

    function afterSuccessReturnFlow() {
      const returnTo = String(modal.dataset.returnTo || "").trim();
      const returnEmprestimoId = String(modal.dataset.returnEmprestimoId || modal.dataset.emprestimoId || "").trim();
      const returnClienteId = String(modal.dataset.returnClienteId || modal.dataset.clienteId || "").trim();

      const origem = String(modal.dataset.origem || "").trim();

      if (returnTo === "detalhesEmprestimo" && returnEmprestimoId && typeof window.openDetalhesEmprestimo === "function") {
        window.openDetalhesEmprestimo(returnEmprestimoId, {
          origem: origem || "emprestimos",
          clienteId: returnClienteId || ""
        });
        return;
      }

      if ((returnTo === "detalhesCliente" || origem === "cliente") && returnClienteId && typeof window.openDetalhesCliente === "function") {
        window.openDetalhesCliente(returnClienteId);
        return;
      }

      let refreshed = false;
      if (typeof window.refreshEmprestimosList === "function") {
        window.refreshEmprestimosList();
        refreshed = true;
      }
      if (typeof window.refreshClientesList === "function") {
        window.refreshClientesList();
        refreshed = true;
      }
      if (refreshed) return;

      window.location.reload();
    }

    const form = qs("#formLancarPagamento");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const tipoSel = modal.querySelector(`[data-pay="tipo_pagamento"]`);
        const tipo = String(tipoSel ? tipoSel.value : "").toUpperCase();

        const emprestimoId = modal.querySelector(`[data-pay="emprestimo_id"]`)?.value || "";
        if (!emprestimoId) {
          onError("emprestimo_id está vazio. Não dá pra lançar pagamento.");
          return;
        }

        const parcelaHidden = modal.querySelector(`[data-pay="parcela_id"]`);
        if (parcelaHidden) {
          if (tipo === "PARCELA") {
            if (!parcelaHidden.value && modal.dataset.defaultParcelaId) {
              parcelaHidden.value = modal.dataset.defaultParcelaId;
            }
          } else {
            // mantém vazio (seu backend já trata tipo != PARCELA)
            parcelaHidden.value = "";
          }
        }

        const fd = new FormData(form);

        const res = await fetch("/KRAx/public/api.php?route=pagamentos/lancar", {
          method: "POST",
          body: fd,
          headers: { "Accept": "application/json" }
        });

        const parsed = await safeReadJson(res);

        if (!parsed.ok) {
          onError(`Servidor retornou resposta inválida (não-JSON). Veja o console. ${parsed.snippet ? "Trecho: " + parsed.snippet : ""}`);
          return;
        }

        const json = parsed.json;

        if (!json.ok) {
          onError(json.mensagem || "Erro ao lançar pagamento");
          return;
        }

        GestorModal.close("modalLancarPagamento");
        onSuccess("Pagamento lançado!");

        setTimeout(() => {
          afterSuccessReturnFlow();
        }, 120);

      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });

    modal._setPay = setPay;
    modal._setHint = setHint;
  }

  function openLancarPagamento(openEl) {
    const modal = document.getElementById("modalLancarPagamento");
    if (!modal) return;

    closeAnyOpenModal();

    const setPay = modal._setPay || function () { };
    const setHint = modal._setHint || function () { };

    const valorInput = modal.querySelector(`[data-pay="valor_pago"]`);
    const tipoSelect = modal.querySelector(`[data-pay="tipo_pagamento"]`);
    const dataPagamentoInput = modal.querySelector(`[data-pay="data_pagamento"]`);

    const emprestimoId = openEl.dataset.emprestimoId || "";
    const parcelaId = openEl.dataset.parcelaId || "";

    const origem = openEl.dataset.origem || "";
    modal.dataset.origem = origem || "";
    modal.dataset.emprestimoId = emprestimoId || "";
    modal.dataset.clienteId = openEl.dataset.clienteId || "";

    modal.dataset.returnTo = openEl.dataset.returnTo || "";
    modal.dataset.returnEmprestimoId = openEl.dataset.returnEmprestimoId || emprestimoId || "";
    modal.dataset.returnClienteId = openEl.dataset.returnClienteId || modal.dataset.clienteId || "";

    modal.dataset.defaultParcelaId = parcelaId || "";

    setPay("cliente_nome", openEl.dataset.clienteNome || "—");
    setPay("emprestimo_id", emprestimoId);
    setPay("parcela_id", parcelaId);

    if (openEl.dataset.tipoPadrao) setPay("tipo_pagamento", openEl.dataset.tipoPadrao);

    const today = new Date().toISOString().slice(0, 10);
    const dataBase = openEl.dataset.dataPadrao || today;
    setPay("data_pagamento", dataBase);

    // guarda data base (pra fallback)
    modal.dataset.dataBasePagamento = dataBase;

    setPay("emprestimo_info", "Carregando...");

    async function hydrateValores() {
      if (!emprestimoId) {
        setPay("emprestimo_info", openEl.dataset.emprestimoInfo || "—");
        if (openEl.dataset.valorPadrao) setPay("valor_pago", openEl.dataset.valorPadrao);
        setHint("");
        GestorModal.open("modalLancarPagamento");
        return;
      }

      try {
        const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(emprestimoId)}`);
        const parsed = await safeReadJson(res);

        if (!parsed.ok) {
          onError(`Resposta inválida do servidor ao buscar empréstimo. Veja o console. ${parsed.snippet ? "Trecho: " + parsed.snippet : ""}`);
          GestorModal.open("modalLancarPagamento");
          return;
        }

        const json = parsed.json;

        if (!json.ok) {
          onError(json.mensagem || "Erro ao buscar empréstimo");
          GestorModal.open("modalLancarPagamento");
          return;
        }

        const dados = json.dados || {};
        const emp = dados.emprestimo || {};
        const cli = dados.cliente || {};
        const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];
        const parcelasArr = Array.isArray(dados.parcelas) ? dados.parcelas : [];

        if (cli.nome) setPay("cliente_nome", cli.nome);

        const qtdTotal = Math.max(1, Number(emp.quantidade_parcelas || parcelasArr.length || 1) || 1);

        const pagas = parcelasArr.filter((p) => {
          const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
          const valorPago = Number(p.valor_pago ?? 0);
          return st === "PAGA" || st === "QUITADA" || valorPago > 0;
        }).length;

        const c = calcValoresEmprestimo(emp, pagamentos);

        const semJuros = money(emp.valor_principal);
        const comJuros = money(c.totalComJuros);

        const infoCompleto = `
          <div><strong>Principal:</strong> ${semJuros}</div>
          <div><strong>Total c/ juros:</strong> ${comJuros}</div>
          <div><strong>Parcelas:</strong> ${pagas}/${qtdTotal}</div>
        `;

        setPay("emprestimo_info", infoCompleto);

        // valores teóricos
        modal.dataset.prestacao = String(c.prestacao);
        modal.dataset.jurosPrestacao = String(c.jurosPrestacao);
        modal.dataset.saldoQuitacao = String(c.saldoQuitacao);

        // sugestão de quitação
        const quitNova = calcQuitacaoNova(emp, parcelasArr, pagamentos);
        modal.dataset.quitacaoNova = String(quitNova);

        function getParcelaById(id) {
          const pid = Number(id || 0);
          if (!pid) return null;
          return parcelasArr.find((p) => Number(p.id) === pid || Number(p.parcela_id) === pid) || null;
        }

        function isParcelaAberta(p) {
          const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
          const vp = toNumber(p.valor_pago ?? 0);
          const vpar = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
          if (st === "ABERTA" || st === "PARCIAL" || st === "ATRASADA" || st === "ATRASADO") return true;
          if (vpar > 0 && vp < vpar) return true;
          return false;
        }

        function nextParcelaAberta() {
          const abertas = parcelasArr.filter(isParcelaAberta);
          if (!abertas.length) return null;
          abertas.sort((a, b) => Number(a.numero_parcela ?? a.numeroParcela ?? 0) - Number(b.numero_parcela ?? b.numeroParcela ?? 0));
          return abertas[0];
        }

        function parcelaRestante(p) {
          if (!p) return 0;
          const vpar = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
          const vp = toNumber(p.valor_pago ?? 0);
          const falt = vpar - vp;
          return falt > 0 ? falt : 0;
        }

        function parcelaVencimentoYMD(p) {
          if (!p) return "";
          const dv = String(p.data_vencimento ?? p.dataVencimento ?? "").trim();
          return dv ? dv.slice(0, 10) : "";
        }

        // ✅ escolhe a "parcela alvo" para sincronizar a data (serve pra TODOS os tipos)
        function getParcelaAlvoParaData() {
          const pidPreferida = String(modal.dataset.defaultParcelaId || "").trim();
          if (pidPreferida) {
            const found = getParcelaById(pidPreferida);
            if (found) return found;
          }
          return nextParcelaAberta();
        }

        function syncDataPagamentoComVencimento(parcelaAlvo) {
          if (!dataPagamentoInput) return;
          const dv = parcelaVencimentoYMD(parcelaAlvo);
          if (dv) {
            dataPagamentoInput.value = dv;
            return;
          }
          // fallback
          dataPagamentoInput.value =
            String(modal.dataset.dataBasePagamento || "").trim() ||
            new Date().toISOString().slice(0, 10);
        }

        function applyTipo(tipo) {
          const t = String(tipo || "").toUpperCase();
          const prest = toNumber(modal.dataset.prestacao);
          const juros = toNumber(modal.dataset.jurosPrestacao);
          const saldo = toNumber(modal.dataset.saldoQuitacao);
          const quitNovaNum = toNumber(modal.dataset.quitacaoNova);

          if (valorInput) {
            valorInput.required = true;
            valorInput.readOnly = false;
          }

          const parcelaHidden = modal.querySelector(`[data-pay="parcela_id"]`);
          if (parcelaHidden) {
            if (t === "PARCELA") {
              if (!parcelaHidden.value && modal.dataset.defaultParcelaId) {
                parcelaHidden.value = modal.dataset.defaultParcelaId;
              }
              if (!parcelaHidden.value) {
                const nx = nextParcelaAberta();
                const nxId = nx ? String(nx.id ?? nx.parcela_id ?? "") : "";
                if (nxId) parcelaHidden.value = nxId;
              }
            } else {
              parcelaHidden.value = "";
            }
          }

          // ✅ parcela alvo para data (vale para todos os tipos)
          const parcelaAlvoData = getParcelaAlvoParaData();

          if (t === "PARCELA") {
            let alvo = null;

            const pid = parcelaHidden ? parcelaHidden.value : "";
            if (pid) alvo = getParcelaById(pid);

            if (!alvo) alvo = nextParcelaAberta();

            const sugestao = alvo ? parcelaRestante(alvo) : prest;

            setPay("valor_pago", formatMoneyInputBR(sugestao));
            setHint(`Prestação sugerida: ${money(sugestao)}${alvo ? ` (parcela ${alvo.numero_parcela ?? alvo.numeroParcela ?? "?"})` : ""}`);

            // ✅ data = vencimento da parcela alvo (a mesma do cálculo)
            syncDataPagamentoComVencimento(alvo);

          } else if (t === "JUROS") {
            setPay("valor_pago", formatMoneyInputBR(juros));
            setHint(`Juros desta prestação: ${money(juros)}`);

            // ✅ data = vencimento da parcela alvo
            syncDataPagamentoComVencimento(parcelaAlvoData);

          } else if (t === "QUITACAO") {
            setPay("valor_pago", formatMoneyInputBR(quitNovaNum));
            setHint(`Quitação (parcelas restantes + 1 juros)`);
            if (valorInput) valorInput.readOnly = true;

            // ✅ data = vencimento da parcela alvo
            syncDataPagamentoComVencimento(parcelaAlvoData);

          } else if (t === "INTEGRAL") {
            setPay("valor_pago", formatMoneyInputBR(saldo));
            setHint(`Pagamento integral (saldo estimado): ${money(saldo)}`);
            if (valorInput) valorInput.readOnly = true;

            // ✅ data = vencimento da parcela alvo
            syncDataPagamentoComVencimento(parcelaAlvoData);

          } else if (t === "EXTRA") {
            setPay("valor_pago", "");
            setHint(`Valor parcial (preencha manualmente).`);

            // ✅ data = vencimento da parcela alvo
            syncDataPagamentoComVencimento(parcelaAlvoData);

          } else {
            setPay("valor_pago", "");
            setHint("");

            // ✅ data = vencimento da parcela alvo
            syncDataPagamentoComVencimento(parcelaAlvoData);
          }
        }

        applyTipo(tipoSelect ? tipoSelect.value : "PARCELA");

        if (tipoSelect) {
          tipoSelect.onchange = () => applyTipo(tipoSelect.value);
        }

        GestorModal.open("modalLancarPagamento");
      } catch (e) {
        console.error(e);
        onError("Erro de rede ao buscar empréstimo.");
        GestorModal.open("modalLancarPagamento");
      }
    }

    hydrateValores();
  }

  window.injectModalLancamentoPagamento = injectModalLancamentoPagamento;
  window.openLancarPagamento = openLancarPagamento;
})();
