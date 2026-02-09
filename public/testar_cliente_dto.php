<?php
require_once __DIR__ . '/../app/models/dtos/ClienteDTO.php';

try {
    $dto = new ClienteDTO([
        'nome' => ' João da Silva ',
        'cpf' => '',
        'telefone' => '  '
    ]);

    $dto->validar();

    echo "<pre>";
    var_dump($dto);
    echo "</pre>";

    echo "DTO OK";
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage();
}
