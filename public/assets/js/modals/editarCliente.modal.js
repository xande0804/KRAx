// public/assets/js/modals/clientes/editarCliente.modal.js
(function () {
    const qs = window.qs;
    const onError = window.onError || function () { };
    const onSuccess = window.onSuccess || function () { };

    function injectModalEditarCliente() {
        if (qs("#modalEditarCliente")) return;

        const modal = document.createElement("section");
        modal.className = "modal";
        modal.id = "modalEditarCliente";
        modal.setAttribute("aria-hidden", "true");

        modal.innerHTML = `
        <div class="modal__dialog">
          <header class="modal__header">
            <div>
              <h3 class="modal__title">Editar cliente</h3>
              <p class="modal__subtitle">Atualize os dados do cliente.</p>
            </div>
            <button class="iconbtn" type="button" data-modal-close="modalEditarCliente">×</button>
          </header>
  
          <form class="modal__body" id="formEditarCliente" action="/KRAx/public/api.php?route=clientes/atualizar" method="post">
            <input type="hidden" name="id" />
  
            <div class="form-grid">
              <div class="field form-span-2">
                <label>Nome *</label>
                <input name="nome" required />
              </div>
  
              <div class="field">
                <label>CPF</label>
                <input name="cpf" />
              </div>
  
              <div class="field">
                <label>Telefone</label>
                <input name="telefone" />
              </div>
  
              <div class="field form-span-2">
                <label>Endereço</label>
                <input name="endereco" />
              </div>
  
              <div class="field">
                <label>Profissão</label>
                <input name="profissao" />
              </div>
  
              <div class="field">
                <label>Placa do carro</label>
                <input name="placa_carro" />
              </div>
  
              <div class="field form-span-2">
                <label>Indicação</label>
                <input name="indicacao" />
              </div>
            </div>
  
            <footer class="modal__footer modal__footer--end">
              <button class="btn" type="button" data-modal-close="modalEditarCliente">Cancelar</button>
              <button class="btn btn--primary" type="submit">Salvar alterações</button>
            </footer>
          </form>
        </div>
      `;

        document.body.appendChild(modal);

        // ativa máscaras no modal
        if (typeof applyMasks === "function") {
            applyMasks(modal);

            // SUBMIT
            const form = qs("#formEditarCliente");
            form.addEventListener("submit", async (e) => {
                e.preventDefault();

                try {
                    const fd = new FormData(form);

                    const res = await fetch("/KRAx/public/api.php?route=clientes/atualizar", {
                        method: "POST",
                        body: fd,
                    });

                    const json = await res.json();

                    if (!json.ok) {
                        onError(json.mensagem || "Erro ao atualizar cliente");
                        return;
                    }

                    GestorModal.close("modalEditarCliente");
                    onSuccess("Cliente atualizado!", { reload: true });
                } catch (err) {
                    console.error(err);
                    onError("Erro de conexão com o servidor");
                }
            });


        }

    }

    // ✅ FUNÇÃO QUE O INDEX VAI CHAMAR
    window.openEditarCliente = async function openEditarCliente(clienteId) {
        const id = String(clienteId || "");
        if (!id) return;

        // garante que o modal existe
        if (!document.getElementById("modalEditarCliente")) {
            injectModalEditarCliente();
        }

        const modal = document.getElementById("modalEditarCliente");
        const form = modal.querySelector("#formEditarCliente");

        // opcional: feedback rápido
        const nomeInput = form.querySelector('input[name="nome"]');
        if (nomeInput) nomeInput.value = "Carregando...";

        try {
            const res = await fetch(`/KRAx/public/api.php?route=clientes/detalhes&id=${encodeURIComponent(id)}`);
            const json = await res.json();

            if (!json.ok) {
                onError(json.mensagem || "Erro ao buscar cliente");
                return;
            }

            const c = json.dados;

            form.querySelector('input[name="id"]').value = id;
            form.querySelector('input[name="nome"]').value = c.nome || "";
            form.querySelector('input[name="cpf"]').value = c.cpf || "";
            form.querySelector('input[name="telefone"]').value = c.telefone || "";
            form.querySelector('input[name="endereco"]').value = c.endereco || "";
            form.querySelector('input[name="profissao"]').value = c.profissao || "";
            form.querySelector('input[name="placa_carro"]').value = c.placa_carro || "";
            form.querySelector('input[name="indicacao"]').value = c.indicacao || "";

            const cpfInput = form.querySelector('input[name="cpf"]');
            const telInput = form.querySelector('input[name="telefone"]');

            if (cpfInput) cpfInput.dispatchEvent(new Event("input"));
            if (telInput) telInput.dispatchEvent(new Event("input"));


            GestorModal.open("modalEditarCliente");
        } catch (err) {
            console.error(err);
            onError("Erro de rede ao buscar cliente");
        }
    };

    // expõe injetor
    window.injectModalEditarCliente = injectModalEditarCliente;
})();
