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

    /**
     * Útil pra transações (edição/correção precisa ser atômica).
     */
    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    public function criar(Parcela $p): int
    {
        $sql = "INSERT INTO parcelas
                (emprestimo_id, numero_parcela, data_vencimento, valor_parcela, valor_pago, status)
                VALUES
                (:emprestimo_id, :numero_parcela, :data_vencimento, :valor_parcela, :valor_pago, :status)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':emprestimo_id'   => $p->getEmprestimoId(),
            ':numero_parcela'  => $p->getNumeroParcela(),
            ':data_vencimento' => $p->getDataVencimento(),
            ':valor_parcela'   => $p->getValorParcela(),
            ':valor_pago'      => $p->getValorPago(),
            ':status'          => $p->getStatus(),
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    public function listarPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT
                  id,
                  emprestimo_id,
                  numero_parcela,
                  data_vencimento,
                  valor_parcela,
                  ROUND(COALESCE(valor_pago, 0), 2) AS valor_pago,
                  status,
                  pago_em
                FROM parcelas
                WHERE emprestimo_id = :eid
                ORDER BY numero_parcela ASC, id ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listarParcelasAbertasPorEmprestimo(int $emprestimoId): array
    {
        $sql = "SELECT
                  id,
                  emprestimo_id,
                  numero_parcela,
                  data_vencimento,
                  valor_parcela,
                  ROUND(COALESCE(valor_pago, 0), 2) AS valor_pago,
                  status
                FROM parcelas
                WHERE emprestimo_id = :eid
                  AND ROUND(COALESCE(valor_pago,0),2) < ROUND(COALESCE(valor_parcela,0),2)
                ORDER BY numero_parcela ASC, id ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function buscarProximaParcelaAbertaPorEmprestimo(int $emprestimoId): ?array
    {
        $sql = "SELECT
                  id,
                  emprestimo_id,
                  numero_parcela,
                  data_vencimento,
                  valor_parcela,
                  ROUND(COALESCE(valor_pago, 0), 2) AS valor_pago,
                  status
                FROM parcelas
                WHERE emprestimo_id = :eid
                  AND ROUND(COALESCE(valor_pago,0),2) < ROUND(COALESCE(valor_parcela,0),2)
                ORDER BY numero_parcela ASC, id ASC
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function buscarPorId(int $parcelaId): ?array
    {
        $sql = "SELECT
                  id,
                  emprestimo_id,
                  numero_parcela,
                  data_vencimento,
                  valor_parcela,
                  COALESCE(valor_pago, 0) AS valor_pago,
                  status,
                  pago_em
                FROM parcelas
                WHERE id = :id
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $parcelaId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function atualizarDataVencimento(int $parcelaId, string $novaData): bool
    {
        $sql = "UPDATE parcelas
                SET data_vencimento = :dv
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':dv' => $novaData,
            ':id' => $parcelaId
        ]);
    }

    /**
     * 🔥 VERSÃO DEFINITIVA — sem loop, sem float bug
     */
    public function adicionarPagamentoNaParcela(int $parcelaId, float $valor): bool
    {
        if ($parcelaId <= 0 || $valor <= 0) return false;

        $sqlSel = "SELECT valor_parcela, COALESCE(valor_pago,0) AS valor_pago
               FROM parcelas
               WHERE id = :id
               LIMIT 1";

        $stmtSel = $this->pdo->prepare($sqlSel);
        $stmtSel->execute([':id' => $parcelaId]);
        $parcela = $stmtSel->fetch(PDO::FETCH_ASSOC);

        if (!$parcela) return false;

        $valorParcela = round((float)$parcela['valor_parcela'], 2);
        $valorAtual   = round((float)$parcela['valor_pago'], 2);

        $novoValor = round($valorAtual + $valor, 2);

        if ($novoValor >= $valorParcela) {
            $novoValor = $valorParcela;
            $status = 'PAGA';

            $sqlUpd = "UPDATE parcelas
                   SET valor_pago = :vp,
                       status = :st,
                       pago_em = NOW()
                   WHERE id = :id";
        } elseif ($novoValor > 0) {
            $status = 'PARCIAL';

            $sqlUpd = "UPDATE parcelas
                   SET valor_pago = :vp,
                       status = :st
                   WHERE id = :id";
        } else {
            $status = 'ABERTA';

            $sqlUpd = "UPDATE parcelas
                   SET valor_pago = :vp,
                       status = :st
                   WHERE id = :id";
        }

        $stmtUpd = $this->pdo->prepare($sqlUpd);

        return $stmtUpd->execute([
            ':vp' => $novoValor,
            ':st' => $status,
            ':id' => $parcelaId
        ]);
    }

    /**
     * ✅ Ajusta valor_pago com delta (pode ser + ou -) e recalcula status/pago_em.
     * - Se ficar >= valor_parcela => PAGA e pago_em = NOW() (se ainda não tiver)
     * - Se ficar entre (0 e valor_parcela) => PARCIAL e limpa pago_em
     * - Se ficar 0 => ABERTA e limpa pago_em
     */
    public function ajustarPagamentoNaParcela(int $parcelaId, float $delta): bool
    {
        if ($parcelaId <= 0) return false;
        if (!is_finite($delta) || $delta == 0.0) return true;

        $row = $this->buscarPorId($parcelaId);
        if (!$row) return false;

        $valorParcela = round((float)($row['valor_parcela'] ?? 0), 2);
        $valorAtual   = round((float)($row['valor_pago'] ?? 0), 2);

        // novo valor com clamp
        $novo = round($valorAtual + $delta, 2);
        if ($novo < 0) $novo = 0.0;
        if ($valorParcela > 0 && $novo > $valorParcela) $novo = $valorParcela;

        // define status
        if ($valorParcela > 0 && $novo + 0.00001 >= $valorParcela) {
            $novo = $valorParcela;
            $status = 'PAGA';

            // mantém pago_em se já existia; senão seta agora
            $sql = "UPDATE parcelas
                    SET valor_pago = :vp,
                        status = :st,
                        pago_em = CASE WHEN pago_em IS NULL THEN NOW() ELSE pago_em END
                    WHERE id = :id";
        } elseif ($novo > 0) {
            $status = 'PARCIAL';

            // ao voltar pra parcial, remove pago_em
            $sql = "UPDATE parcelas
                    SET valor_pago = :vp,
                        status = :st,
                        pago_em = NULL
                    WHERE id = :id";
        } else {
            $status = 'ABERTA';

            $sql = "UPDATE parcelas
                    SET valor_pago = :vp,
                        status = :st,
                        pago_em = NULL
                    WHERE id = :id";
        }

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':vp' => $novo,
            ':st' => $status,
            ':id' => $parcelaId
        ]);
    }

    /**
     * ✅ Atalho: remove valor de uma parcela (reverte pagamento).
     */
    public function removerPagamentoDaParcela(int $parcelaId, float $valor): bool
    {
        if ($parcelaId <= 0 || $valor <= 0) return false;
        return $this->ajustarPagamentoNaParcela($parcelaId, -abs($valor));
    }

    // ===== Vencimentos =====

    public function listarVencimentos(DateTime $ate): array
    {
        $sql = "
        SELECT
            c.id AS cliente_id,
            c.nome AS cliente_nome,
            e.id AS emprestimo_id,
            p.id AS parcela_id,
            p.numero_parcela,
            p.data_vencimento,
            e.valor_principal,
            e.porcentagem_juros,
            e.quantidade_parcelas,
            e.tipo_vencimento
        FROM parcelas p
        INNER JOIN emprestimos e ON e.id = p.emprestimo_id
        INNER JOIN clientes c ON c.id = e.cliente_id
        WHERE p.status = 'ABERTA'
          AND p.data_vencimento <= :data
        ORDER BY p.data_vencimento ASC
    ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':data' => $ate->format('Y-m-d')
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listarVencimentosEntre(DateTime $ini, DateTime $fim): array
    {
        $sql = "
        SELECT
            c.id AS cliente_id,
            c.nome AS cliente_nome,
            e.id AS emprestimo_id,
            p.id AS parcela_id,
            p.numero_parcela,
            p.data_vencimento,
            e.valor_principal,
            e.porcentagem_juros,
            e.quantidade_parcelas,
            e.tipo_vencimento
        FROM parcelas p
        INNER JOIN emprestimos e ON e.id = p.emprestimo_id
        INNER JOIN clientes c ON c.id = e.cliente_id
        WHERE p.status = 'ABERTA'
          AND p.data_vencimento BETWEEN :ini AND :fim
        ORDER BY p.data_vencimento ASC
    ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':ini' => $ini->format('Y-m-d'),
            ':fim' => $fim->format('Y-m-d')
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function contarVencemHoje(): int
    {
        $sql = "
        SELECT COUNT(*) 
        FROM parcelas p
        INNER JOIN emprestimos e ON e.id = p.emprestimo_id
        WHERE p.status = 'ABERTA'
          AND DATE(p.data_vencimento) = CURDATE()
          AND e.status <> 'QUITADO'
    ";

        return (int) $this->pdo->query($sql)->fetchColumn();
    }

    public function contarAtrasados(): int
    {
        $sql = "
        SELECT COUNT(*) 
        FROM parcelas p
        INNER JOIN emprestimos e ON e.id = p.emprestimo_id
        WHERE p.status = 'ABERTA'
          AND DATE(p.data_vencimento) < CURDATE()
          AND e.status <> 'QUITADO'
    ";

        return (int) $this->pdo->query($sql)->fetchColumn();
    }
}