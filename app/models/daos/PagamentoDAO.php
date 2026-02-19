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

    /**
     * Útil pra transações no Controller (editar/corrigir pagamento precisa ser atômico).
     */
    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    public function criar(Pagamento $p): int
    {
        $sql = "INSERT INTO pagamentos 
                    (emprestimo_id, parcela_id, data_pagamento, valor_pago, tipo_pagamento, observacao)
                VALUES 
                    (:emprestimo_id, :parcela_id, :data_pagamento, :valor_pago, :tipo_pagamento, :observacao)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':emprestimo_id'  => $p->getEmprestimoId(),
            ':parcela_id'     => $p->getParcelaId(),
            ':data_pagamento' => $p->getDataPagamento(),
            ':valor_pago'     => $p->getValorPago(),
            ':tipo_pagamento' => $p->getTipoPagamento(),
            ':observacao'     => $p->getObservacao(),
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    public function listarPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT id, emprestimo_id, parcela_id, data_pagamento, valor_pago, tipo_pagamento, observacao
                FROM pagamentos
                WHERE emprestimo_id = :eid
                ORDER BY data_pagamento DESC, id DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll();
    }

    /**
     * Busca um pagamento específico (para editar/excluir/corrigir).
     */
    public function buscarPorId(int $pagamentoId): ?array
    {
        $sql = "SELECT id, emprestimo_id, parcela_id, data_pagamento, valor_pago, tipo_pagamento, observacao
                FROM pagamentos
                WHERE id = :id
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $pagamentoId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $row : null;
    }

    /**
     * Atualiza os campos editáveis de um pagamento.
     * OBS: o impacto em parcelas/emprestimo será tratado no Controller (com transação).
     */
    public function atualizar(
        int $pagamentoId,
        ?int $parcelaId,
        string $dataPagamento,
        float $valorPago,
        string $tipoPagamento,
        ?string $observacao
    ): bool {
        $sql = "UPDATE pagamentos
                SET parcela_id = :parcela_id,
                    data_pagamento = :data_pagamento,
                    valor_pago = :valor_pago,
                    tipo_pagamento = :tipo_pagamento,
                    observacao = :observacao
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':parcela_id'     => $parcelaId,
            ':data_pagamento' => $dataPagamento,
            ':valor_pago'     => $valorPago,
            ':tipo_pagamento' => strtoupper(trim($tipoPagamento)),
            ':observacao'     => $observacao,
            ':id'             => $pagamentoId,
        ]);
    }

    /**
     * Exclui um pagamento (o impacto em parcelas/emprestimo será tratado no Controller).
     */
    public function excluir(int $pagamentoId): bool
    {
        $sql = "DELETE FROM pagamentos WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([':id' => $pagamentoId]);
    }

    public function somarPorEmprestimoETipo(int $emprestimoId, string $tipo): float
    {
        $sql = "SELECT COALESCE(SUM(valor_pago), 0) AS total
                FROM pagamentos
                WHERE emprestimo_id = :id
                  AND UPPER(tipo_pagamento) = :tipo";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':id' => $emprestimoId,
            ':tipo' => strtoupper($tipo),
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (float)($row['total'] ?? 0);
    }
}
