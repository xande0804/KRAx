<?php

$url = 'http://localhost/KRAx/public/api.php?route=pagamentos/lancar';

$dados = [
    'emprestimo_id' => 2,
    'parcela_id' => 1,
    'tipo_pagamento' => 'PARCELA',
    'valor_pago' => 50,
    'observacao' => 'pagamento parcial teste'
];

$options = [
    'http' => [
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($dados),
    ],
];

$context = stream_context_create($options);
echo "<pre>";
echo file_get_contents($url, false, $context);
echo "</pre>";
