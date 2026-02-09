<?php

class Parcela
{
    private ?int $id = null;
    private int $emprestimoId;
    private int $numeroParcela;
    private string $dataVencimento;
    private float $valorParcela;
    private float $valorPago = 0.0;
    private string $status = 'ABERTA';

    public function setEmprestimoId(int $id): void
    {
        $this->emprestimoId = $id;
    }
    public function setNumeroParcela(int $n): void
    {
        $this->numeroParcela = $n;
    }
    public function setDataVencimento(string $d): void
    {
        $this->dataVencimento = $d;
    }
    public function setValorParcela(float $v): void
    {
        $this->valorParcela = $v;
    }
    public function setValorPago(float $v): void
    {
        $this->valorPago = $v;
    }
    public function setStatus(string $s): void
    {
        $this->status = $s;
    }

    public function getEmprestimoId(): int
    {
        return $this->emprestimoId;
    }
    public function getNumeroParcela(): int
    {
        return $this->numeroParcela;
    }
    public function getDataVencimento(): string
    {
        return $this->dataVencimento;
    }
    public function getValorParcela(): float
    {
        return $this->valorParcela;
    }
    public function getValorPago(): float
    {
        return $this->valorPago;
    }
    public function getStatus(): string
    {
        return $this->status;
    }
}
