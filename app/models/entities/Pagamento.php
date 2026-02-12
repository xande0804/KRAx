<?php

class Pagamento
{
    private ?int $id = null;
    private int $emprestimoId;
    private ?int $parcelaId = null;
    private float $valorPago;
    private string $tipoPagamento;
    private string $dataPagamento; // YYYY-MM-DD
    private ?string $observacao = null;

    public function setEmprestimoId(int $id): void
    {
        $this->emprestimoId = $id;
    }

    public function setParcelaId(?int $id): void
    {
        $this->parcelaId = $id;
    }

    public function setValorPago(float $v): void
    {
        $this->valorPago = $v;
    }

    public function setTipoPagamento(string $t): void
    {
        $this->tipoPagamento = strtoupper(trim($t));
    }

    public function setDataPagamento(string $data): void
    {
        $data = trim((string)$data);

        // aceita "YYYY-MM-DD" (input type="date" manda assim)
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            throw new InvalidArgumentException('data_pagamento inválida. Use o formato YYYY-MM-DD.');
        }

        // valida data real (ex: 2026-02-30)
        $dt = DateTime::createFromFormat('Y-m-d', $data);
        $ok = $dt && $dt->format('Y-m-d') === $data;

        if (!$ok) {
            throw new InvalidArgumentException('data_pagamento inválida.');
        }

        $this->dataPagamento = $data;
    }

    public function setObservacao(?string $o): void
    {
        $this->observacao = $o ? trim($o) : null;
    }

    public function getEmprestimoId(): int
    {
        return $this->emprestimoId;
    }

    public function getParcelaId(): ?int
    {
        return $this->parcelaId;
    }

    public function getValorPago(): float
    {
        return $this->valorPago;
    }

    public function getTipoPagamento(): string
    {
        return $this->tipoPagamento;
    }

    public function getDataPagamento(): string
    {
        return $this->dataPagamento;
    }

    public function getObservacao(): ?string
    {
        return $this->observacao;
    }
}
