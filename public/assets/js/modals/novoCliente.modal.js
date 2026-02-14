// public/assets/js/modals/novoCliente.modal.js
(function () {
  const qs = window.qs;
  const toast = window.toast || function () { };
  const onSuccess = window.onSuccess || function () { };
  const onError = window.onError || function () { };
  const GestorModal = window.GestorModal;

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function humanSize(bytes) {
    const b = Number(bytes || 0);
    if (!Number.isFinite(b) || b <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let n = b;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

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

        <form class="modal__body" id="formNovoCliente" action="/KRAx/public/api.php?route=clientes/criar" method="post" enctype="multipart/form-data">
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

            <!-- ✅ NOVO: Documentos -->
            <div class="field form-span-2">
              <label>Documentos</label>

              <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn--secondary" type="button" id="btnAddDocs">
                  📎 Anexar documento
                </button>

                <span class="muted" id="docsHint" style="line-height:1.2;">
                  Aceita imagem, PDF ou qualquer arquivo. (Você pode remover antes de salvar)
                </span>
              </div>

              <!-- input escondido -->
              <input
                type="file"
                id="docsInput"
                name="documentos[]"
                multiple
                style="display:none;"
                accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt"
              />

              <!-- lista -->
              <div id="docsList" style="margin-top:10px;"></div>
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

    // ===== Docs (front) =====
    const btnAddDocs = qs("#btnAddDocs");
    const docsInput = qs("#docsInput");
    const docsList = qs("#docsList");

    // vamos manter uma lista nossa e refletir no input.files com DataTransfer
    let selectedFiles = []; // Array<File>
    let objectUrls = new Map(); // key: fileKey => url

    function fileKey(f) {
      return `${f.name}__${f.size}__${f.lastModified}`;
    }

    function syncInputFiles() {
      if (!docsInput) return;
      const dt = new DataTransfer();
      selectedFiles.forEach(f => dt.items.add(f));
      docsInput.files = dt.files;
    }

    function revokeAllUrls() {
      for (const url of objectUrls.values()) {
        try { URL.revokeObjectURL(url); } catch (_) { }
      }
      objectUrls.clear();
    }

    function renderDocs() {
      if (!docsList) return;

      if (!selectedFiles.length) {
        docsList.innerHTML = `<div class="muted" style="padding:8px 0;">Nenhum documento anexado.</div>`;
        return;
      }

      docsList.innerHTML = selectedFiles.map((f) => {
        const key = fileKey(f);
        const type = String(f.type || "").toLowerCase();

        const isImg = type.startsWith("image/");
        const isPdf = type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

        let badge = "Arquivo";
        if (isImg) badge = "Imagem";
        else if (isPdf) badge = "PDF";

        return `
          <div class="list-item" style="padding:10px; margin:0 0 8px 0; align-items:center;">
            <div class="list-item__main">
              <div class="list-item__title">
                <strong>${esc(f.name)}</strong>
                <span class="badge">${esc(badge)}</span>
              </div>
              <div class="list-item__sub">${esc(humanSize(f.size))}</div>
            </div>

            <div class="list-item__actions" style="display:flex; gap:10px; align-items:center;">
              <button class="linkbtn" type="button" data-doc-action="view" data-doc-key="${esc(key)}">👁️ Visualizar</button>
              <button class="linkbtn" type="button" data-doc-action="remove" data-doc-key="${esc(key)}">🗑️ Remover</button>
            </div>
          </div>
        `;
      }).join("");
    }

    function addFiles(fileList) {
      const arr = Array.from(fileList || []);
      if (!arr.length) return;

      // evita duplicados (mesmo nome+tamanho+lastModified)
      const existing = new Set(selectedFiles.map(fileKey));
      for (const f of arr) {
        const k = fileKey(f);
        if (!existing.has(k)) {
          selectedFiles.push(f);
          existing.add(k);
        }
      }

      // ordena por nome (opcional, pra ficar bonitinho)
      selectedFiles.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

      syncInputFiles();
      renderDocs();
    }

    function removeFileByKey(k) {
      selectedFiles = selectedFiles.filter(f => fileKey(f) !== k);

      // revoga url se existir
      const url = objectUrls.get(k);
      if (url) {
        try { URL.revokeObjectURL(url); } catch (_) { }
        objectUrls.delete(k);
      }

      syncInputFiles();
      renderDocs();
    }

    function viewFileByKey(k) {
      const f = selectedFiles.find(x => fileKey(x) === k);
      if (!f) return;

      let url = objectUrls.get(k);
      if (!url) {
        url = URL.createObjectURL(f);
        objectUrls.set(k, url);
      }
      // abre numa nova aba (imagem e pdf abrem ok)
      window.open(url, "_blank", "noopener");
    }

    if (btnAddDocs && docsInput) {
      btnAddDocs.addEventListener("click", () => docsInput.click());
    }

    if (docsInput) {
      docsInput.addEventListener("change", () => {
        addFiles(docsInput.files);
        // reseta o input pra permitir re-selecionar o mesmo arquivo depois de remover
        docsInput.value = "";
        syncInputFiles();
      });
    }

    if (docsList) {
      docsList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-doc-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-doc-action");
        const k = btn.getAttribute("data-doc-key") || "";

        if (action === "remove") removeFileByKey(k);
        if (action === "view") viewFileByKey(k);
      });
    }

    // ===== Fluxo salvar e criar empréstimo =====
    let abrirNovoEmprestimoDepois = false;

    btnSalvarECriar.addEventListener("click", () => {
      abrirNovoEmprestimoDepois = true;
      form.requestSubmit();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        // FormData já leva os arquivos pelo input name="documentos[]"
        // mas como a gente controla selectedFiles, garantimos sincronizado:
        syncInputFiles();

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

        // limpa docs
        selectedFiles = [];
        syncInputFiles();
        revokeAllUrls();
        renderDocs();

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

        GestorModal.open("modalNovoEmprestimo");

        const modalEmp = document.getElementById("modalNovoEmprestimo");
        if (modalEmp) {
          const selectCliente = modalEmp.querySelector('select[name="cliente_id"]');
          if (selectCliente && novoClienteId) {
            selectCliente.innerHTML = `
              <option value="">Selecione o cliente</option>
              <option value="${novoClienteId}">${esc(nomeDigitado || "Cliente")}</option>
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

    // estado inicial docs
    renderDocs();
  }

  // expõe
  window.injectModalNovoCliente = injectModalNovoCliente;

  // handler pro index.js
  window.openNovoCliente = function openNovoCliente() {
    injectModalNovoCliente();
    GestorModal.open("modalNovoCliente");
  };
})();
