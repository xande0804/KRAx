// public/assets/js/modals/lancarPagamento.modal.js
(function () {
  const qs = window.qs;
  const onSuccess = window.onSuccess || function () {};
  const onError = window.onError || function () {};
  const GestorModal = window.GestorModal;

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
                <option value="PARCELA">Parcela</option>
                <option value="JUROS">Apenas juros</option>
                <option value="INTEGRAL">Valor integral (quitação)</option>
                <option value="EXTRA">Multa</option>
              </select>
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

        // ✅ aqui você já tem seu esquema de reload/refresh nos modais
        onSuccess("Pagamento lançado!", { reload: true });
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });
  }

  function openLancarPagamento(dataset) {
    const modal = document.getElementById("modalLancarPagamento");
    if (!modal) return;

    const setPay = (field, value) => {
      const el = modal.querySelector(`[data-pay="${field}"]`);
      if (!el) return;
      el.value = value ?? "";
    };

    setPay("cliente_nome", dataset.clienteNome || "—");
    setPay("emprestimo_info", dataset.emprestimoInfo || "—");
    setPay("emprestimo_id", dataset.emprestimoId || "");
    setPay("parcela_id", dataset.parcelaId || "");

    if (dataset.tipoPadrao) setPay("tipo_pagamento", dataset.tipoPadrao);
    if (dataset.valorPadrao) setPay("valor_pago", dataset.valorPadrao);

    const today = new Date().toISOString().slice(0, 10);
    setPay("data_pagamento", dataset.dataPadrao || today);

    GestorModal.open("modalLancarPagamento");
  }

  window.injectModalLancamentoPagamento = injectModalLancamentoPagamento;

  // ✅ o index.js chama openLancamentoPagamento(dataset)
  window.openLancamentoPagamento = openLancarPagamento;

  // (opcional) manter o nome antigo também, se você já usou em algum lugar
  window.openLancarPagamento = openLancarPagamento;
})();
