<?php

class EmprestimoDTO
{
    public int $cliente_id;
    public string $data_emprestimo;
    public float $valor_principal;
    public float $porcentagem_juros;
    public int $quantidade_parcelas;
    public string $tipo_vencimento;   // DIARIO | SEMANAL | MENSAL
    public ?int $regra_vencimento;    // semanal: 1-7 | mensal: 1-31 | diario: null

    public function __construct(array $dados)
    {
        $this->cliente_id         = (int)($dados['cliente_id'] ?? 0);
        $this->data_emprestimo    = trim($dados['data_emprestimo'] ?? '');
        $this->valor_principal    = (float)($dados['valor_principal'] ?? 0);
        $this->porcentagem_juros  = (float)($dados['porcentagem_juros'] ?? 0);
        $this->quantidade_parcelas = (int)($dados['quantidade_parcelas'] ?? 0);
        $this->tipo_vencimento    = strtoupper(trim($dados['tipo_vencimento'] ?? ''));
        $this->regra_vencimento   = isset($dados['regra_vencimento']) && $dados['regra_vencimento'] !== ''
            ? (int)$dados['regra_vencimento']
            : null;
    }

    public function validar(): void
    {
        if ($this->cliente_id <= 0) {
            throw new InvalidArgumentException('cliente_id é obrigatório.');
        }

        if ($this->data_emprestimo === '') {
            throw new InvalidArgumentException('data_emprestimo é obrigatória.');
        }

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

        // regra_vencimento obrigatória para semanal/mensal
        if ($this->tipo_vencimento === 'SEMANAL') {
            if ($this->regra_vencimento === null || $this->regra_vencimento < 1 || $this->regra_vencimento > 7) {
                throw new InvalidArgumentException('regra_vencimento deve ser 1-7 (segunda-domingo) para vencimento semanal.');
            }
        }

        if ($this->tipo_vencimento === 'MENSAL') {
            if ($this->regra_vencimento === null || $this->regra_vencimento < 1 || $this->regra_vencimento > 31) {
                throw new InvalidArgumentException('regra_vencimento deve ser 1-31 para vencimento mensal.');
            }
        }

        if ($this->tipo_vencimento === 'DIARIO') {
            // no diário, regra deve ser null (se vier, ignoramos)
            $this->regra_vencimento = null;
        }
    }
}
