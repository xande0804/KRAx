// public/assets/js/ui/toast.js
(function () {
    const STORE_KEY = "toast_queue_v1";
  
    function injectToastHost() {
      if (document.getElementById("toastHost")) return;
      const host = document.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      document.body.appendChild(host);
    }
  
    function readQueue() {
      try {
        return JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
      } catch {
        return [];
      }
    }
  
    function writeQueue(q) {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(q || []));
      } catch { }
    }
  
    // ✅ mostra na tela
    function showToast(msg, type = "success", ms = 4000) {
      injectToastHost();
      const host = document.getElementById("toastHost");
  
      const el = document.createElement("div");
      el.className = `toast toast--${type}`;
      el.textContent = msg;
  
      host.appendChild(el);
  
      requestAnimationFrame(() => el.classList.add("is-show"));
  
      setTimeout(() => {
        el.classList.remove("is-show");
        setTimeout(() => el.remove(), 250);
      }, ms);
    }
  
    // ✅ cria toast e opcionalmente persiste pro próximo reload
    function toast(msg, type = "success", ms = 4000, opts = {}) {
      const { persist = false } = opts;
  
      if (persist) {
        const q = readQueue();
        q.push({ msg, type, ms });
        writeQueue(q);
      }
  
      showToast(msg, type, ms);
    }
  
    // ✅ ao carregar a página, reexibe os toasts persistidos
    function flushPersistedToasts() {
      const q = readQueue();
      if (!q.length) return;
      writeQueue([]); // limpa antes de mostrar pra não duplicar
      q.forEach(t => showToast(t.msg, t.type, t.ms));
    }
  
    function onSuccess(msg, opts = {}) {
      const {
        redirectTo = null,
        reload = true,
        delay = 900,
        ms = 4500,
        persist = true // ✅ por padrão: persiste, pra você conseguir ler mesmo com reload
      } = opts;
  
      toast(msg || "Ação concluída com sucesso!", "success", ms, { persist });
  
      setTimeout(() => {
        if (redirectTo) {
          window.location.href = redirectTo;
          return;
        }
        if (reload) window.location.reload();
      }, delay);
    }
  
    function onError(msg, opts = {}) {
      const { ms = 7000, persist = true } = opts; // ✅ erros mais tempo
      toast(msg || "Ocorreu um erro.", "error", ms, { persist });
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      flushPersistedToasts();
    });
  
    window.toast = toast;
    window.onSuccess = onSuccess;
    window.onError = onError;
  })();
  