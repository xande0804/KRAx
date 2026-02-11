<?php
$activePage = 'emprestimos';
$pageTitle  = 'GestorPro • Empréstimos';

$pageCss = [
  'list',
  'badges',
  'tabs',
  'emprestimo-detalhes',
];

$pageJs = [
  'pages/emprestimos',
];

require __DIR__ . '/layouts/header.php';
?>

<div class="page-row">
  <div class="page-head">
    <h1 class="page-title">Empréstimos</h1>
    <p class="page-sub" id="emprestimosCount">...</p>
  </div>

  <button class="btn btn--primary" type="button" data-modal-open="novoEmprestimo">
    + Novo empréstimo
  </button>
</div>

<!-- Tabs/Filtros -->
<div class="tabs" id="emprestimosTabs">
  <button class="tab is-active" data-filter="all" id="tabAll">
    Todos (...)
  </button>
  <button class="tab" data-filter="ativo" id="tabAtivo">
    Ativos (...)
  </button>
  <button class="tab" data-filter="atrasado" id="tabAtrasado">
    Atrasados (...)
  </button>
  <button class="tab" data-filter="quitado" id="tabQuitado">
    Quitados (...)
  </button>
</div>

<!-- Lista -->
<section class="list" id="emprestimosList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>
