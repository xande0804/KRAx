// public/assets/js/pages/dashboard.js
(function () {
  const elClientes = document.getElementById("statClientes");
  const elAtivos = document.getElementById("statAtivos");
  const elHoje = document.getElementById("statHoje");
  const elAtrasados = document.getElementById("statAtrasados");

  if (!elClientes && !elAtivos && !elHoje && !elAtrasados) return;

  function setText(el, v) {
    if (el) el.textContent = String(v ?? "—");
  }

  async function safeReadJson(res) {
    const text = await res.text();
    try {
      return { ok: true, json: JSON.parse(text), raw: text };
    } catch (e) {
      console.error("❌ Resposta NÃO é JSON:", text);
      return { ok: false, json: null, raw: text };
    }
  }

  async function fetchOk(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const parsed = await safeReadJson(res);
    if (!parsed.ok || !parsed.json) throw new Error("Resposta inválida do servidor.");
    if (!parsed.json.ok) throw new Error(parsed.json.mensagem || "Erro no servidor.");
    return parsed.json.dados;
  }

  async function carregar() {
    try {
      // Clientes
      if (elClientes) {
        const clientes = await fetchOk("/KRAx/public/api.php?route=clientes/listar");
        setText(elClientes, Array.isArray(clientes) ? clientes.length : 0);
      }

      // Empréstimos ativos
      if (elAtivos) {
        const ativos = await fetchOk("/KRAx/public/api.php?route=emprestimos/listar&filtro=ATIVO");
        setText(elAtivos, Array.isArray(ativos) ? ativos.length : 0);
      }

      // Vencimentos de hoje + atrasados (rota real do seu api.php)
      if (elHoje || elAtrasados) {
        const dadosVenc = await fetchOk("/KRAx/public/api.php?route=vencimentos/hoje");

        const atrasadosArr = Array.isArray(dadosVenc?.atrasados) ? dadosVenc.atrasados : [];
        const hojeArr = Array.isArray(dadosVenc?.lista) ? dadosVenc.lista : [];

        // Vencem hoje = quantidade de parcelas que vencem hoje
        if (elHoje) setText(elHoje, hojeArr.length);

        // ✅ Atrasados = quantidade de CLIENTES únicos atrasados (não parcelas)
        if (elAtrasados) {
          const clientesUnicos = new Set(
            atrasadosArr
              .map((x) => Number(x?.cliente_id || 0))
              .filter((id) => id > 0)
          );
          setText(elAtrasados, clientesUnicos.size);
        }
      }
    } catch (e) {
      console.error(e);

      // não deixa "..." eterno
      if (elClientes && elClientes.textContent.trim() === "...") setText(elClientes, "—");
      if (elAtivos && elAtivos.textContent.trim() === "...") setText(elAtivos, "—");
      if (elHoje && elHoje.textContent.trim() === "...") setText(elHoje, "—");
      if (elAtrasados && elAtrasados.textContent.trim() === "...") setText(elAtrasados, "—");
    }
  }

  carregar();
})();
