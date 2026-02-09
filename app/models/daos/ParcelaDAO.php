<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../entities/Parcela.php';

class ParcelaDAO
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::conectar();
    }

    public function criar(Parcela $p): void
    {
        $sql = "INSERT INTO parcelas
                (emprestimo_id, numero_parcela, data_vencimento, valor_parcela, valor_pago, status)
                VALUES
                (:emprestimo_id, :numero_parcela, :data_vencimento, :valor_parcela, :valor_pago, :status)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':emprestimo_id'  => $p->getEmprestimoId(),
            ':numero_parcela' => $p->getNumeroParcela(),
            ':data_vencimento' => $p->getDataVencimento(),
            ':valor_parcela'  => $p->getValorParcela(),
            ':valor_pago'     => $p->getValorPago(),
            ':status'         => $p->getStatus(),
        ]);
    }

    public function listarVencimentos(DateTime $dataBase): array
    {
        $sql = "
        SELECT 
            p.id AS parcela_id,
            p.data_vencimento,
            p.valor_parcela,
            p.status,
            e.id AS emprestimo_id,
            c.id AS cliente_id,
            c.nome AS cliente_nome
        FROM parcelas p
        INNER JOIN emprestimos e ON e.id = p.emprestimo_id
        INNER JOIN clientes c ON c.id = e.cliente_id
        WHERE p.status = 'ABERTA'
          AND p.data_vencimento <= :data_base
        ORDER BY p.data_vencimento ASC
    ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_base' => $dataBase->format('Y-m-d')
        ]);

        return $stmt->fetchAll();
    }

    public function buscarPorId(int $id): ?array
    {
        $sql = "SELECT * FROM parcelas WHERE id = :id LIMIT 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function adicionarPagamentoNaParcela(int $parcelaId, float $valorPago): void
    {
        $sql = "UPDATE parcelas
            SET valor_pago = valor_pago + :v_add,
                status = CASE
                    WHEN (valor_pago + :v_ge) >= valor_parcela THEN 'PAGA'
                    WHEN (valor_pago + :v_gt) > 0 THEN 'PARCIAL'
                    ELSE status
                END,
                pago_em = CASE
                    WHEN (valor_pago + :v_ge2) >= valor_parcela THEN NOW()
                    ELSE pago_em
                END
            WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':v_add' => $valorPago,
            ':v_ge'  => $valorPago,
            ':v_gt'  => $valorPago,
            ':v_ge2' => $valorPago,
            ':id'    => $parcelaId
        ]);
    }


    public function listarParcelasAbertasPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT * FROM parcelas
            WHERE emprestimo_id = :eid
              AND status IN ('ABERTA','PARCIAL','ATRASADA')
            ORDER BY numero_parcela ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll();
    }

    public function listarPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT id, numero_parcela, data_vencimento, valor_parcela, valor_pago, status, pago_em
            FROM parcelas
            WHERE emprestimo_id = :eid
            ORDER BY numero_parcela ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll();
    }
}
