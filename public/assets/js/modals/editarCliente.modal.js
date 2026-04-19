// public/assets/js/modals/clientes/editarCliente.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const onSuccess = window.onSuccess || function () { };
  const toast = window.toast || function () { };
  const GestorModal = window.GestorModal;

  const API = "/KRAx/public/api.php";

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtBytes(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v) || v <= 0) return "";
    const kb = v / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function isImageMime(mime) {
    return String(mime || "").toLowerCase().startsWith("image/");
  }

  function iconByMime(mime) {
    const m = String(mime || "").toLowerCase();
    if (m.includes("pdf")) return "📄";
    if (isImageMime(m)) return "🖼️";
    if (m.includes("zip") || m.includes("rar")) return "🗜️";
    if (m.includes("word")) return "📝";
    if (m.includes("excel") || m.includes("spreadsheet")) return "📊";
    return "📎";
  }

  function normalizarGrupo(grupo) {
    const g = String(grupo || "").trim().toUpperCase();
    return g === "MARIA" ? "MARIA" : "PADRAO";
  }

  function buildDocsHtml(docs, clienteId) {
    if (!Array.isArray(docs) || docs.length === 0) {
      return `<div class="muted" style="padding:8px 0;">Nenhum documento anexado.</div>`;
    }

    return docs.map(d => {
      const docId = esc(d.id || "");
      const nome = esc(d.nome_original || d.arquivo || "Documento");
      const url = esc(d.url || "#");
      const mime = String(d.mime || "");
      const size = fmtBytes(d.tamanho);
      const icon = iconByMime(mime);

      const preview = isImageMime(mime)
        ? `<img src="${url}" alt="${nome}" style="width:44px;height:44px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,.12);" />`
        : `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(0,0,0,.12);">${icon}</div>`;

      return `
        <div class="doc-row" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);">
          ${preview}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nome}</div>
            <div class="muted" style="font-size:12px;">${esc(mime || "arquivo")} ${size ? "• " + esc(size) : ""}</div>
          </div>

          <a class="btn btn--secondary"
             href="${url}"
             target="_blank"
             rel="noopener noreferrer"
             style="padding:8px 10px;text-decoration:none;">
            Abrir
          </a>

          <button class="btn btn--secondary"
                  type="button"
                  data-doc-delete="1"
                  data-cliente-id="${esc(clienteId)}"
                  data-doc-id="${docId}"
                  style="padding:8px 10px;">
            Excluir
          </button>
        </div>
      `;
    }).join("");
  }

  async function fetchClienteDetalhes(id) {
    const res = await fetch(`${API}?route=clientes/detalhes&id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.mensagem || "Erro ao buscar cliente");
    return json.dados || {};
  }

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

        <form class="modal__body" id="formEditarCliente" action="${API}?route=clientes/atualizar" method="post" enctype="multipart/form-data">
          <input type="hidden" name="id" />
          <input type="hidden" name="grupo" id="editarClienteGrupoInput" value="PADRAO" />

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

            <div class="field form-span-2">
              <label>Grupo do cliente</label>

              <div
                style="
                  display:flex;
                  align-items:flex-start;
                  gap:10px;
                  padding:12px 14px;
                  border:1px solid var(--line, #2a2f3a);
                  border-radius:14px;
                  background:var(--panel, rgba(255,255,255,0.02));
                "
              >
                <input
                  type="checkbox"
                  id="editarClienteGrupoMaria"
                  style="margin-top:3px;"
                />

                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="editarClienteGrupoMaria" style="margin:0; cursor:pointer; font-weight:600;">
                    Este cliente pertence ao grupo Novo
                  </label>
                  
                </div>
              </div>
            </div>

            <!-- ✅ NOVO: anexar docs -->
            <div class="field form-span-2">
              <label>Anexar novos documentos</label>
              <input
                type="file"
                name="documentos[]"
                id="editarClienteDocsInput"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              />
              <div class="muted" style="margin-top:6px;font-size:12px;">
                Você pode anexar mais arquivos aqui. Máx 25MB por arquivo.
              </div>

              <div id="editarClienteDocsSelected" style="margin-top:10px;"></div>
            </div>

            <!-- ✅ NOVO: lista docs existentes -->
            <div class="field form-span-2">
              <label>Documentos do cliente</label>
              <div id="editarClienteDocsList" style="margin-top:6px;"></div>
              <div class="muted" style="margin-top:8px;font-size:12px;">
                Dica: “Excluir” vai remover o arquivo do sistema (precisa da rota clientes/documentos/excluir).
              </div>
            </div>

          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalEditarCliente">Cancelar</button>
            <button class="btn btn--primary" type="submit" id="btnSubmitEditarCliente">Salvar alterações</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    if (typeof applyMasks === "function") {
      applyMasks(modal);
    }

    const form = qs("#formEditarCliente");
    const btnSubmit = qs("#btnSubmitEditarCliente");
    const docsInput = qs("#editarClienteDocsInput");
    const docsSelected = qs("#editarClienteDocsSelected");
    const docsList = qs("#editarClienteDocsList");
    const grupoCheckbox = qs("#editarClienteGrupoMaria");
    const grupoInput = qs("#editarClienteGrupoInput");

    function syncGrupoInput() {
      if (!grupoInput || !grupoCheckbox) return;
      grupoInput.value = grupoCheckbox.checked ? "MARIA" : "PADRAO";
    }

    if (grupoCheckbox) {
      grupoCheckbox.addEventListener("change", syncGrupoInput);
    }

    syncGrupoInput();

    function renderSelectedFiles() {
      if (!docsSelected) return;
      const files = docsInput && docsInput.files ? Array.from(docsInput.files) : [];
      if (!files.length) {
        docsSelected.innerHTML = `<div class="muted" style="padding:8px 0;">Nenhum arquivo novo selecionado.</div>`;
        return;
      }

      docsSelected.innerHTML = files.slice(0, 20).map((f) => {
        const name = esc(f.name);
        const mime = esc(f.type || "arquivo");
        const size = fmtBytes(f.size);
        const icon = iconByMime(f.type);

        return `
          <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);">
            <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid rgba(0,0,0,.12);">${icon}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
              <div class="muted" style="font-size:12px;">${mime} ${size ? "• " + esc(size) : ""}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    if (docsInput) {
      docsInput.addEventListener("change", renderSelectedFiles);
      renderSelectedFiles();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (btnSubmit) btnSubmit.disabled = true;

      try {
        syncGrupoInput();

        const fd = new FormData(form);

        const res = await fetch(`${API}?route=clientes/atualizar`, {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao atualizar cliente");
          if (btnSubmit) btnSubmit.disabled = false;
          return;
        }

        if (docsInput) docsInput.value = "";
        renderSelectedFiles();

        const id = String(form.querySelector('input[name="id"]')?.value || "");
        if (id) {
          try {
            const dados = await fetchClienteDetalhes(id);
            if (docsList) docsList.innerHTML = buildDocsHtml(dados.documentos || [], id);
          } catch (_) { }
        }

        toast("Cliente atualizado!", "success", 2200);

        GestorModal.close("modalEditarCliente");
        onSuccess("Cliente atualizado!", { reload: true });
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-doc-delete="1"]');
      if (!btn) return;

      const clienteId = btn.getAttribute("data-cliente-id") || "";
      const docId = btn.getAttribute("data-doc-id") || "";
      if (!clienteId || !docId) return;

      const ok = confirm("Excluir este documento? Essa ação não pode ser desfeita.");
      if (!ok) return;

      btn.disabled = true;

      try {
        const fd = new FormData();
        fd.append("cliente_id", clienteId);
        fd.append("doc_id", docId);

        const res = await fetch(`${API}?route=clientes/documentos/excluir`, {
          method: "POST",
          body: fd,
        });

        const json = await res.json();
        if (!json.ok) {
          btn.disabled = false;
          onError(json.mensagem || "Erro ao excluir documento");
          return;
        }

        toast("Documento excluído.", "success", 2200);

        const dados = await fetchClienteDetalhes(clienteId);
        if (docsList) docsList.innerHTML = buildDocsHtml(dados.documentos || [], clienteId);
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        onError("Erro de rede ao excluir documento");
      }
    });
  }

  window.openEditarCliente = async function openEditarCliente(clienteId) {
    const id = String(clienteId || "");
    if (!id) return;

    if (!document.getElementById("modalEditarCliente")) {
      injectModalEditarCliente();
    }

    const modal = document.getElementById("modalEditarCliente");
    const form = modal.querySelector("#formEditarCliente");

    const docsList = modal.querySelector("#editarClienteDocsList");
    const docsInput = modal.querySelector("#editarClienteDocsInput");
    const docsSelected = modal.querySelector("#editarClienteDocsSelected");
    const grupoCheckbox = modal.querySelector("#editarClienteGrupoMaria");
    const grupoInput = modal.querySelector("#editarClienteGrupoInput");

    if (docsInput) docsInput.value = "";
    if (docsSelected) docsSelected.innerHTML = `<div class="muted" style="padding:8px 0;">Nenhum arquivo novo selecionado.</div>`;
    if (docsList) docsList.innerHTML = `<div class="muted" style="padding:8px 0;">Carregando documentos...</div>`;

    const nomeInput = form.querySelector('input[name="nome"]');
    if (nomeInput) nomeInput.value = "Carregando...";

    try {
      const c = await fetchClienteDetalhes(id);

      form.querySelector('input[name="id"]').value = id;
      form.querySelector('input[name="nome"]').value = c.nome || "";
      form.querySelector('input[name="cpf"]').value = c.cpf || "";
      form.querySelector('input[name="telefone"]').value = c.telefone || "";
      form.querySelector('input[name="endereco"]').value = c.endereco || "";
      form.querySelector('input[name="profissao"]').value = c.profissao || "";
      form.querySelector('input[name="placa_carro"]').value = c.placa_carro || "";
      form.querySelector('input[name="indicacao"]').value = c.indicacao || "";

      const grupo = normalizarGrupo(c.grupo);
      if (grupoCheckbox) grupoCheckbox.checked = grupo === "MARIA";
      if (grupoInput) grupoInput.value = grupo;

      const cpfInput = form.querySelector('input[name="cpf"]');
      const telInput = form.querySelector('input[name="telefone"]');
      if (cpfInput) cpfInput.dispatchEvent(new Event("input"));
      if (telInput) telInput.dispatchEvent(new Event("input"));

      if (docsList) docsList.innerHTML = buildDocsHtml(c.documentos || [], id);

      GestorModal.open("modalEditarCliente");
    } catch (err) {
      console.error(err);
      onError("Erro de rede ao buscar cliente");
    }
  };

  window.injectModalEditarCliente = injectModalEditarCliente;
})();