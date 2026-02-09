<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../entities/Pagamento.php';

class PagamentoDAO
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::conectar();
    }

    public function criar(Pagamento $p): int
    {
        $sql = "INSERT INTO pagamentos (emprestimo_id, parcela_id, valor_pago, tipo_pagamento, observacao)
                VALUES (:emprestimo_id, :parcela_id, :valor_pago, :tipo_pagamento, :observacao)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':emprestimo_id'  => $p->getEmprestimoId(),
            ':parcela_id'     => $p->getParcelaId(),
            ':valor_pago'     => $p->getValorPago(),
            ':tipo_pagamento' => $p->getTipoPagamento(),
            ':observacao'     => $p->getObservacao(),
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    public function listarPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT id, parcela_id, data_pagamento, valor_pago, tipo_pagamento, observacao
            FROM pagamentos
            WHERE emprestimo_id = :eid
            ORDER BY data_pagamento DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll();
    }
}
