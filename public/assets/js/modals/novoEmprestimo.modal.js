// public/assets/js/modals/novoEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const toast = window.toast || function () { };
  const GestorModal = window.GestorModal;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
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

            <div class="field form-span-2">
              <label>Cliente</label>
              <select name="cliente_id" required>
                <option value="">Selecione o cliente</option>
              </select>
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

            <div class="field form-span-2">
              <label>Tipo de vencimento</label>
              <select name="tipo_vencimento" required id="tipoVencimentoNovoEmprestimo">
                <option value="DIARIO">Diário</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSAL">Mensal</option>
              </select>
            </div>

            <!-- ✅ Aqui vira dinâmico -->
            <div class="field form-span-2" id="wrapRegraVencimento">
              <label id="labelRegraVencimento">Primeiro vencimento</label>
              <input type="date" name="regra_vencimento" required id="regraVencimentoInput" />
              <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
            </div>

          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalNovoEmprestimo">Cancelar</button>
            <button class="btn btn--primary" type="submit" id="btnSubmitNovoEmprestimo">Salvar empréstimo</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = qs("#formNovoEmprestimo");
    const btnSubmit = qs("#btnSubmitNovoEmprestimo");

    const tipoSel = modal.querySelector("#tipoVencimentoNovoEmprestimo");
    const wrapRegra = modal.querySelector("#wrapRegraVencimento");
    const labelRegra = modal.querySelector("#labelRegraVencimento");
    const hintRegra = modal.querySelector("#hintRegraVencimento");
    const inputDataEmp = modal.querySelector('input[name="data_emprestimo"]');

    function setHint(txt) {
      if (hintRegra) hintRegra.textContent = txt || "";
    }

    function renderRegraField() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();

      if (!wrapRegra) return;

      // Limpa e recria o campo (pra não ficar com name errado)
      wrapRegra.innerHTML = `
        <label id="labelRegraVencimento"></label>
        <div id="regraFieldSlot"></div>
        <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
      `;

      const label = wrapRegra.querySelector("#labelRegraVencimento");
      const slot = wrapRegra.querySelector("#regraFieldSlot");
      const hint = wrapRegra.querySelector("#hintRegraVencimento");

      function hintSet(t) { if (hint) hint.textContent = t || ""; }

      const baseDate = (inputDataEmp && inputDataEmp.value) ? inputDataEmp.value : todayISO();

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
        // DIARIO e MENSAL: date
        if (label) label.textContent = "Primeiro vencimento";
        if (slot) {
          slot.innerHTML = `
            <input type="date" name="regra_vencimento" required id="regraVencimentoDate" />
          `;
        }

        const dateEl = wrapRegra.querySelector("#regraVencimentoDate");
        if (dateEl) {
          // default: mesma data do empréstimo (ou hoje)
          dateEl.value = baseDate;
          dateEl.min = baseDate; // ✅ não deixa escolher menor que data do empréstimo
        }

        hintSet(tipo === "MENSAL"
          ? "Escolha a data do primeiro vencimento. As próximas parcelas serão mês a mês."
          : "Escolha a data do primeiro vencimento. As próximas parcelas serão dia a dia."
        );
      }
    }

    if (tipoSel) {
      tipoSel.addEventListener("change", renderRegraField);
    }

    if (inputDataEmp) {
      inputDataEmp.addEventListener("change", () => {
        // se o campo atual for date, atualiza min e default se necessário
        const dateEl = modal.querySelector("#regraVencimentoDate");
        if (dateEl) {
          const base = inputDataEmp.value || todayISO();
          dateEl.min = base;
          if (!dateEl.value || dateEl.value < base) {
            dateEl.value = base;
          }
        }
      });
    }

    // SUBMIT (backend)
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // evita duplo clique
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.dataset.loading = "1";
      }

      try {
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
  }

  async function loadClientes(selectCliente) {
    selectCliente.innerHTML = `<option value="">Selecione o cliente</option>`;
    selectCliente.value = "";

    try {
      const res = await fetch(`/KRAx/public/api.php?route=clientes/listar`);
      const json = await res.json();

      if (json.ok) {
        (json.dados || []).forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.nome;
          selectCliente.appendChild(opt);
        });
      } else {
        onError(json.mensagem || "Erro ao carregar clientes");
      }
    } catch (err) {
      console.error(err);
      onError("Erro de rede ao carregar clientes");
    }
  }

  // ✅ PADRÃO CERTO: recebe payload { clienteId, clienteNome }
  async function openNovoEmprestimo(payload = {}) {
    if (!document.getElementById("modalNovoEmprestimo")) {
      injectModalNovoEmprestimo();
    }

    const modal = document.getElementById("modalNovoEmprestimo");
    if (!modal) return;

    const selectCliente = modal.querySelector('select[name="cliente_id"]');
    if (!selectCliente) return;

    const btnSubmit = modal.querySelector("#btnSubmitNovoEmprestimo");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      delete btnSubmit.dataset.loading;
    }

    const clienteId = String(payload.clienteId || "");
    const clienteNome = String(payload.clienteNome || "");

    if (clienteId) {
      let opt = selectCliente.querySelector(`option[value="${clienteId}"]`);
      if (!opt) {
        opt = document.createElement("option");
        opt.value = clienteId;
        opt.textContent = clienteNome || `Cliente #${clienteId}`;
        selectCliente.appendChild(opt);
      } else if (clienteNome) {
        opt.textContent = clienteNome;
      }

      selectCliente.value = clienteId;
      selectCliente.disabled = false;
      selectCliente.dataset.locked = "1";
    } else {
      selectCliente.disabled = false;
      selectCliente.removeAttribute("data-locked");
      await loadClientes(selectCliente);
    }

    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) {
      inputData.value = todayISO();
    }

    // re-render (pra ajustar min/default do vencimento)
    const tipoSel = modal.querySelector('#tipoVencimentoNovoEmprestimo');
    if (tipoSel) {
      // dispara renderRegraField via change programático
      const ev = new Event('change', { bubbles: true });
      tipoSel.dispatchEvent(ev);
    }

    GestorModal.open("modalNovoEmprestimo");
  }

  window.injectModalNovoEmprestimo = injectModalNovoEmprestimo;
  window.openNovoEmprestimo = openNovoEmprestimo;
})();
