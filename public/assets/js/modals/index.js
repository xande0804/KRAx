// public/assets/js/modals/index.js
(function () {
    const onError = window.onError || function () { };
    const toast = window.toast || function () { };
    const GestorModal = window.GestorModal;
  
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
  
          GestorModal.close("modalDetalhesCliente");
  
          if (typeof window.openEditarCliente === "function") {
            window.openEditarCliente(clienteId);
          } else {
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
  
        if (closeEl && !openEl) {
          GestorModal.close(closeEl.getAttribute("data-modal-close"));
          return;
        }
  
        if (!openEl) return;
  
        const key = openEl.getAttribute("data-modal-open");
  
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
            LANÇAR PAGAMENTO (✅ COM RETORNO)
        ========================= */
        if (key === "lancarPagamento") {
          const detCli = document.getElementById("modalDetalhesCliente");
          const detEmp = document.getElementById("modalDetalhesEmprestimo");
  
          if (detEmp && detEmp.getAttribute("aria-hidden") === "false") {
            openEl.dataset.returnTo = "detalhesEmprestimo";
            openEl.dataset.returnEmprestimoId = detEmp.dataset.emprestimoId || openEl.dataset.emprestimoId || "";
            openEl.dataset.returnClienteId = detEmp.dataset.clienteId || openEl.dataset.clienteId || "";
            GestorModal.close("modalDetalhesEmprestimo");
          } else if (detCli && detCli.getAttribute("aria-hidden") === "false") {
            openEl.dataset.returnTo = "detalhesCliente";
            openEl.dataset.returnClienteId = detCli.dataset.clienteId || openEl.dataset.clienteId || "";
            GestorModal.close("modalDetalhesCliente");
          } else {
            openEl.dataset.returnTo = "";
          }
  
          if (typeof window.openLancarPagamento === "function") {
            window.openLancarPagamento(openEl);
          } else {
            onError("Função openLancarPagamento() não encontrada.");
          }
          return;
        }
  
        GestorModal.open(key);
      });
  
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") GestorModal.closeAll();
      });
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      if (typeof window.injectOverlay === "function") window.injectOverlay();
  
      if (typeof window.injectModalNovoCliente === "function") window.injectModalNovoCliente();
      if (typeof window.injectModalDetalhesCliente === "function") window.injectModalDetalhesCliente();
      if (typeof window.injectModalNovoEmprestimo === "function") window.injectModalNovoEmprestimo();
      if (typeof window.injectModalEditarCliente === "function") window.injectModalEditarCliente();
      if (typeof window.injectModalLancamentoPagamento === "function") window.injectModalLancamentoPagamento();
      if (typeof window.injectModalDetalhesEmprestimo === "function") window.injectModalDetalhesEmprestimo();
  
      bindOpenClose();
    });
  })();
  