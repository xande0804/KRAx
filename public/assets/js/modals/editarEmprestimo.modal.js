// public/assets/js/modals/editarEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const onSuccess = window.onSuccess || function () { };
  const GestorModal = window.GestorModal;

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function money(v) {
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v ?? "");
    return s.includes("R$") ? s : (s ? `R$ ${s}` : "—");
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function safeReadJson(res) {
    const text = await res.text();
    try {
      return { ok: true, json: JSON.parse(text), raw: text };
    } catch (e) {
      console.error("❌ Resposta NÃO é JSON. Conteúdo completo abaixo:");
      console.error(text);
      const snippet = String(text || "").replace(/\s+/g, " ").slice(0, 180);
      return { ok: false, error: e, raw: text, snippet };
    }
  }

  function closeAnyOpenModal() {
    document.querySelectorAll(".modal").forEach((m) => {
      const isHidden = m.getAttribute("aria-hidden");
      if (isHidden === "false") {
        const id = m.id;
        if (id && GestorModal && typeof GestorModal.close === "function") {
          GestorModal.close(id);
        }
      }
    });
  }

  // ✅ regra do seu sistema + regra do último centavo
  function calcPreview(principal, jurosPct, qtd, tipoV) {
    const p = toNumber(principal);
    const j = toNumber(jurosPct);
    const q = Math.max(1, parseInt(qtd || 1, 10) || 1);
    const t = String(tipoV || "").trim().toUpperCase();

    let totalComJuros = 0;

    if (t === "MENSAL") {
      const jurosInteiro = p * (j / 100);
      totalComJuros = p + (jurosInteiro * q);
    } else {
      totalComJuros = p * (1 + (j / 100));
    }

    // centavos
    const totalC = Math.round(totalComJuros * 100);

    const baseC = Math.floor(totalC / q);
    const restoC = totalC - (baseC * q);

    const base = baseC / 100;
    const ultima = (baseC + restoC) / 100;

    return {
      tipoV: t,
      qtd: q,
      totalComJuros,
      totalC,
      base,
      ultima,
      restoC
    };
  }

  function injectModalEditarEmprestimo() {
    if (qs("#modalEditarEmprestimo")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalEditarEmprestimo";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Editar empréstimo</h3>
            <p class="modal__subtitle">Ajuste parcelas e juros quando o cliente renegociar.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalEditarEmprestimo">×</button>
        </header>

        <form class="modal__body" id="formEditarEmprestimo">
          <input type="hidden" name="emprestimo_id" data-edit="emprestimo_id" />
          <input type="hidden" name="recalcular_parcelas" value="1" />

          <div class="form-grid">
            <div class="field form-span-2">
              <label>Cliente</label>
              <input readonly data-edit="cliente_nome" value="—" />
            </div>

            <div class="field">
              <label>Quantidade de parcelas</label>
              <input
                name="quantidade_parcelas"
                data-edit="quantidade_parcelas"
                type="number"
                min="1"
                step="1"
                required
              />
              <div class="muted" style="margin-top:6px;">
                Obs: Parcelas serão recalculadas automaticamente.
              </div>
            </div>

            <div class="field">
              <label>Juros (%)</label>
              <input
                name="porcentagem_juros"
                data-edit="porcentagem_juros"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <div class="muted" style="margin-top:6px;">
                Obs: Juros calculado de acordo com o TIPO.
              </div>
            </div>

            <div class="field form-span-2">
              <label>Observação (opcional)</label>
              <textarea
                name="observacao"
                data-edit="observacao"
                rows="3"
                placeholder="Ex.: Renegociação / Quitação antecipada..."
              ></textarea>
            </div>

            <div class="field form-span-2">
              <div class="muted" data-edit="preview" style="margin-top:-4px;"></div>
            </div>
          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalEditarEmprestimo">Cancelar</button>
            <button class="btn btn--primary" type="submit" id="btnSalvarEdicaoEmprestimo">
              Salvar alterações
            </button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const setEdit = (field, value) => {
      const el = modal.querySelector(`[data-edit="${field}"]`);
      if (!el) return;
      const tag = (el.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        el.value = value ?? "";
      } else {
        el.textContent = value ?? "";
      }
    };

    function setPreview(html) {
      const el = modal.querySelector(`[data-edit="preview"]`);
      if (el) el.innerHTML = html || "";
    }

    function refreshPreview() {
      const principal = toNumber(modal.dataset.principal || 0);
      const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();

      const qtd = toNumber(modal.querySelector(`[data-edit="quantidade_parcelas"]`)?.value || 1);
      const jurosPct = toNumber(modal.querySelector(`[data-edit="porcentagem_juros"]`)?.value || 0);

      const c = calcPreview(principal, jurosPct, qtd, tipoV);

      const parcelasTxt =
        (c.restoC > 0 && c.qtd > 1 && c.ultima !== c.base)
          ? `${money(c.base)} (última: ${money(c.ultima)})`
          : `${money(c.base)}`;

      setPreview(`
        <div><strong>Prévia:</strong></div>
        <div style="margin-top:6px;">
          <div><strong>Tipo:</strong> ${esc(tipoV || "—")}</div>
          <div><strong>Total c/ juros:</strong> ${esc(money(c.totalComJuros))}</div>
          <div><strong>Prestação sugerida:</strong> ${esc(parcelasTxt)}</div>
        </div>
      `);
    }

    const form = modal.querySelector("#formEditarEmprestimo");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const btn = modal.querySelector("#btnSalvarEdicaoEmprestimo");
        if (btn) btn.disabled = true;

        const fd = new FormData(form);

        // ✅ sempre recalcula automaticamente (sem checkbox)
        fd.set("recalcular_parcelas", "1");

        const res = await fetch("/KRAx/public/api.php?route=emprestimos/atualizar", {
          method: "POST",
          body: fd,
          headers: { "Accept": "application/json" }
        });

        const parsed = await safeReadJson(res);

        if (btn) btn.disabled = false;

        if (!parsed.ok) {
          onError(`Servidor retornou resposta inválida (não-JSON). Veja o console. ${parsed.snippet ? "Trecho: " + parsed.snippet : ""}`);
          return;
        }

        const json = parsed.json;

        if (!json.ok) {
          onError(json.mensagem || "Erro ao atualizar empréstimo");
          return;
        }

        GestorModal.close("modalEditarEmprestimo");
        onSuccess("Empréstimo atualizado!");

        // reabre detalhes atualizado
        const emprestimoId = String(modal.dataset.emprestimoId || fd.get("emprestimo_id") || "").trim();
        const origem = String(modal.dataset.origem || "emprestimos").trim();
        const clienteId = String(modal.dataset.clienteId || "").trim();

        if (emprestimoId && typeof window.openDetalhesEmprestimo === "function") {
          setTimeout(() => {
            window.openDetalhesEmprestimo(emprestimoId, { origem, clienteId });
          }, 120);
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        const btn = modal.querySelector("#btnSalvarEdicaoEmprestimo");
        if (btn) btn.disabled = false;
        onError("Erro de conexão com o servidor");
      }
    });

    // listeners pra preview
    const qtdInput = modal.querySelector(`[data-edit="quantidade_parcelas"]`);
    const jurosInput = modal.querySelector(`[data-edit="porcentagem_juros"]`);
    if (qtdInput) qtdInput.addEventListener("input", refreshPreview);
    if (jurosInput) jurosInput.addEventListener("input", refreshPreview);

    modal._setEdit = setEdit;
    modal._refreshPreview = refreshPreview;
  }

  // payload pode vir com dados já prontos, mas o modal também busca do backend se precisar
  async function openEditarEmprestimo(payload) {
    const modal = document.getElementById("modalEditarEmprestimo");
    if (!modal) return;

    closeAnyOpenModal();

    const emprestimoId = String(payload?.emprestimoId || payload?.emprestimo_id || "").trim();
    if (!emprestimoId) {
      onError("Não foi possível abrir edição: emprestimoId vazio.");
      return;
    }

    const setEdit = modal._setEdit || function () { };
    const refreshPreview = modal._refreshPreview || function () { };

    modal.dataset.emprestimoId = emprestimoId;
    modal.dataset.origem = String(payload?.origem || "emprestimos");
    modal.dataset.clienteId = String(payload?.clienteId || "");

    // valores iniciais (se tiver)
    setEdit("emprestimo_id", emprestimoId);
    setEdit("cliente_nome", payload?.clienteNome || "—");
    setEdit("quantidade_parcelas", String(payload?.quantidadeParcelas ?? ""));
    setEdit("porcentagem_juros", String(payload?.jurosPct ?? ""));
    setEdit("observacao", "");

    // para preview (se tiver)
    modal.dataset.principal = String(payload?.principal ?? "");
    modal.dataset.tipoVencimento = String(payload?.tipoVencimento ?? "");

    // se não tiver info suficiente, busca detalhes do empréstimo
    const needFetch = !modal.dataset.principal || !modal.dataset.tipoVencimento;

    if (needFetch) {
      try {
        const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(emprestimoId)}`);
        const parsed = await safeReadJson(res);

        if (parsed.ok && parsed.json?.ok) {
          const emp = parsed.json?.dados?.emprestimo || {};
          const cli = parsed.json?.dados?.cliente || {};

          modal.dataset.principal = String(emp.valor_principal ?? "");
          modal.dataset.tipoVencimento = String(emp.tipo_vencimento ?? "");

          // se payload não trouxe, preenche
          if (!payload?.clienteNome && cli.nome) setEdit("cliente_nome", cli.nome);
          if (payload?.quantidadeParcelas == null && emp.quantidade_parcelas != null) setEdit("quantidade_parcelas", String(emp.quantidade_parcelas));
          if (payload?.jurosPct == null && emp.porcentagem_juros != null) setEdit("porcentagem_juros", String(emp.porcentagem_juros));
          if (!payload?.clienteId && emp.cliente_id != null) modal.dataset.clienteId = String(emp.cliente_id);
        }
      } catch (e) {
        console.error(e);
        // segue mesmo assim
      }
    }

    refreshPreview();
    GestorModal.open("modalEditarEmprestimo");
  }

  // expõe global
  window.injectModalEditarEmprestimo = injectModalEditarEmprestimo;
  window.openEditarEmprestimo = openEditarEmprestimo;
})();
