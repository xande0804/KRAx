<?php

class EmprestimoDTO
{
    public int $cliente_id;
    public string $data_emprestimo;
    public float $valor_principal;
    public float $porcentagem_juros;
    public int $quantidade_parcelas;
    public string $tipo_vencimento;    // DIARIO | SEMANAL | MENSAL

    // ✅ agora pode ser:
    // - DIARIO/MENSAL: "YYYY-MM-DD" (primeiro vencimento)
    // - SEMANAL: "1".."6" (Seg..Sáb) (sem domingo)
    public ?string $regra_vencimento;

    public function __construct(array $dados)
    {
        $this->cliente_id          = (int)($dados['cliente_id'] ?? 0);
        $this->data_emprestimo     = trim((string)($dados['data_emprestimo'] ?? ''));
        $this->valor_principal     = (float)($dados['valor_principal'] ?? 0);
        $this->porcentagem_juros   = (float)($dados['porcentagem_juros'] ?? 0);
        $this->quantidade_parcelas = (int)($dados['quantidade_parcelas'] ?? 0);
        $this->tipo_vencimento     = strtoupper(trim((string)($dados['tipo_vencimento'] ?? '')));

        $rv = isset($dados['regra_vencimento']) ? trim((string)$dados['regra_vencimento']) : '';
        $this->regra_vencimento = ($rv !== '') ? $rv : null;
    }

    public function validar(): void
    {
        if ($this->cliente_id <= 0) {
            throw new InvalidArgumentException('cliente_id é obrigatório.');
        }

        if ($this->data_emprestimo === '') {
            throw new InvalidArgumentException('data_emprestimo é obrigatória.');
        }
        $this->assertDate($this->data_emprestimo, 'data_emprestimo');

        if ($this->valor_principal <= 0) {
            throw new InvalidArgumentException('valor_principal inválido.');
        }

        if ($this->porcentagem_juros < 0) {
            throw new InvalidArgumentException('porcentagem_juros inválida.');
        }

        if ($this->quantidade_parcelas <= 0) {
            throw new InvalidArgumentException('quantidade_parcelas inválida.');
        }

        if (!in_array($this->tipo_vencimento, ['DIARIO', 'SEMANAL', 'MENSAL'], true)) {
            throw new InvalidArgumentException('tipo_vencimento inválido.');
        }

        // ✅ Regras novas

        if ($this->tipo_vencimento === 'SEMANAL') {
            // obrigatório: 1..6 (Seg..Sáb). Não tem domingo.
            if ($this->regra_vencimento === null) {
                throw new InvalidArgumentException('regra_vencimento é obrigatória para vencimento semanal.');
            }

            if (!ctype_digit($this->regra_vencimento)) {
                throw new InvalidArgumentException('regra_vencimento semanal deve ser um número (1-6).');
            }

            $n = (int)$this->regra_vencimento;
            if ($n < 1 || $n > 6) {
                throw new InvalidArgumentException('regra_vencimento semanal deve ser 1-6 (Segunda a Sábado).');
            }
        }

        if ($this->tipo_vencimento === 'DIARIO' || $this->tipo_vencimento === 'MENSAL') {
            // obrigatório: data do primeiro vencimento (YYYY-MM-DD)
            if ($this->regra_vencimento === null) {
                throw new InvalidArgumentException('regra_vencimento é obrigatória (primeiro vencimento) para DIÁRIO/MENSAL.');
            }
            $this->assertDate($this->regra_vencimento, 'regra_vencimento');
        }
    }

    private function assertDate(string $date, string $fieldName): void
    {
        $date = trim($date);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new InvalidArgumentException("$fieldName inválida. Use o formato YYYY-MM-DD.");
        }

        $dt = DateTime::createFromFormat('Y-m-d', $date);
        $ok = $dt && $dt->format('Y-m-d') === $date;

        if (!$ok) {
            throw new InvalidArgumentException("$fieldName inválida.");
        }
    }
}
