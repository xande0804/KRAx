(function () {
  const list = document.getElementById("clientesList");
  const countEl = document.getElementById("clientesCount");
  const input = document.getElementById("clientesSearch");
  if (!list) return;

  const API = "/KRAx/public/api.php";

  let items = [];

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function onlyDigits(v) {
    return String(v ?? "").replace(/\D+/g, "");
  }

  // ✅ Validação + normalização BR p/ wa.me
  // Aceita:
  // - 10 ou 11 dígitos (DDD + número) -> vira 55 + digits
  // - 12 ou 13 dígitos começando com 55 -> mantém
  // Caso contrário: inválido
  function toWaNumberOrEmpty(phoneRaw) {
    const d = onlyDigits(phoneRaw);
    if (!d) return "";

    // já com DDI BR
    if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;

    // sem DDI, padrão BR
    if (d.length === 10 || d.length === 11) return "55" + d;

    return ""; // inválido
  }

  function wppSvg() {
    // SVG "oficial" (marca WhatsApp) em formato ícone circular
    return `
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path class="wpp-bg" d="M16 2.667C8.636 2.667 2.667 8.636 2.667 16c0 2.343.607 4.634 1.759 6.661L3.2 29.333l6.829-1.2A13.28 13.28 0 0 0 16 29.333c7.364 0 13.333-5.969 13.333-13.333C29.333 8.636 23.364 2.667 16 2.667z"/>
        <path class="wpp-fg" d="M12.03 9.733c-.34-.76-.698-.774-1.024-.788-.264-.011-.566-.01-.868-.01-.302 0-.792.114-1.206.57-.415.456-1.584 1.548-1.584 3.776s1.622 4.384 1.847 4.688c.226.304 3.13 5.017 7.713 6.833 3.81 1.51 4.587 1.21 5.415 1.133.828-.076 2.67-1.09 3.045-2.142.377-1.053.377-1.956.264-2.142-.113-.19-.414-.304-.867-.532-.452-.228-2.67-1.32-3.082-1.472-.415-.152-.717-.228-1.02.228-.303.456-1.17 1.472-1.434 1.776-.264.304-.528.342-.98.114-.453-.228-1.912-.706-3.64-2.257-1.345-1.205-2.252-2.694-2.516-3.15-.264-.456-.028-.704.198-.93.203-.204.452-.532.679-.798.226-.266.302-.456.453-.76.151-.304.076-.57-.038-.798-.113-.228-1.002-2.489-1.375-3.32z"/>
      </svg>
    `;
  }

  function lockSvg() {
    // Cadeado simples (inline) p/ indicar bloqueado
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9zm3 4a2 2 0 012 2 2 2 0 01-1 1.732V19a1 1 0 11-2 0v-2.268A2 2 0 0110 15a2 2 0 012-2z"/>
      </svg>
    `;
  }

  function render(clientes) {
    list.innerHTML = "";

    clientes.forEach((c) => {
      const nome = escapeHtml(c.nome);
      const telefoneRaw = c.telefone || "";
      const telefone = escapeHtml(telefoneRaw || "—");
      const cpf = escapeHtml(c.cpf || "");

      const wa = toWaNumberOrEmpty(telefoneRaw);
      const waLink = wa ? `https://wa.me/${wa}` : "";

      const article = document.createElement("article");
      article.className = "list-item";
      article.setAttribute("data-filter", `${nome} ${telefone} ${cpf}`.toLowerCase());

      // ✅ WhatsApp ou bloqueado (cadeado)
      const wppBtn = waLink
        ? `
          <a
            class="iconbtn iconbtn--wpp"
            href="${waLink}"
            target="_blank"
            rel="noopener"
            title="Abrir WhatsApp"
            aria-label="Abrir WhatsApp"
          >
            ${wppSvg()}
          </a>
        `
        : `
          <span
            class="iconbtn iconbtn--lock is-disabled"
            title="Telefone inválido / ausente"
            aria-label="Telefone inválido / ausente"
          >
            ${lockSvg()}
          </span>
        `;

      article.innerHTML = `
        <div class="list-item__main">
          <div class="list-item__title">
            <strong>${nome}</strong>
            ${c.tem_emprestimo_ativo == 1
              ? `<span class="badge badge--active">Empréstimo ativo</span>`
              : `<span class="badge">Sem empréstimo</span>`
            }
          </div>
          <div class="list-item__sub">${telefone}</div>
        </div>

        <div class="list-item__actions">
          ${wppBtn}

          <button class="linkbtn" type="button" data-modal-open="detalhesCliente" data-cliente-id="${c.id}">
            👁️ Detalhes
          </button>

          <button class="linkbtn" type="button" data-modal-open="novoEmprestimo" data-cliente-id="${c.id}" data-cliente-nome="${nome}">
            💸 Empréstimo
          </button>
        </div>
      `;

      list.appendChild(article);
    });

    items = Array.from(list.querySelectorAll(".list-item"));
    if (countEl) countEl.textContent = String(items.length);
    filtrar();
  }

  async function carregar() {
    const res = await fetch(`${API}?route=clientes/listar`);
    const json = await res.json();

    if (!json.ok) {
      alert(json.mensagem || "Erro ao carregar clientes");
      return;
    }

    render(json.dados || []);
  }

  function filtrar() {
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    let visible = 0;

    items.forEach((item) => {
      const hay = item.getAttribute("data-filter") || "";
      const show = hay.includes(q);
      item.style.display = show ? "" : "none";
      if (show) visible++;
    });

    if (countEl) countEl.textContent = String(visible);
  }

  if (input) input.addEventListener("input", filtrar);

  window.refreshClientesList = function refreshClientesList() {
    const q = input ? input.value : "";
    carregar().finally(() => {
      if (input) input.value = q;
      filtrar();
    });
  };

  carregar();
})();
