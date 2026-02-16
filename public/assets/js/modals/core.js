// public/assets/js/modals/core.js
(function () {
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  const Modal = {
    open(id) {
      const overlay = qs("#modalOverlay");
      const modal = qs(`#${id}`);
      if (!overlay || !modal) return;

      overlay.classList.add("is-open");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    },
    close(id) {
      const overlay = qs("#modalOverlay");
      const modal = qs(`#${id}`);
      if (!overlay || !modal) return;

      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");

      const anyOpen = document.querySelector(".modal.is-open");
      if (!anyOpen) overlay.classList.remove("is-open");

      document.body.classList.remove("no-scroll");
    },
    closeAll() {
      document.querySelectorAll(".modal.is-open").forEach((m) => {
        m.classList.remove("is-open");
        m.setAttribute("aria-hidden", "true");
      });
      const overlay = qs("#modalOverlay");
      if (overlay) overlay.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    },
  };

  window.qs = window.qs || qs;
  window.GestorModal = window.GestorModal || Modal;

  // ✅ NOVO: fecha modal ao clicar fora (na área vazia do próprio modal)
  // - Não usa stopPropagation
  // - Não interfere em botões/inputs dentro do modal
  function bindOutsideClickClose() {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (!modal || modal.dataset.outsideCloseBound === "1") return;
      modal.dataset.outsideCloseBound = "1";

      modal.addEventListener("click", (e) => {
        // Só fecha se o clique foi no próprio "backdrop" do modal (section.modal),
        // e NÃO em elementos internos (dialog, botões, inputs etc).
        if (e.target === modal) {
          Modal.closeAll();
        }
      });
    });
  }

  function injectOverlay() {
    if (qs("#modalOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "modalOverlay";
    overlay.className = "modal-overlay";

    // clique no overlay fecha todos (seu comportamento original)
    overlay.addEventListener("click", () => Modal.closeAll());

    document.body.appendChild(overlay);

    // ✅ liga o clique fora pros modais que já existem
    bindOutsideClickClose();

    // ✅ garante para modais injetados depois: sempre que abrir, faz bind se precisar
    const originalOpen = Modal.open.bind(Modal);
    Modal.open = function (id) {
      bindOutsideClickClose();
      originalOpen(id);
    };

    window.GestorModal = window.GestorModal || Modal;
  }

  window.injectOverlay = window.injectOverlay || injectOverlay;
})();
