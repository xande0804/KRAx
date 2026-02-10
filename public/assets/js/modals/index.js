(function () {
    const onError = window.onError || function () { };
    const toast = window.toast || function () { };

    function bindOpenClose() {
        document.addEventListener("click", async (e) => {
            /* =========================
               EDITAR CLIENTE
            ========================= */
            const btnEdit = e.target.closest("#btnEditarCliente");
            if (btnEdit) {
                const modalDet = document.getElementById("modalDetalhesCliente");
                const clienteId =
                    btnEdit.dataset.clienteId || modalDet?.dataset.clienteId || "";

                if (!clienteId) return;

                // fecha detalhes antes de abrir editar
                GestorModal.close("modalDetalhesCliente");

                // se existir um handler melhor, usa ele
                if (typeof window.openEditarCliente === "function") {
                    window.openEditarCliente(clienteId);
                } else {
                    // fallback: só abre (vai estar vazio se ninguém preencher)
                    GestorModal.open("modalEditarCliente");
                }
                return;
            }

            /* =========================
               EXCLUIR CLIENTE
            ========================= */
            const btnDel = e.target.closest("#btnExcluirCliente");
            if (btnDel) {
                const modalDet = document.getElementById("modalDetalhesCliente");
                const clienteId =
                    btnDel.dataset.clienteId || modalDet?.dataset.clienteId || "";

                if (!clienteId) return;

                // delega pra função de excluir (se existir)
                if (typeof window.excluirCliente === "function") {
                    window.excluirCliente(clienteId);
                } else {
                    onError("Função excluirCliente() não encontrada.");
                }
                return;
            }

            /* =========================
               ABRIR / FECHAR MODAIS
            ========================= */
            const openEl = e.target.closest("[data-modal-open]");
            const closeEl = e.target.closest("[data-modal-close]");

            // fechando
            if (closeEl && !openEl) {
                GestorModal.close(closeEl.getAttribute("data-modal-close"));
                return;
            }

            // se não é abrir modal, sai
            if (!openEl) return;

            const key = openEl.getAttribute("data-modal-open");

            // se esse botão também manda fechar outro antes (ex: data-modal-close)
            const closeTarget = openEl.getAttribute("data-modal-close");
            if (closeTarget) GestorModal.close(closeTarget);

            /* =========================
               NOVO CLIENTE
            ========================= */
            if (key === "novoCliente") {
                if (typeof window.openNovoCliente === "function") {
                    window.openNovoCliente();
                } else {
                    onError("Função openNovoCliente() não encontrada.");
                }
                return;
            }


            /* =========================
               DETALHES CLIENTE
            ========================= */
            if (key === "detalhesCliente") {
                const clienteId = openEl.dataset.clienteId || "";
                if (!clienteId) return;

                if (typeof window.openDetalhesCliente === "function") {
                    window.openDetalhesCliente(openEl.dataset.clienteId);
                } else {
                    onError("Função openDetalhesCliente() não encontrada.");
                }
                return;
            }

            /* =========================
               NOVO EMPRÉSTIMO
            ========================= */
            if (key === "novoEmprestimo") {
                const clienteId = openEl.dataset.clienteId || "";
                const clienteNome = openEl.dataset.clienteNome || "";
              
                if (typeof window.openNovoEmprestimo === "function") {
                  window.openNovoEmprestimo({ clienteId, clienteNome });
                } else {
                  onError("Função openNovoEmprestimo() não encontrada.");
                }
                return;
              }
              

            /* =========================
               DETALHES EMPRÉSTIMO
            ========================= */
            if (key === "detalhesEmprestimo") {
                const emprestimoId = openEl.dataset.emprestimoId || "";
                if (!emprestimoId) return;

                if (typeof window.openDetalhesEmprestimo === "function") {
                    window.openDetalhesEmprestimo(emprestimoId, openEl.dataset);
                } else {
                    onError("Função openDetalhesEmprestimo() não encontrada.");
                }
                return;
            }

            /* =========================
               LANÇAR PAGAMENTO
            ========================= */
            if (key === "lancarPagamento") {
                if (typeof window.openLancamentoPagamento === "function") {
                    window.openLancamentoPagamento(openEl.dataset);
                } else {
                    onError("Função openLancamentoPagamento() não encontrada.");
                }
                return;
            }

            // fallback: abre direto pelo id do modal (se key == id)
            GestorModal.open(key);
        });

        // ESC fecha tudo
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") GestorModal.closeAll();
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        // core
        if (typeof window.injectOverlay === "function") window.injectOverlay();

        // injeta modais (cada arquivo define um injectModalX)
        if (typeof window.injectModalNovoCliente === "function") window.injectModalNovoCliente();
        if (typeof window.injectModalDetalhesCliente === "function") window.injectModalDetalhesCliente();
        if (typeof window.injectModalNovoEmprestimo === "function") window.injectModalNovoEmprestimo();
        if (typeof window.injectModalEditarCliente === "function") window.injectModalEditarCliente();
        if (typeof window.injectModalLancamentoPagamento === "function") window.injectModalLancamentoPagamento();
        if (typeof window.injectModalDetalhesEmprestimo === "function") window.injectModalDetalhesEmprestimo();

        bindOpenClose();
    });
})();