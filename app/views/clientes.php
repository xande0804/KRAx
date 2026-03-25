<?php
$activePage = 'clientes';
$pageTitle  = 'GestorPro • Clientes';

$pageCss = [
  'cards',
  'list',
  'cliente-detalhes',
  'emprestimo-detalhes',
  'badges',
];

$pageJs = [
  'pages/clientes'
];

require __DIR__ . '/layouts/header.php';
?>

<div class="page-row">
  <div class="page-head">
    <h1 class="page-title">Clientes</h1>
    <p class="page-sub">
      <span id="clientesCount">0</span> clientes cadastrados
    </p>
  </div>

  <button class="btn btn--primary" type="button" data-modal-open="novoCliente">
    + Novo cliente
  </button>
</div>

<div class="page-row" style="align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 12px;">
  
  <!-- Busca -->
  <div class="searchbar" style="flex: 1; min-width: 260px;">
    <span class="searchbar__icon">🔎</span>
    <input
      id="clientesSearch"
      class="input input--search"
      type="text"
      placeholder="Buscar por nome, CPF ou telefone..."
    />
  </div>

  <!-- Filtro grupo (direita) -->
  <div style="min-width: 220px;">
    <select id="clientesGrupoFilter" class="input">
      <option value="todos">Todos os grupos</option>
      <option value="antigo">Apenas grupo antigo</option>
      <option value="novo">Apenas grupo novo</option>
    </select>
  </div>

</div>

<section class="list" id="clientesList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>