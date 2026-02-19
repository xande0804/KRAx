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

  // ✅ NOVO: normaliza o que vier do backend pra caber no <input type="date">
  function normalizeDateForInput(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    if (isDateYMD(s)) return s;

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }

    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = m[1], mm = m[2], yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    return "";
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
      const nomeTipo = t || "—";
      if (label) label.textContent = `Primeiro vencimento (${nomeTipo})`;
      if (hint) hint.textContent = "Selecione uma data (YYYY-MM-DD).";
      if (boxWeek) boxWeek.style.display = "none";
      if (boxDate) boxDate.style.display = "";
      if (inputDate) inputDate.placeholder = "YYYY-MM-DD";
    }
  }

  // =========================
  // ✅ OPTION D (ALERTA IMPACTO)
  // =========================
  function onlyDate(yyyyMMdd) {
    return String(yyyyMMdd || "").slice(0, 10);
  }

  function toCents(v) {
    const n = toNumber(v);
    return Math.round(n * 100);
  }

  function moneyFromCents(c) {
    return money((Number(c) || 0) / 100);
  }

  // usa parcelas do backend pra estimar:
  // - quantas estão pagas
  // - quanto do principal já foi amortizado (MENSAL: valor_pago cobre jurosUnit primeiro)
  function buildMensalSnapshot(principal, jurosPct, qtdAtual, parcelasArr) {
    const p = toNumber(principal);
    const q = Math.max(1, parseInt(qtdAtual || 1, 10) || 1);
    const j = toNumber(jurosPct);

    const jurosUnit = p * (j / 100);
    const amortUnit = p / q;

    let pagasCheias = 0;
    let principalPago = 0;

    const parcelas = Array.isArray(parcelasArr) ? parcelasArr : [];

    for (const par of parcelas) {
      const st = String(par.status || "").trim().toUpperCase();
      const vpar = toNumber(par.valor_parcela ?? 0);
      const vp = toNumber(par.valor_pago ?? 0);

      const pagaCheia = (st === "PAGA" || st === "QUITADA") || (vpar > 0 && vp >= vpar);
      if (pagaCheia) {
        pagasCheias++;
        // M1: considera amortUnit por parcela paga cheia
        principalPago += amortUnit;
        continue;
      }

      // parcial: paga primeiro jurosUnit, o que passar é principal (limitado ao amortUnit)
      if (vp > 0) {
        const amortParcial = Math.max(0, Math.min(amortUnit, vp - jurosUnit));
        principalPago += amortParcial;
      }
    }

    // limita
    principalPago = Math.max(0, Math.min(p, principalPago));
    const principalRestante = Math.max(0, p - principalPago);

    return { jurosUnit, amortUnit, pagasCheias, principalPago, principalRestante };
  }

  function calcTotalContratoMensal(principal, jurosPct, qtdTotal) {
    const p = toNumber(principal);
    const q = Math.max(1, parseInt(qtdTotal || 1, 10) || 1);
    const j = toNumber(jurosPct);
    const jurosUnit = p * (j / 100);
    return p + jurosUnit * q;
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

    function saveSnapshot() {
      const qtd = String(modal.querySelector(`[data-edit="quantidade_parcelas"]`)?.value ?? "").trim();
      const juros = String(modal.querySelector(`[data-edit="porcentagem_juros"]`)?.value ?? "").trim();
      const obs = String(modal.querySelector(`[data-edit="observacao"]`)?.value ?? "").trim();
      const regra = String(modal.querySelector('[data-edit="regra_vencimento_hidden"]')?.value ?? "").trim();

      modal.dataset.snapshotQtd = qtd;
      modal.dataset.snapshotJuros = juros;
      modal.dataset.snapshotObs = obs;
      modal.dataset.snapshotRegra = regra;
    }

    function isUnchanged() {
      const qtd = String(modal.querySelector(`[data-edit="quantidade_parcelas"]`)?.value ?? "").trim();
      const juros = String(modal.querySelector(`[data-edit="porcentagem_juros"]`)?.value ?? "").trim();
      const obs = String(modal.querySelector(`[data-edit="observacao"]`)?.value ?? "").trim();
      const regra = String(modal.querySelector('[data-edit="regra_vencimento_hidden"]')?.value ?? "").trim();

      return (
        qtd === String(modal.dataset.snapshotQtd || "") &&
        juros === String(modal.dataset.snapshotJuros || "") &&
        obs === String(modal.dataset.snapshotObs || "") &&
        regra === String(modal.dataset.snapshotRegra || "")
      );
    }

    const form = modal.querySelector("#formEditarEmprestimo");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const btn = modal.querySelector("#btnSalvarEdicaoEmprestimo");
        if (btn) btn.disabled = true;

        const regra = syncHiddenRegra();

        // ✅ se não mudou nada, Salvar vira Cancelar
        if (isUnchanged()) {
          if (btn) btn.disabled = false;
          GestorModal.close("modalEditarEmprestimo");
          return;
        }

        const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();

        if (!regra) {
          if (btn) btn.disabled = false;
          onError("Informe a regra do vencimento.");
          return;
        }

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

        // =========================
        // ✅ ALERTA (OPÇÃO D): impacto no total final
        // =========================
        // Só faz “alerta inteligente” no MENSAL (onde faz sentido no teu modelo de juros por parcela)
        // Nos outros tipos, mantém somente o fluxo normal.
        try {
          if (tipoV === "MENSAL" && modal._state && modal._state.emp && Array.isArray(modal._state.parcelas)) {
            const principal = toNumber(modal._state.emp.valor_principal ?? modal.dataset.principal ?? 0);

            const qtdAtual = toNumber(modal._state.emp.quantidade_parcelas ?? modal.dataset.snapshotQtd ?? 0) || toNumber(modal.dataset.snapshotQtd || 1);
            const jurosAtual = toNumber(modal._state.emp.porcentagem_juros ?? modal.dataset.snapshotJuros ?? 0) || toNumber(modal.dataset.snapshotJuros || 0);

            const qtdNova = toNumber(modal.querySelector(`[data-edit="quantidade_parcelas"]`)?.value || 1);
            const jurosNovo = toNumber(modal.querySelector(`[data-edit="porcentagem_juros"]`)?.value || 0);

            // calcula totais (contrato) no teu modelo
            const totalAntes = calcTotalContratoMensal(principal, jurosAtual, qtdAtual);
            const totalDepois = calcTotalContratoMensal(principal, jurosNovo, qtdNova);
            const delta = totalDepois - totalAntes;

            // estimativa das parcelas restantes no M1 (principal restante redistribui)
            const snap = buildMensalSnapshot(principal, jurosAtual, qtdAtual, modal._state.parcelas);

            const pagasCheias = snap.pagasCheias;
            const restAntes = Math.max(0, qtdAtual - pagasCheias);
            const restDepois = Math.max(0, qtdNova - pagasCheias);

            const jurosUnitDepois = principal * (jurosNovo / 100);

            let novaParcelaEst = null;
            if (restDepois > 0) {
              const amortNova = snap.principalRestante / restDepois;
              novaParcelaEst = amortNova + jurosUnitDepois;
            }

            const msg =
              "⚠️ Renegociação vai alterar o total final\n\n" +
              `• Tipo: MENSAL\n` +
              `• Parcelas totais: ${qtdAtual} → ${qtdNova}\n` +
              `• Juros (%): ${jurosAtual} → ${jurosNovo}\n` +
              `• Total do contrato: ${money(totalAntes)} → ${money(totalDepois)} ` +
              `(${delta >= 0 ? "+" : ""}${money(delta)})\n\n` +
              `• Parcelas já pagas (cheias): ${pagasCheias}\n` +
              `• Restantes antes: ${restAntes}\n` +
              `• Restantes depois: ${restDepois}\n` +
              (novaParcelaEst != null ? `• Estimativa nova parcela restante: ${money(novaParcelaEst)}\n` : "") +
              "\nContinuar?";

            // ✅ este é o “alerta” da opção D (um confirm único antes de salvar)
            const ok = confirm(msg);
            if (!ok) {
              if (btn) btn.disabled = false;
              return;
            }
          }
        } catch (e2) {
          // se falhar o alerta, não bloqueia salvamento
          console.warn("Falhou alerta de impacto (opção D). Seguindo sem alert.", e2);
        }

        const fd = new FormData(form);
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

        if (json.dados && typeof json.dados.total_antigo === "number") {
          const d = json.dados;
          alert(
            `Renegociação aplicada!\n\n` +
            `Total antigo: ${money(d.total_antigo)}\n` +
            `Total novo:   ${money(d.total_novo)}\n` +
            `Diferença:    ${money(d.diferenca)}`
          );
        }
        

        GestorModal.close("modalEditarEmprestimo");
        onSuccess(json.mensagem || "Empréstimo atualizado!");

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

    const qtdInput = modal.querySelector(`[data-edit="quantidade_parcelas"]`);
    const jurosInput = modal.querySelector(`[data-edit="porcentagem_juros"]`);
    if (qtdInput) qtdInput.addEventListener("input", refreshPreview);
    if (jurosInput) jurosInput.addEventListener("input", refreshPreview);

    const regraDate = modal.querySelector('[data-edit="regra_date"]');
    const regraWeek = modal.querySelector('[data-edit="regra_week"]');
    if (regraDate) regraDate.addEventListener("input", syncHiddenRegra);
    if (regraWeek) regraWeek.addEventListener("input", syncHiddenRegra);

    modal._setEdit = setEdit;
    modal._refreshPreview = refreshPreview;
    modal._setRegraUI = (tipoV) => setRegraUI(modal, tipoV);
    modal._syncHiddenRegra = syncHiddenRegra;
    modal._saveSnapshot = saveSnapshot;
  }

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
    const saveSnapshot = modal._saveSnapshot || function () { };

    modal.dataset.emprestimoId = emprestimoId;
    modal.dataset.origem = String(payload?.origem || "emprestimos");
    modal.dataset.clienteId = String(payload?.clienteId || "");

    setEdit("emprestimo_id", emprestimoId);
    setEdit("cliente_nome", payload?.clienteNome || "—");
    setEdit("quantidade_parcelas", String(payload?.quantidadeParcelas ?? ""));
    setEdit("porcentagem_juros", String(payload?.jurosPct ?? ""));
    setEdit("observacao", String(payload?.observacao ?? ""));

    modal.dataset.principal = String(payload?.principal ?? "");
    modal.dataset.tipoVencimento = String(payload?.tipoVencimento ?? "");

    const payloadRegra = String(payload?.regraVencimento ?? payload?.regra_vencimento ?? "").trim();

    const needFetch = !modal.dataset.principal || !modal.dataset.tipoVencimento || (!payloadRegra);

    if (needFetch) {
      try {
        const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(emprestimoId)}`);
        const parsed = await safeReadJson(res);

        if (parsed.ok && parsed.json?.ok) {
          const emp = parsed.json?.dados?.emprestimo || {};
          const cli = parsed.json?.dados?.cliente || {};
          const parcelas = Array.isArray(parsed.json?.dados?.parcelas) ? parsed.json.dados.parcelas : [];
          const pagamentos = Array.isArray(parsed.json?.dados?.pagamentos) ? parsed.json.dados.pagamentos : [];

          // ✅ guarda estado pro alerta (opção D)
          modal._state = { emp, cli, parcelas, pagamentos };

          modal.dataset.principal = String(emp.valor_principal ?? "");
          modal.dataset.tipoVencimento = String(emp.tipo_vencimento ?? "");

          if (!payload?.clienteNome && cli.nome) setEdit("cliente_nome", cli.nome);
          if (payload?.quantidadeParcelas == null && emp.quantidade_parcelas != null) setEdit("quantidade_parcelas", String(emp.quantidade_parcelas));
          if (payload?.jurosPct == null && emp.porcentagem_juros != null) setEdit("porcentagem_juros", String(emp.porcentagem_juros));
          if (!payload?.clienteId && emp.cliente_id != null) modal.dataset.clienteId = String(emp.cliente_id);

          const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();
          const regraAtualRaw = String(emp.regra_vencimento ?? "").trim();

          setEdit("tipo_vencimento", String(modal.dataset.tipoVencimento || "—"));
          setRegraUIFn(modal.dataset.tipoVencimento);

          const inputDate = modal.querySelector('[data-edit="regra_date"]');
          const inputWeek = modal.querySelector('[data-edit="regra_week"]');

          if (tipoV === "SEMANAL") {
            if (inputWeek) inputWeek.value = regraAtualRaw;
          } else {
            const normalized = normalizeDateForInput(regraAtualRaw);
            if (inputDate) inputDate.value = normalized;
          }

          syncHiddenRegra();
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // se veio tudo no payload, ainda assim tentamos ter _state mínimo pra alerta
      modal._state = modal._state || {
        emp: {
          valor_principal: modal.dataset.principal,
          tipo_vencimento: modal.dataset.tipoVencimento,
          quantidade_parcelas: payload?.quantidadeParcelas,
          porcentagem_juros: payload?.jurosPct,
          regra_vencimento: payloadRegra,
          cliente_id: payload?.clienteId
        },
        parcelas: [],
        pagamentos: []
      };

      const tipoV = String(modal.dataset.tipoVencimento || "").trim().toUpperCase();

      setEdit("tipo_vencimento", String(modal.dataset.tipoVencimento || "—"));
      setRegraUIFn(modal.dataset.tipoVencimento);

      const inputDate = modal.querySelector('[data-edit="regra_date"]');
      const inputWeek = modal.querySelector('[data-edit="regra_week"]');

      if (tipoV === "SEMANAL") {
        if (inputWeek) inputWeek.value = payloadRegra;
      } else {
        const normalized = normalizeDateForInput(payloadRegra);
        if (inputDate) inputDate.value = normalized;
      }

      syncHiddenRegra();
    }

    refreshPreview();
    saveSnapshot();
    GestorModal.open("modalEditarEmprestimo");
  }

  window.injectModalEditarEmprestimo = injectModalEditarEmprestimo;
  window.openEditarEmprestimo = openEditarEmprestimo;
})();
