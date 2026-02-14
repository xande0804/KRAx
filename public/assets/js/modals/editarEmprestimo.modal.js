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

    const totalC = Math.round(totalComJuros * 100);

    const baseC = Math.floor(totalC / q);
    const restoC = totalC - (baseC * q);

    const base = baseC / 100;
    const ultima = (baseC + restoC) / 100;

    return { tipoV: t, qtd: q, totalComJuros, totalC, base, ultima, restoC };
  }

  function isDateYMD(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
  }

  function setRegraUI(modal, tipoV) {
    const t = String(tipoV || "").trim().toUpperCase();

    const boxDate = modal.querySelector('[data-edit="regra_box_date"]');
    const boxWeek = modal.querySelector('[data-edit="regra_box_week"]');

    const inputDate = modal.querySelector('[data-edit="regra_date"]');
    const inputWeek = modal.querySelector('[data-edit="regra_week"]');

    const hint = modal.querySelector('[data-edit="regra_hint"]');
    const label = modal.querySelector('[data-edit="regra_label"]');

    if (t === "SEMANAL") {
      if (label) label.textContent = "Regra do vencimento (semanal)";
      if (hint) hint.textContent = "Informe 1–6 (Segunda a Sábado).";
      if (boxDate) boxDate.style.display = "none";
      if (boxWeek) boxWeek.style.display = "";
      if (inputWeek) {
        inputWeek.min = "1";
        inputWeek.max = "6";
        inputWeek.placeholder = "1 a 6";
      }
    } else {
      // DIARIO ou MENSAL → regra é DATA (primeiro vencimento)
      const nomeTipo = t || "—";
      if (label) label.textContent = `Primeiro vencimento (${nomeTipo})`;
      if (hint) hint.textContent = "Selecione uma data (YYYY-MM-DD).";
      if (boxWeek) boxWeek.style.display = "none";
      if (boxDate) boxDate.style.display = "";
    }
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
            <p class="modal__subtitle">Ajuste parcelas, juros e vencimento quando o cliente renegociar.</p>
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
                Obs: Parcelas serão recalculadas automaticamente (quando permitido).
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

            <!-- ✅ NOVO: vencimento seguindo regra do backend -->
            <div class="field">
              <label data-edit="regra_label">Primeiro vencimento</label>

              <div data-edit="regra_box_date">
                <input
                  data-edit="regra_date"
                  type="date"
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <div data-edit="regra_box_week" style="display:none;">
                <input
                  data-edit="regra_week"
                  type="number"
                  min="1"
                  max="6"
                  step="1"
                  placeholder="1 a 6"
                />
              </div>

              <!-- name real enviado -->
              <input type="hidden" name="regra_vencimento" data-edit="regra_vencimento_hidden" value="" />

              <div class="muted" data-edit="regra_hint" style="margin-top:6px;"></div>
            </div>

            <div class="field">
              <label>Tipo de vencimento</label>
              <input readonly data-edit="tipo_vencimento" value="—" />
              <div class="muted" style="margin-top:6px;">
                Obs: O tipo do vencimento não muda aqui (apenas a regra).
              </div>
            </div>

            <div class="field form-span-2">
              <label>Observação (opcional)</label>
              <textarea
                name="observacao"
                data-edit="observacao"
                rows="3"
                placeholder="Ex.: Renegociação / Ajuste de vencimento..."
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

    function syncHiddenRegra() {
      const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();

      const hidden = modal.querySelector('[data-edit="regra_vencimento_hidden"]');
      const inputDate = modal.querySelector('[data-edit="regra_date"]');
      const inputWeek = modal.querySelector('[data-edit="regra_week"]');

      let v = "";

      if (tipoV === "SEMANAL") {
        v = String(inputWeek?.value ?? "").trim();
      } else {
        v = String(inputDate?.value ?? "").trim();
      }

      if (hidden) hidden.value = v;
      return v;
    }

    const form = modal.querySelector("#formEditarEmprestimo");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const btn = modal.querySelector("#btnSalvarEdicaoEmprestimo");
        if (btn) btn.disabled = true;

        // garante hidden atualizado
        const regra = syncHiddenRegra();
        const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();

        if (!regra) {
          if (btn) btn.disabled = false;
          onError("Informe a regra do vencimento.");
          return;
        }

        // valida conforme backend
        if (tipoV === "SEMANAL") {
          const dow = parseInt(regra, 10);
          if (!(Number.isFinite(dow) && dow >= 1 && dow <= 6)) {
            if (btn) btn.disabled = false;
            onError("regra_vencimento semanal deve ser 1-6 (Segunda a Sábado).");
            return;
          }
        } else {
          if (!isDateYMD(regra)) {
            if (btn) btn.disabled = false;
            onError("regra_vencimento deve ser uma data no formato YYYY-MM-DD.");
            return;
          }
        }

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
        onSuccess(json.mensagem || "Empréstimo atualizado!");

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

    // listeners pra regra -> manter hidden sempre certo
    const regraDate = modal.querySelector('[data-edit="regra_date"]');
    const regraWeek = modal.querySelector('[data-edit="regra_week"]');
    if (regraDate) regraDate.addEventListener("input", syncHiddenRegra);
    if (regraWeek) regraWeek.addEventListener("input", syncHiddenRegra);

    modal._setEdit = setEdit;
    modal._refreshPreview = refreshPreview;
    modal._setRegraUI = (tipoV) => setRegraUI(modal, tipoV);
    modal._syncHiddenRegra = syncHiddenRegra;
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
    const setRegraUIFn = modal._setRegraUI || function () { };
    const syncHiddenRegra = modal._syncHiddenRegra || function () { };

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

          if (!payload?.clienteNome && cli.nome) setEdit("cliente_nome", cli.nome);
          if (payload?.quantidadeParcelas == null && emp.quantidade_parcelas != null) setEdit("quantidade_parcelas", String(emp.quantidade_parcelas));
          if (payload?.jurosPct == null && emp.porcentagem_juros != null) setEdit("porcentagem_juros", String(emp.porcentagem_juros));
          if (!payload?.clienteId && emp.cliente_id != null) modal.dataset.clienteId = String(emp.cliente_id);

          // ✅ regra atual do vencimento (formato do backend)
          const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();
          const regraAtual = String(emp.regra_vencimento ?? "").trim();

          // atualiza UI (tipo e qual input mostrar)
          setEdit("tipo_vencimento", String(modal.dataset.tipoVencimento || "—"));
          setRegraUIFn(modal.dataset.tipoVencimento);

          // preenche input correto
          const inputDate = modal.querySelector('[data-edit="regra_date"]');
          const inputWeek = modal.querySelector('[data-edit="regra_week"]');

          if (tipoV === "SEMANAL") {
            if (inputWeek) inputWeek.value = regraAtual;
          } else {
            // DIARIO/MENSAL: regra é data
            if (inputDate) inputDate.value = regraAtual;
          }

          // joga no hidden name="regra_vencimento"
          syncHiddenRegra();
        }
      } catch (e) {
        console.error(e);
        // segue mesmo assim
      }
    } else {
      // já tem tipo pelo payload
      setEdit("tipo_vencimento", String(modal.dataset.tipoVencimento || "—"));
      setRegraUIFn(modal.dataset.tipoVencimento);
      syncHiddenRegra();
    }

    refreshPreview();
    GestorModal.open("modalEditarEmprestimo");
  }

  // expõe global
  window.injectModalEditarEmprestimo = injectModalEditarEmprestimo;
  window.openEditarEmprestimo = openEditarEmprestimo;
})();
