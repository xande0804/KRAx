// public/assets/js/modals/novoEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const toast = window.toast || function () { };
  const GestorModal = window.GestorModal;

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
              <select name="tipo_vencimento" required>
              <option value="DIARIO">Diário</option>
              <option value="SEMANAL">Semanal</option>
              <option value="MENSAL">Mensal</option>
              </select>
            </div>

            <div class="field form-span-2">
              <label>Dia do mês</label>
              <select name="regra_vencimento" required>
                ${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">Dia ${i + 1}</option>`).join("")}
              </select>
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

    // SUBMIT (backend)
    const form = qs("#formNovoEmprestimo");
    const btnSubmit = qs("#btnSubmitNovoEmprestimo");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // evita duplo clique
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.dataset.loading = "1";
      }

      try {
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

        // ✅ Fecha rápido e navega direto (sem "onSuccess" pra não piscar)
        GestorModal.close("modalNovoEmprestimo");
        form.reset();

        // toast opcional (se existir)
        toast("Empréstimo criado!");

        // ✅ navegação direta (mais rápida / sem delay)
        window.location.href = "emprestimos.php";
      } catch (err) {
        console.error(err);
        if (btnSubmit) btnSubmit.disabled = false;
        onError("Erro de conexão com o servidor");
      }
    });
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
    // garante que o modal exista (caso chamem antes de injetar)
    if (!document.getElementById("modalNovoEmprestimo")) {
      injectModalNovoEmprestimo();
    }

    const modal = document.getElementById("modalNovoEmprestimo");
    if (!modal) return;

    const selectCliente = modal.querySelector('select[name="cliente_id"]');
    if (!selectCliente) return;

    // reabilita submit caso tenha sido desabilitado numa tentativa anterior
    const btnSubmit = modal.querySelector("#btnSubmitNovoEmprestimo");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      delete btnSubmit.dataset.loading;
    }

    const clienteId = String(payload.clienteId || "");
    const clienteNome = String(payload.clienteNome || "");

    if (clienteId) {
      // garante option
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
      // abriu do zero
      selectCliente.disabled = false;
      selectCliente.removeAttribute("data-locked");
      await loadClientes(selectCliente);
    }

    // data padrão
    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) {
      inputData.value = new Date().toISOString().slice(0, 10);
    }

    GestorModal.open("modalNovoEmprestimo");
  }

  window.injectModalNovoEmprestimo = injectModalNovoEmprestimo;
  window.openNovoEmprestimo = openNovoEmprestimo;
})();