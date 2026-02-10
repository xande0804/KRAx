// public/assets/js/modals/actions/excluirCliente.action.js
(function () {
    const onError = window.onError || function () { };
    const onSuccess = window.onSuccess || function () { };
    const GestorModal = window.GestorModal;

    async function excluirCliente(clienteId) {
        if (!clienteId) return;

        const ok = confirm(
            "Tem certeza que deseja excluir este cliente? Essa ação não pode ser desfeita."
        );
        if (!ok) return;

        try {
            const fd = new FormData();
            fd.append("id", String(clienteId));

            const res = await fetch("/KRAx/public/api.php?route=clientes/excluir", {
                method: "POST",
                body: fd,
            });

            const json = await res.json();

            if (!json.ok) {
                onError(json.mensagem || "Erro ao excluir cliente");
                return;
            }

            if (GestorModal) GestorModal.closeAll();
            onSuccess("Cliente excluído!", { reload: true });
        } catch (err) {
            console.error(err);
            onError("Erro de conexão ao excluir");
        }
    }

    window.excluirCliente = excluirCliente;
})();