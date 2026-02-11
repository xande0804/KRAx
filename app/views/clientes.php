<?php
$activePage = 'clientes';
$pageTitle  = 'GestorPro • Clientes';

$pageCss = [
  'cards',
  'list',
  'cliente-detalhes',
  'emprestimo-detalhes'
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

<div class="searchbar">
  <span class="searchbar__icon">🔎</span>
  <input
    id="clientesSearch"
    class="input input--search"
    type="text"
    placeholder="Buscar por nome, CPF ou telefone..."
  />
</div>

<section class="list" id="clientesList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>
