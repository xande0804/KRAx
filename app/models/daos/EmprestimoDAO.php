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
        if (!$row) return null;

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

    /**
     * ✅ UPDATE regras do empréstimo (usado no "Editar empréstimo")
     * Atualiza:
     * - quantidade_parcelas
     * - porcentagem_juros
     */
    public function atualizarRegras(int $emprestimoId, int $quantidadeParcelas, float $porcentagemJuros): bool
    {
        $sql = "UPDATE emprestimos
                SET quantidade_parcelas = :qtd,
                    porcentagem_juros = :juros
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':qtd' => $quantidadeParcelas,
            ':juros' => $porcentagemJuros,
            ':id' => $emprestimoId
        ]);
    }

    /**
     * ✅ (Opcional) Atualiza também a regra de vencimento
     */
    public function atualizarRegrasComVencimento(int $emprestimoId, int $quantidadeParcelas, float $porcentagemJuros, string $regraVencimento): bool
    {
        $sql = "UPDATE emprestimos
                SET quantidade_parcelas = :qtd,
                    porcentagem_juros = :juros,
                    regra_vencimento = :regra
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':qtd'   => $quantidadeParcelas,
            ':juros' => $porcentagemJuros,
            ':regra' => $regraVencimento,
            ':id'    => $emprestimoId
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

    /**
     * Lista para a tela de empréstimos (com filtro)
     */
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

            CASE 
              WHEN UPPER(e.status) = 'QUITADO' THEN NULL
              ELSE MIN(
                CASE 
                  WHEN p.id IS NULL THEN NULL
                  WHEN UPPER(p.status) IN ('ABERTA','PARCIAL','ATRASADO','ATRASADA') THEN p.data_vencimento
                  WHEN (p.valor_pago IS NOT NULL AND p.valor_parcela IS NOT NULL AND p.valor_pago < p.valor_parcela) THEN p.data_vencimento
                  ELSE NULL
                END
              )
            END AS proximo_vencimento,

            CASE 
              WHEN UPPER(e.status) = 'QUITADO' THEN e.quantidade_parcelas
              ELSE COALESCE(SUM(
                CASE 
                  WHEN p.id IS NULL THEN 0
                  WHEN UPPER(p.status) IN ('PAGA','QUITADA') THEN 1
                  WHEN (p.valor_pago IS NOT NULL AND p.valor_parcela IS NOT NULL AND p.valor_pago >= p.valor_parcela) THEN 1
                  ELSE 0
                END
              ), 0)
            END AS parcelas_pagas

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

        // ✅ CORRIGIDO: atraso por DATA + "não pago" (status ou valor_pago < valor_parcela)
        if ($filtro === 'ATRASADO') {
            $where[] = "e.status = 'ATIVO' AND EXISTS (
                SELECT 1 FROM parcelas px
                WHERE px.emprestimo_id = e.id
                  AND px.data_vencimento < CURDATE()
                  AND (
                        -- status indica aberto/atrasado
                        UPPER(COALESCE(px.status,'')) IN ('ABERTA','PARCIAL','ATRASADO','ATRASADA')
                        -- OU ainda não quitou pelo valor (cobre status vazio/errado)
                        OR COALESCE(px.valor_pago,0) < COALESCE(px.valor_parcela,0)
                  )
            )";
        }

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        $sql .= "
            GROUP BY 
              e.id, e.cliente_id, c.nome, e.valor_principal, e.quantidade_parcelas, e.status
            ORDER BY e.id DESC
        ";

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll();
    }

    public function contarAtivos(): int
    {
        $sql = "SELECT COUNT(*) FROM emprestimos WHERE status = 'ATIVO'";
        $stmt = $this->pdo->query($sql);
        return (int) $stmt->fetchColumn();
    }

    public function listarPorCliente(int $clienteId): array
    {
        $pdo = Database::conectar();

        $sql = "
          SELECT 
            e.id,
            e.cliente_id,
            c.nome AS cliente_nome,
            e.valor_principal,
            e.quantidade_parcelas,
            e.status,

            CASE 
              WHEN UPPER(e.status) = 'QUITADO' THEN e.quantidade_parcelas
              ELSE COALESCE(SUM(
                CASE 
                  WHEN p.id IS NULL THEN 0
                  WHEN UPPER(p.status) IN ('PAGA','QUITADA') THEN 1
                  WHEN (p.valor_pago IS NOT NULL AND p.valor_parcela IS NOT NULL AND p.valor_pago >= p.valor_parcela) THEN 1
                  ELSE 0
                END
              ), 0)
            END AS parcelas_pagas,

            CASE 
              WHEN UPPER(e.status) = 'QUITADO' THEN NULL
              ELSE MIN(
                CASE 
                  WHEN p.id IS NULL THEN NULL
                  WHEN UPPER(p.status) IN ('ABERTA','PARCIAL','ATRASADO','ATRASADA') THEN p.data_vencimento
                  WHEN (p.valor_pago IS NOT NULL AND p.valor_parcela IS NOT NULL AND p.valor_pago < p.valor_parcela) THEN p.data_vencimento
                  ELSE NULL
                END
              )
            END AS proximo_vencimento

          FROM emprestimos e
          INNER JOIN clientes c ON c.id = e.cliente_id
          LEFT JOIN parcelas p ON p.emprestimo_id = e.id
          WHERE e.cliente_id = :cliente_id
          GROUP BY e.id, e.cliente_id, c.nome, e.valor_principal, e.quantidade_parcelas, e.status
          ORDER BY e.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([':cliente_id' => $clienteId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
