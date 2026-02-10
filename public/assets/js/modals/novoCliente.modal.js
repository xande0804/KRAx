// public/assets/js/modals/novoCliente.modal.js
(function () {
    const qs = window.qs;
    const toast = window.toast || function () { };
    const onSuccess = window.onSuccess || function () { };
    const onError = window.onError || function () { };
    const GestorModal = window.GestorModal;

    function injectModalNovoCliente() {
        if (qs("#modalNovoCliente")) return;

        const modal = document.createElement("section");
        modal.className = "modal";
        modal.id = "modalNovoCliente";
        modal.setAttribute("aria-hidden", "true");

        modal.innerHTML = `
        <div class="modal__dialog">
          <header class="modal__header">
            <div>
              <h3 class="modal__title">Novo cliente</h3>
              <p class="modal__subtitle">Preencha os dados do novo cliente.</p>
            </div>
            <button class="iconbtn" type="button" data-modal-close="modalNovoCliente">×</button>
          </header>
  
          <form class="modal__body" id="formNovoCliente" action="/KRAx/public/api.php?route=clientes/criar" method="post">
            <div class="form-grid">
              <div class="field form-span-2">
                <label>Nome *</label>
                <input name="nome" required placeholder="Nome completo" />
              </div>
  
              <div class="field">
                <label>CPF</label>
                <input name="cpf" placeholder="000.000.000-00" />
              </div>
  
              <div class="field">
                <label>Telefone</label>
                <input name="telefone" placeholder="(00) 00000-0000" />
              </div>
  
              <div class="field form-span-2">
                <label>Endereço</label>
                <input name="endereco" placeholder="Rua, numero, bairro" />
              </div>
  
              <div class="field">
                <label>Profissão</label>
                <input name="profissao" placeholder="Ex: Comerciante" />
              </div>
  
              <div class="field">
                <label>Placa do carro</label>
                <input name="placa_carro" placeholder="ABC-1234" />
              </div>
  
              <div class="field form-span-2">
                <label>Indicação</label>
                <input name="indicacao" placeholder="Quem indicou este cliente?" />
              </div>
            </div>
  
            <footer class="modal__footer">
              <button class="btn" type="button" data-modal-close="modalNovoCliente">Cancelar</button>
  
              <button class="btn btn--secondary" type="submit">
                Salvar cadastro
              </button>
  
              <button class="btn btn--primary" type="button" id="btnSalvarECriarEmprestimo">
                Salvar e criar empréstimo
              </button>
            </footer>
          </form>
        </div>
      `;

        document.body.appendChild(modal);

        // ativa máscaras no modal
        if (typeof applyMasks === "function") {
            applyMasks(modal);
        }

        const form = qs("#formNovoCliente");
        const btnSalvarECriar = qs("#btnSalvarECriarEmprestimo");

        let abrirNovoEmprestimoDepois = false;

        btnSalvarECriar.addEventListener("click", () => {
            abrirNovoEmprestimoDepois = true;
            form.requestSubmit();
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            try {
                const fd = new FormData(form);

                const res = await fetch("/KRAx/public/api.php?route=clientes/criar", {
                    method: "POST",
                    body: fd,
                });

                const json = await res.json();

                if (!json.ok) {
                    onError(json.mensagem || "Erro ao criar cliente");
                    abrirNovoEmprestimoDepois = false;
                    return;
                }

                const novoClienteId = json.dados?.id;
                const nomeDigitado = (fd.get("nome") || "").toString().trim();

                GestorModal.close("modalNovoCliente");
                form.reset();

                // fluxo 1: só salvar
                if (!abrirNovoEmprestimoDepois) {
                    onSuccess("Cliente cadastrado!", { reload: true });
                    return;
                }

                // fluxo 2: salvar e abrir empréstimo
                abrirNovoEmprestimoDepois = false;
                toast("Cliente cadastrado! Abrindo empréstimo...", "success", 1400);

                if (!document.getElementById("modalNovoEmprestimo")) {
                    if (typeof window.injectModalNovoEmprestimo === "function") {
                        window.injectModalNovoEmprestimo();
                    }
                }

                // abre o modal e já preenche
                GestorModal.open("modalNovoEmprestimo");

                const modalEmp = document.getElementById("modalNovoEmprestimo");
                if (modalEmp) {
                    const selectCliente = modalEmp.querySelector('select[name="cliente_id"]');
                    if (selectCliente && novoClienteId) {
                        selectCliente.innerHTML = `
                <option value="">Selecione o cliente</option>
                <option value="${novoClienteId}">${nomeDigitado || "Cliente"}</option>
              `;
                        selectCliente.value = String(novoClienteId);
                        selectCliente.disabled = false;
                        selectCliente.dataset.locked = "1";
                    }

                    const inputData = modalEmp.querySelector('input[name="data_emprestimo"]');
                    if (inputData && !inputData.value) {
                        inputData.value = new Date().toISOString().slice(0, 10);
                    }
                }
            } catch (err) {
                console.error(err);
                onError("Erro de conexão com o servidor");
                abrirNovoEmprestimoDepois = false;
            }
        });



    }

    // expõe
    window.injectModalNovoCliente = injectModalNovoCliente;

    // handler pro index.js
    window.openNovoCliente = function openNovoCliente() {
        injectModalNovoCliente();
        GestorModal.open("modalNovoCliente");
    };
})();