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
            ':emprestimo_id'   => $p->getEmprestimoId(),
            ':numero_parcela'  => $p->getNumeroParcela(),
            ':data_vencimento' => $p->getDataVencimento(),
            ':valor_parcela'   => $p->getValorParcela(),
            ':valor_pago'      => $p->getValorPago(),
            ':status'          => $p->getStatus(),
        ]);
    }

    /**
     * (LEGADO) Vencimentos até uma data (<=).
     * Se você usar isso pra "Hoje", vem atrasado junto.
     */
    public function listarVencimentos(DateTime $dataBase): array
    {
        $sql = "
            SELECT 
                p.id AS parcela_id,
                p.numero_parcela,
                p.data_vencimento,
                p.status AS parcela_status,
                p.valor_parcela,
                p.valor_pago,

                e.id AS emprestimo_id,
                e.valor_principal,
                e.porcentagem_juros,
                e.quantidade_parcelas,
                e.tipo_vencimento,

                c.id AS cliente_id,
                c.nome AS cliente_nome
            FROM parcelas p
            INNER JOIN emprestimos e ON e.id = p.emprestimo_id
            INNER JOIN clientes c ON c.id = e.cliente_id
            WHERE p.status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND p.data_vencimento <= :data_base
            ORDER BY p.data_vencimento ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':data_base' => $dataBase->format('Y-m-d')]);
        return $stmt->fetchAll();
    }

    /**
     * ✅ Vencimentos EXATOS de um dia (data_vencimento = dia)
     * Usado pra "Hoje" e "Amanhã" corretamente.
     */
    public function listarVencimentosNoDia(DateTime $dia): array
    {
        $sql = "
            SELECT 
                p.id AS parcela_id,
                p.numero_parcela,
                p.data_vencimento,
                p.status AS parcela_status,
                p.valor_parcela,
                p.valor_pago,

                e.id AS emprestimo_id,
                e.valor_principal,
                e.porcentagem_juros,
                e.quantidade_parcelas,
                e.tipo_vencimento,

                c.id AS cliente_id,
                c.nome AS cliente_nome
            FROM parcelas p
            INNER JOIN emprestimos e ON e.id = p.emprestimo_id
            INNER JOIN clientes c ON c.id = e.cliente_id
            WHERE p.status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND p.data_vencimento = :dia
            ORDER BY p.data_vencimento ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':dia' => $dia->format('Y-m-d')]);
        return $stmt->fetchAll();
    }

    /**
     * ✅ Somente atrasados (data_vencimento < hoje)
     * Pra renderizar a seção "Atrasados" separada.
     */
    public function listarAtrasadosAte(DateTime $hoje): array
    {
        $sql = "
            SELECT 
                p.id AS parcela_id,
                p.numero_parcela,
                p.data_vencimento,
                p.status AS parcela_status,
                p.valor_parcela,
                p.valor_pago,

                e.id AS emprestimo_id,
                e.valor_principal,
                e.porcentagem_juros,
                e.quantidade_parcelas,
                e.tipo_vencimento,

                c.id AS cliente_id,
                c.nome AS cliente_nome
            FROM parcelas p
            INNER JOIN emprestimos e ON e.id = p.emprestimo_id
            INNER JOIN clientes c ON c.id = e.cliente_id
            WHERE p.status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND p.data_vencimento < :hoje
            ORDER BY p.data_vencimento ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':hoje' => $hoje->format('Y-m-d')]);
        return $stmt->fetchAll();
    }

    /**
     * ✅ Vencimentos entre duas datas (inclusive) — "Semana"
     */
    public function listarVencimentosEntre(DateTime $ini, DateTime $fim): array
    {
        $sql = "
            SELECT 
                p.id AS parcela_id,
                p.numero_parcela,
                p.data_vencimento,
                p.status AS parcela_status,
                p.valor_parcela,
                p.valor_pago,

                e.id AS emprestimo_id,
                e.valor_principal,
                e.porcentagem_juros,
                e.quantidade_parcelas,
                e.tipo_vencimento,

                c.id AS cliente_id,
                c.nome AS cliente_nome
            FROM parcelas p
            INNER JOIN emprestimos e ON e.id = p.emprestimo_id
            INNER JOIN clientes c ON c.id = e.cliente_id
            WHERE p.status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND p.data_vencimento BETWEEN :ini AND :fim
            ORDER BY p.data_vencimento ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':ini' => $ini->format('Y-m-d'),
            ':fim' => $fim->format('Y-m-d'),
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
        $sql = "SELECT *
            FROM parcelas
            WHERE emprestimo_id = :eid
              AND status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
            ORDER BY numero_parcela ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return $stmt->fetchAll();
    }

    /**
     * ✅ Próxima parcela em aberto (a “próxima a vencer/receber”)
     * Regra: pega a menor numero_parcela ainda em aberto.
     */
    public function buscarProximaParcelaAbertaPorEmprestimo(int $emprestimoId): ?array
    {
        $sql = "SELECT *
            FROM parcelas
            WHERE emprestimo_id = :eid
              AND status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
            ORDER BY numero_parcela ASC
            LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * ✅ Atualiza vencimento de uma parcela.
     * Se estava ATRASADO/ATRASADA e foi adiada, volta pra ABERTA.
     */
    public function atualizarDataVencimento(int $parcelaId, string $novaDataYmd): void
    {
        $sql = "UPDATE parcelas
            SET data_vencimento = :dv,
                status = CASE
                    WHEN status IN ('ATRASADO','ATRASADA') THEN 'ABERTA'
                    ELSE status
                END
            WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':dv' => $novaDataYmd,
            ':id' => $parcelaId
        ]);
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

    public function contarVencemHoje(string $data): int
    {
        $sql = "SELECT COUNT(*)
            FROM parcelas
            WHERE status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND data_vencimento = :data";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':data' => $data]);
        return (int) $stmt->fetchColumn();
    }

    public function contarAtrasados(string $data): int
    {
        $sql = "SELECT COUNT(*)
            FROM parcelas
            WHERE status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
              AND data_vencimento < :data";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':data' => $data]);
        return (int) $stmt->fetchColumn();
    }

    // =========================================================
    // ✅ NOVOS MÉTODOS (para "Editar Empréstimo" recalcular automático)
    // =========================================================

    /**
     * Atualiza o valor_parcela de UMA parcela.
     * (Não mexe em status/valor_pago.)
     */
    public function atualizarValorParcela(int $parcelaId, float $novoValorParcela): void
    {
        $sql = "UPDATE parcelas
                SET valor_parcela = :vp
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':vp' => $novoValorParcela,
            ':id' => $parcelaId
        ]);
    }

    /**
     * Retorna o maior numero_parcela existente para um empréstimo.
     * Se não tiver nenhuma parcela, retorna 0.
     */
    public function buscarMaiorNumeroParcela(int $emprestimoId): int
    {
        $sql = "SELECT COALESCE(MAX(numero_parcela), 0)
                FROM parcelas
                WHERE emprestimo_id = :eid";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':eid' => $emprestimoId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Remove parcelas excedentes quando reduzir a quantidade.
     * Segurança:
     * - só remove parcelas com numero_parcela > :max
     * - só remove se estiver em status aberto/parcial/atrasado
     * - e com valor_pago = 0 (pra não apagar coisa já mexida)
     */
    public function removerParcelasExcedentes(int $emprestimoId, int $numeroMax): int
    {
        $sql = "DELETE FROM parcelas
                WHERE emprestimo_id = :eid
                  AND numero_parcela > :max
                  AND status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
                  AND (valor_pago IS NULL OR valor_pago = 0)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':eid' => $emprestimoId,
            ':max' => $numeroMax
        ]);

        return (int) $stmt->rowCount();
    }
}
