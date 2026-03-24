<?php

$activePage = 'inicio';
$pageTitle  = 'GestorPro • Início';

$pageCss = [
  'badges',
  'cards', // tem os cards stat + action-card
];

$pageJs = [
  'pages/dashboard',
];

require __DIR__ . '/layouts/header.php';
?>

<section class="page-head">
  <h1 class="page-title">Bem-vindo ao GestorPro</h1>
  <p class="page-sub">
    Gerencie seus clientes e empréstimos de forma rápida.
  </p>
</section>

<!-- Cards (no futuro o backend troca os números) -->
<section class="grid grid--4 gap-12">
  <article class="card card--stat">
    <div class="stat__label">Clientes</div>
    <div class="stat__value" id="statClientes">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label">Empréstimos ativos</div>
    <div class="stat__value" id="statAtivos">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label">Vencem hoje</div>
    <div class="stat__value" id="statHoje">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label stat__label--danger">Atrasados</div>
    <div class="stat__value stat__value--danger" id="statAtrasados">
      ...
    </div>
  </article>
</section>

<section class="section">
  <h2 class="section-title">Ações rápidas</h2>

  <div class="grid grid--4 gap-16">
    <a class="action-card" href="/KRAx/app/views/clientes.php">
      <div class="action-card__icon">👥</div>
      <div class="action-card__title">Clientes</div>
    </a>

    <a class="action-card" href="/KRAx/app/views/emprestimos.php">
      <div class="action-card__icon">💸</div>
      <div class="action-card__title">Empréstimos</div>
    </a>

    <a class="action-card" href="/KRAx/app/views/vencimentos.php">
      <div class="action-card__icon">📅</div>
      <div class="action-card__title">Vencimentos</div>
    </a>

    <button
      class="btn btn--primary action-card action-card--primary"
      type="button"
      data-modal-open="novoEmprestimo"
    >
      + Novo empréstimo
    </button>
  </div>
</section>

<?php require __DIR__ . '/layouts/footer.php'; ?>
