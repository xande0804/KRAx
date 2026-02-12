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
  
    function injectOverlay() {
      if (qs("#modalOverlay")) return;
      const overlay = document.createElement("div");
      overlay.id = "modalOverlay";
      overlay.className = "modal-overlay";
      overlay.addEventListener("click", () => Modal.closeAll());
      document.body.appendChild(overlay);
    }
  
    window.injectOverlay = window.injectOverlay || injectOverlay;
  })();
  