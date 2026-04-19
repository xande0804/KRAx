<?php
$activePage = 'emprestimos';
$pageTitle  = 'GestorPro • Empréstimos';

$pageCss = [
  'list',
  'badges',
  'tabs',
  'emprestimo-detalhes',
  'badges',
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

<div class="page-row" style="align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
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

  <div style="min-width: 220px;">
    <select id="emprestimosGrupoFilter" class="input">
      <option value="todos">Todos os grupos</option>
      <option value="antigo">Apenas grupo antigo</option>
      <option value="novo">Apenas grupo novo</option>
    </select>
  </div>
</div>

<!-- Lista -->
<section class="list" id="emprestimosList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>