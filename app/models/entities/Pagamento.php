<?php

class Pagamento
{
    private ?int $id = null;
    private int $emprestimoId;
    private ?int $parcelaId = null;
    private float $valorPago;
    private string $tipoPagamento; 
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
    public function getObservacao(): ?string
    {
        return $this->observacao;
    }
}
