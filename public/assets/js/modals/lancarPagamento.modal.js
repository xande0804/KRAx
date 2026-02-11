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
              <input name="emprestimo_info" data-pay="emprestimo_info" readonly value="—" />
            </div>

            <div class="field form-span-2">
              <label>Tipo de pagamento</label>
              <select name="tipo_pagamento" data-pay="tipo_pagamento" required>
                <option value="PARCELA">Prestação</option>
                <option value="JUROS">Apenas juros</option>
                <option value="QUITACAO">Quitação (total)</option>
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

        // ✅ regra do parcela_id:
        // - PARCELA: mantém se tiver (ex: vencimentos), se não tiver deixa vazio (backend distribui).
        // - JUROS / QUITACAO / EXTRA: sempre limpa parcela_id.
        const parcelaHidden = modal.querySelector(`[data-pay="parcela_id"]`);
        if (parcelaHidden) {
          if (tipo === "PARCELA") {
            // se tiver um default guardado e o campo estiver vazio, aplica
            if (!parcelaHidden.value && modal.dataset.defaultParcelaId) {
              parcelaHidden.value = modal.dataset.defaultParcelaId;
            }
          } else {
            parcelaHidden.value = "";
          }
        }

        const fd = new FormData(form);

        const res = await fetch("/KRAx/public/api.php?route=pagamentos/lancar", {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao lançar pagamento");
          return;
        }

        GestorModal.close("modalLancarPagamento");
        form.reset();

        // ✅ refresh inteligente
        const origem = modal.dataset.origem || "";
        const empId = modal.dataset.emprestimoId || "";
        const clienteId = modal.dataset.clienteId || "";

        if (origem === "detalhesEmprestimo" && empId && typeof window.openDetalhesEmprestimo === "function") {
          window.openDetalhesEmprestimo(empId, { origem: "emprestimos", clienteId });
        } else if (origem === "detalhesCliente" && clienteId && typeof window.openDetalhesCliente === "function") {
          window.openDetalhesCliente(clienteId);
        } else {
          // vencimentos / listas (se tiver funções)
          if (typeof window.refreshVencimentos === "function") window.refreshVencimentos();
          if (typeof window.refreshEmprestimosList === "function") window.refreshEmprestimosList();
          if (typeof window.refreshClientesList === "function") window.refreshClientesList();

          // fallback
          if (!window.refreshVencimentos && !window.refreshEmprestimosList && !window.refreshClientesList) {
            window.location.reload();
          }
        }

        onSuccess("Pagamento lançado!");
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });
  }

  function openLancarPagamento(openEl) {
    const modal = document.getElementById("modalLancarPagamento");
    if (!modal) return;

    closeAnyOpenModal();

    const setPay = (field, value) => {
      const el = modal.querySelector(`[data-pay="${field}"]`);
      if (!el) return;
      el.value = value ?? "";
    };

    const setHint = (text) => {
      const el = modal.querySelector(`[data-pay="hint"]`);
      if (el) el.textContent = text || "";
    };

    const valorInput = modal.querySelector(`[data-pay="valor_pago"]`);
    const tipoSelect = modal.querySelector(`[data-pay="tipo_pagamento"]`);

    // dados do botão
    const emprestimoId = openEl.dataset.emprestimoId || "";
    const parcelaId = openEl.dataset.parcelaId || "";

    // ✅ salva contexto p/ refresh pós-pagamento
    // (detalhesEmprestimo deve mandar data-origem e data-cliente-id / vencimentos não precisa)
    const origem = openEl.dataset.origem || "";
    modal.dataset.origem = origem === "cliente" ? "detalhesCliente" : (origem ? "detalhesEmprestimo" : "");
    modal.dataset.emprestimoId = emprestimoId || "";
    modal.dataset.clienteId = openEl.dataset.clienteId || "";

    // ✅ parcela default: se veio do vencimentos, guarda. se não veio, fica vazio.
    modal.dataset.defaultParcelaId = parcelaId || "";

    setPay("cliente_nome", openEl.dataset.clienteNome || "—");
    setPay("emprestimo_info", openEl.dataset.emprestimoInfo || "—");
    setPay("emprestimo_id", emprestimoId);
    setPay("parcela_id", parcelaId); // pode ser vazio

    if (openEl.dataset.tipoPadrao) setPay("tipo_pagamento", openEl.dataset.tipoPadrao);

    const today = new Date().toISOString().slice(0, 10);
    setPay("data_pagamento", openEl.dataset.dataPadrao || today);

    async function hydrateValores() {
      // fallback sem emprestimoId
      if (!emprestimoId) {
        if (openEl.dataset.valorPadrao) setPay("valor_pago", openEl.dataset.valorPadrao);
        setHint("");
        GestorModal.open("modalLancarPagamento");
        return;
      }

      try {
        const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(emprestimoId)}`);
        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao buscar empréstimo");
          GestorModal.open("modalLancarPagamento");
          return;
        }

        const dados = json.dados || {};
        const emp = dados.emprestimo || {};
        const cli = dados.cliente || {};
        const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];

        if (cli.nome) setPay("cliente_nome", cli.nome);

        const info = `${money(emp.valor_principal)} • ${emp.quantidade_parcelas || "—"} prestações`;
        setPay("emprestimo_info", openEl.dataset.emprestimoInfo || info);

        const c = calcValoresEmprestimo(emp, pagamentos);

        modal.dataset.prestacao = String(c.prestacao);
        modal.dataset.jurosPrestacao = String(c.jurosPrestacao);
        modal.dataset.saldoQuitacao = String(c.saldoQuitacao);

        function applyTipo(tipo) {
          const t = String(tipo || "").toUpperCase();
          const prest = toNumber(modal.dataset.prestacao);
          const juros = toNumber(modal.dataset.jurosPrestacao);
          const saldo = toNumber(modal.dataset.saldoQuitacao);

          if (valorInput) {
            valorInput.required = true;
            valorInput.readOnly = false;
          }

          // ✅ parcela_id: só faz sentido em PARCELA (quando veio da tela de vencimentos)
          const parcelaHidden = modal.querySelector(`[data-pay="parcela_id"]`);
          if (parcelaHidden) {
            if (t === "PARCELA") {
              // mantém se tiver; se não tiver, deixa vazio (backend distribui automaticamente)
              if (!parcelaHidden.value && modal.dataset.defaultParcelaId) {
                parcelaHidden.value = modal.dataset.defaultParcelaId;
              }
            } else {
              parcelaHidden.value = "";
            }
          }

          if (t === "PARCELA") {
            setPay("valor_pago", prest.toFixed(2).replace(".", ","));
            setHint(`Prestação sugerida: ${money(prest)}`);
          } else if (t === "JUROS") {
            setPay("valor_pago", juros.toFixed(2).replace(".", ","));
            setHint(`Juros desta prestação: ${money(juros)}`);
          } else if (t === "QUITACAO" || t === "INTEGRAL") {
            setPay("valor_pago", saldo.toFixed(2).replace(".", ","));
            setHint(`Quitação (saldo estimado): ${money(saldo)}`);
            if (valorInput) valorInput.readOnly = true;
          } else if (t === "EXTRA") {
            setPay("valor_pago", "");
            setHint(`Valor parcial (preencha manualmente).`);
          } else {
            setPay("valor_pago", "");
            setHint("");
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
