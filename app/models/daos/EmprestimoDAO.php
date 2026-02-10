<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../entities/Emprestimo.php';

class EmprestimoDAO
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::conectar();
    }

    // CREATE
    public function criar(Emprestimo $e): int
    {
        $sql = "INSERT INTO emprestimos
                (cliente_id, data_emprestimo, valor_principal, porcentagem_juros,
                 quantidade_parcelas, tipo_vencimento, regra_vencimento, status)
                VALUES
                (:cliente_id, :data_emprestimo, :valor_principal, :porcentagem_juros,
                 :quantidade_parcelas, :tipo_vencimento, :regra_vencimento, :status)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':cliente_id' => $e->getClienteId(),
            ':data_emprestimo' => $e->getDataEmprestimo(),
            ':valor_principal' => $e->getValorPrincipal(),
            ':porcentagem_juros' => $e->getPorcentagemJuros(),
            ':quantidade_parcelas' => $e->getQuantidadeParcelas(),
            ':tipo_vencimento' => $e->getTipoVencimento(),
            ':regra_vencimento' => $e->getRegraVencimento(),
            ':status' => $e->getStatus(),
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    // READ - buscar por id
    public function buscarPorId(int $id): ?Emprestimo
    {
        $sql = "SELECT * FROM emprestimos WHERE id = :id LIMIT 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);

        $row = $stmt->fetch();
        if (!$row)
            return null;

        return $this->mapearParaEntity($row);
    }

    // READ - listar todos
    public function listar(): array
    {
        $sql = "SELECT * FROM emprestimos ORDER BY id DESC";
        $stmt = $this->pdo->query($sql);
        $rows = $stmt->fetchAll();

        $lista = [];
        foreach ($rows as $row) {
            $lista[] = $this->mapearParaEntity($row);
        }

        return $lista;
    }

    // UPDATE status
    public function atualizarStatus(int $id, string $status): bool
    {
        $sql = "UPDATE emprestimos SET status = :status WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':status' => $status,
            ':id' => $id
        ]);
    }

    // ===== helper =====
    private function mapearParaEntity(array $row): Emprestimo
    {
        $e = new Emprestimo();
        $e->setId((int) $row['id']);
        $e->setClienteId((int) $row['cliente_id']);
        $e->setDataEmprestimo($row['data_emprestimo']);
        $e->setValorPrincipal($row['valor_principal']);
        $e->setPorcentagemJuros($row['porcentagem_juros']);
        $e->setQuantidadeParcelas($row['quantidade_parcelas']);
        $e->setTipoVencimento($row['tipo_vencimento']);
        $e->setRegraVencimento($row['regra_vencimento']);
        $e->setStatus($row['status']);
        return $e;
    }

    public function listarComFiltro(?string $filtro = null): array
    {
        $sql = "
        SELECT 
            e.id,
            e.cliente_id,
            c.nome AS cliente_nome,
            e.valor_principal,
            e.quantidade_parcelas,
            e.status,
            MIN(p.data_vencimento) AS proximo_vencimento,
            SUM(CASE WHEN p.status = 'PAGA' THEN 1 ELSE 0 END) AS parcelas_pagas
        FROM emprestimos e
        INNER JOIN clientes c ON c.id = e.cliente_id
        LEFT JOIN parcelas p ON p.emprestimo_id = e.id
    ";

        $where = [];
        if ($filtro === 'ATIVO') {
            $where[] = "e.status = 'ATIVO'";
        }

        if ($filtro === 'QUITADO') {
            $where[] = "e.status = 'QUITADO'";
        }

        if ($filtro === 'ATRASADO') {
            $where[] = "e.status = 'ATIVO' AND EXISTS (
            SELECT 1 FROM parcelas px
            WHERE px.emprestimo_id = e.id
              AND px.status IN ('ABERTA','PARCIAL')
              AND px.data_vencimento < CURDATE()
        )";
        }

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        $sql .= " GROUP BY e.id
              ORDER BY e.id DESC";

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll();
    }
    public function contarAtivos(): int
    {
        $sql = "SELECT COUNT(*) FROM emprestimos WHERE status = 'ATIVO'";
        $stmt = $this->pdo->query($sql);
        return (int) $stmt->fetchColumn();
    }

}
