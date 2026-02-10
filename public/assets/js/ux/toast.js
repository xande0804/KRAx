// public/assets/js/ui/toast.js
(function () {
    function injectToastHost() {
        if (document.getElementById("toastHost")) return;
        const host = document.createElement("div");
        host.id = "toastHost";
        host.className = "toast-host";
        document.body.appendChild(host);
    }

    function toast(msg, type = "success", ms = 2200) {
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

    function onSuccess(msg, opts = {}) {
        toast(msg || "Ação concluída com sucesso!", "success", 1700);

        const { redirectTo = null, reload = true, delay = 900 } = opts;

        setTimeout(() => {
            if (redirectTo) {
                window.location.href = redirectTo;
                return;
            }
            if (reload) window.location.reload();
        }, delay);
    }

    function onError(msg) {
        toast(msg || "Ocorreu um erro.", "error", 2600);
    }

    // expõe globalmente (sem module)
    window.toast = toast;
    window.onSuccess = onSuccess;
    window.onError = onError;
})();
