(async function () {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  try {
    const res = await fetch("/KRAx/public/api.php?route=dashboard/resumo");
    const json = await res.json();

    if (!json.ok) throw new Error(json.mensagem || "Erro ao carregar resumo");

    const d = json.dados;

    setText("statClientes", d.clientes);
    setText("statAtivos", d.emprestimos_ativos);
    setText("statHoje", d.vencem_hoje);
    setText("statAtrasados", d.atrasados);
  } catch (e) {
    setText("statClientes", "—");
    setText("statAtivos", "—");
    setText("statHoje", "—");
    setText("statAtrasados", "—");
    console.error(e);
  }
})();
