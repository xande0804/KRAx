<?php

require_once __DIR__ . '/../../config/database.php';

class DashboardDAO
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::conectar();
    }

    public function contarClientes(): int
    {
        $sql = "SELECT COUNT(*) AS total FROM clientes";
        $stmt = $this->pdo->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['total'] ?? 0);
    }

    public function contarEmprestimosAtivos(): int
    {
        $sql = "SELECT COUNT(*) AS total
                FROM emprestimos
                WHERE status = 'ATIVO'";

        $stmt = $this->pdo->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['total'] ?? 0);
    }

    public function contarVencemHoje(string $data): int
    {
        $sql = "SELECT COUNT(*) AS total
                FROM parcelas p
                INNER JOIN emprestimos e ON e.id = p.emprestimo_id
                WHERE e.status = 'ATIVO'
                  AND p.data_vencimento = :data
                  AND ROUND(COALESCE(p.valor_pago, 0), 2) < ROUND(COALESCE(p.valor_parcela, 0), 2)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data' => $data,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['total'] ?? 0);
    }

    public function contarClientesAtrasados(string $data): int
    {
        $sql = "SELECT COUNT(DISTINCT e.cliente_id) AS total
                FROM parcelas p
                INNER JOIN emprestimos e ON e.id = p.emprestimo_id
                WHERE e.status = 'ATIVO'
                  AND p.data_vencimento < :data
                  AND ROUND(COALESCE(p.valor_pago, 0), 2) < ROUND(COALESCE(p.valor_parcela, 0), 2)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data' => $data,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['total'] ?? 0);
    }

    public function somarQuantoSaiu(string $dataInicial, string $dataFinal): float
    {
        $sql = "SELECT COALESCE(SUM(valor_principal), 0) AS total
                FROM emprestimos
                WHERE data_emprestimo BETWEEN :data_inicial AND :data_final";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_inicial' => $dataInicial,
            ':data_final'   => $dataFinal,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return round((float)($row['total'] ?? 0), 2);
    }

    public function somarQuantoJaVoltou(string $dataInicial, string $dataFinal): float
    {
        $sql = "SELECT COALESCE(SUM(valor_pago), 0) AS total
                FROM pagamentos
                WHERE DATE(data_pagamento) BETWEEN :data_inicial AND :data_final";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_inicial' => $dataInicial,
            ':data_final'   => $dataFinal,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return round((float)($row['total'] ?? 0), 2);
    }

    public function somarPrevistoAindaPraVoltar(): float
    {
        $sql = "SELECT COALESCE(SUM(
                    GREATEST(
                        ROUND(COALESCE(valor_parcela, 0), 2) - ROUND(COALESCE(valor_pago, 0), 2),
                        0
                    )
                ), 0) AS total
                FROM parcelas
                WHERE ROUND(COALESCE(valor_pago, 0), 2) < ROUND(COALESCE(valor_parcela, 0), 2)";

        $stmt = $this->pdo->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return round((float)($row['total'] ?? 0), 2);
    }

    public function listarEmprestimosPorMes(string $dataInicial, string $dataFinal): array
    {
        $sql = "SELECT
                    DATE_FORMAT(data_emprestimo, '%Y-%m') AS referencia,
                    DATE_FORMAT(data_emprestimo, '%m/%Y') AS mes,
                    COUNT(*) AS quantidade
                FROM emprestimos
                WHERE data_emprestimo BETWEEN :data_inicial AND :data_final
                GROUP BY DATE_FORMAT(data_emprestimo, '%Y-%m'), DATE_FORMAT(data_emprestimo, '%m/%Y')
                ORDER BY referencia ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_inicial' => $dataInicial,
            ':data_final'   => $dataFinal,
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $lista = [];
        foreach ($rows as $row) {
            $lista[] = [
                'referencia' => $row['referencia'],
                'mes'        => $row['mes'],
                'quantidade' => (int)($row['quantidade'] ?? 0),
            ];
        }

        return $lista;
    }

    public function listarFinanceiroPorMes(string $dataInicial, string $dataFinal): array
    {
        $sql = "
            SELECT
                base.referencia,
                base.mes,
                ROUND(COALESCE(saidas.valor_saiu, 0), 2) AS valor_saiu,
                ROUND(COALESCE(voltas.valor_voltou, 0), 2) AS valor_voltou
            FROM (
                SELECT
                    DATE_FORMAT(data_emprestimo, '%Y-%m') AS referencia,
                    DATE_FORMAT(data_emprestimo, '%m/%Y') AS mes
                FROM emprestimos
                WHERE data_emprestimo BETWEEN :data_inicial_1 AND :data_final_1

                UNION

                SELECT
                    DATE_FORMAT(data_pagamento, '%Y-%m') AS referencia,
                    DATE_FORMAT(data_pagamento, '%m/%Y') AS mes
                FROM pagamentos
                WHERE DATE(data_pagamento) BETWEEN :data_inicial_2 AND :data_final_2
            ) base
            LEFT JOIN (
                SELECT
                    DATE_FORMAT(data_emprestimo, '%Y-%m') AS referencia,
                    SUM(valor_principal) AS valor_saiu
                FROM emprestimos
                WHERE data_emprestimo BETWEEN :data_inicial_3 AND :data_final_3
                GROUP BY DATE_FORMAT(data_emprestimo, '%Y-%m')
            ) saidas
                ON saidas.referencia = base.referencia
            LEFT JOIN (
                SELECT
                    DATE_FORMAT(data_pagamento, '%Y-%m') AS referencia,
                    SUM(valor_pago) AS valor_voltou
                FROM pagamentos
                WHERE DATE(data_pagamento) BETWEEN :data_inicial_4 AND :data_final_4
                GROUP BY DATE_FORMAT(data_pagamento, '%Y-%m')
            ) voltas
                ON voltas.referencia = base.referencia
            GROUP BY base.referencia, base.mes, saidas.valor_saiu, voltas.valor_voltou
            ORDER BY base.referencia ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_inicial_1' => $dataInicial,
            ':data_final_1'   => $dataFinal,
            ':data_inicial_2' => $dataInicial,
            ':data_final_2'   => $dataFinal,
            ':data_inicial_3' => $dataInicial,
            ':data_final_3'   => $dataFinal,
            ':data_inicial_4' => $dataInicial,
            ':data_final_4'   => $dataFinal,
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $lista = [];
        foreach ($rows as $row) {
            $lista[] = [
                'referencia'   => $row['referencia'],
                'mes'          => $row['mes'],
                'valor_saiu'   => round((float)($row['valor_saiu'] ?? 0), 2),
                'valor_voltou' => round((float)($row['valor_voltou'] ?? 0), 2),
            ];
        }

        return $lista;
    }

    public function listarTopClientesPorTotalPago(string $dataInicial, string $dataFinal, int $limite = 5): array
    {
        $limite = max(1, $limite);

        $sql = "SELECT
                    c.id AS cliente_id,
                    c.nome AS cliente_nome,
                    ROUND(SUM(pg.valor_pago), 2) AS total_pago,
                    COUNT(pg.id) AS quantidade_pagamentos
                FROM pagamentos pg
                INNER JOIN emprestimos e ON e.id = pg.emprestimo_id
                INNER JOIN clientes c ON c.id = e.cliente_id
                WHERE DATE(pg.data_pagamento) BETWEEN :data_inicial AND :data_final
                GROUP BY c.id, c.nome
                ORDER BY total_pago DESC, c.nome ASC
                LIMIT {$limite}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data_inicial' => $dataInicial,
            ':data_final'   => $dataFinal,
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $lista = [];
        $posicao = 1;

        foreach ($rows as $row) {
            $lista[] = [
                'posicao'               => $posicao,
                'cliente_id'            => (int)($row['cliente_id'] ?? 0),
                'cliente_nome'          => $row['cliente_nome'] ?? '',
                'total_pago'            => round((float)($row['total_pago'] ?? 0), 2),
                'quantidade_pagamentos' => (int)($row['quantidade_pagamentos'] ?? 0),
            ];
            $posicao++;
        }

        return $lista;
    }
}