<?php
// simula POST
$_POST = [
  'cliente_id' => 1,
  'data_emprestimo' => '2026-02-12',
  'valor_principal' => 1000,
  'porcentagem_juros' => 30,
  'quantidade_parcelas' => 5,
  'tipo_vencimento' => 'SEMANAL',
  'regra_vencimento' => '5', // primeiro vencimento
];

$_GET['route'] = 'emprestimos/criar';
require_once __DIR__ . '/api.php';
