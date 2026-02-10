(function () {
  const list = document.getElementById("clientesList");
  const countEl = document.getElementById("clientesCount");
  const input = document.getElementById("clientesSearch");
  if (!list) return;

  const API = "/KRAx/public/api.php"; // se der erro, a gente ajusta

  let items = [];

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render(clientes) {
    list.innerHTML = "";

    clientes.forEach((c) => {
      const nome = escapeHtml(c.nome);
      const telefone = escapeHtml(c.telefone || "—");
      const cpf = escapeHtml(c.cpf || "");

      const article = document.createElement("article");
      article.className = "list-item";
      article.setAttribute("data-filter", `${nome} ${telefone} ${cpf}`.toLowerCase());

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
  }

  async function carregar() {
    const res = await fetch(`${API}?route=clientes/listar`); // isso é um endpoint
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

  carregar();
})();
