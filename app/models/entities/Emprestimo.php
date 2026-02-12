<?php

class Emprestimo
{
    private ?int $id = null;
    private int $clienteId;
    private string $dataEmprestimo; // YYYY-MM-DD
    private float $valorPrincipal;
    private float $porcentagemJuros;
    private int $quantidadeParcelas;
    private string $tipoVencimento; // DIARIO | SEMANAL | MENSAL

    // ✅ agora aceita:
    // - DIARIO/MENSAL: "YYYY-MM-DD"
    // - SEMANAL: "1".."6" (Seg..Sáb)
    private ?string $regraVencimento = null;

    private string $status = 'ATIVO'; // ATIVO | QUITADO | CANCELADO

    // ===== GETTERS =====
    public function getId(): ?int
    {
        return $this->id;
    }

    public function getClienteId(): int
    {
        return $this->clienteId;
    }

    public function getDataEmprestimo(): string
    {
        return $this->dataEmprestimo;
    }

    public function getValorPrincipal(): float
    {
        return $this->valorPrincipal;
    }

    public function getPorcentagemJuros(): float
    {
        return $this->porcentagemJuros;
    }

    public function getQuantidadeParcelas(): int
    {
        return $this->quantidadeParcelas;
    }

    public function getTipoVencimento(): string
    {
        return $this->tipoVencimento;
    }

    public function getRegraVencimento(): ?string
    {
        return $this->regraVencimento;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    // ===== SETTERS =====
    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function setClienteId(int $clienteId): void
    {
        if ($clienteId <= 0) throw new InvalidArgumentException('cliente_id inválido.');
        $this->clienteId = $clienteId;
    }

    public function setDataEmprestimo(string $dataEmprestimo): void
    {
        $dataEmprestimo = trim($dataEmprestimo);
        if ($dataEmprestimo === '') throw new InvalidArgumentException('data_emprestimo é obrigatória.');
        $this->dataEmprestimo = $dataEmprestimo;
    }

    public function setValorPrincipal($valorPrincipal): void
    {
        $valor = (float)$valorPrincipal;
        if ($valor <= 0) throw new InvalidArgumentException('valor_principal inválido.');
        $this->valorPrincipal = $valor;
    }

    public function setPorcentagemJuros($porcentagemJuros): void
    {
        $valor = (float)$porcentagemJuros;
        if ($valor < 0) throw new InvalidArgumentException('porcentagem_juros inválida.');
        $this->porcentagemJuros = $valor;
    }

    public function setQuantidadeParcelas(int $quantidadeParcelas): void
    {
        if ($quantidadeParcelas <= 0) throw new InvalidArgumentException('quantidade_parcelas inválida.');
        $this->quantidadeParcelas = $quantidadeParcelas;
    }

    public function setTipoVencimento(string $tipoVencimento): void
    {
        $tipo = strtoupper(trim($tipoVencimento));
        $permitidos = ['DIARIO', 'SEMANAL', 'MENSAL'];
        if (!in_array($tipo, $permitidos, true)) {
            throw new InvalidArgumentException('tipo_vencimento inválido.');
        }
        $this->tipoVencimento = $tipo;
    }

    public function setRegraVencimento(?string $regraVencimento): void
    {
        if ($regraVencimento === null) {
            $this->regraVencimento = null;
            return;
        }

        $s = trim((string)$regraVencimento);
        $this->regraVencimento = ($s === '') ? null : $s;
    }

    public function setStatus(string $status): void
    {
        $status = strtoupper(trim($status));
        $permitidos = ['ATIVO', 'QUITADO', 'CANCELADO'];
        if (!in_array($status, $permitidos, true)) {
            throw new InvalidArgumentException('status inválido.');
        }
        $this->status = $status;
    }
}
