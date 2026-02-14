<?php

require_once __DIR__ . '/../models/dtos/ClienteDTO.php';
require_once __DIR__ . '/../models/entities/Cliente.php';
require_once __DIR__ . '/../models/daos/ClienteDAO.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';

class ClienteController
{
    public function criar(): void
    {
        try {
            $dados = $_POST;

            $dto = new ClienteDTO($dados);
            $dto->validar();

            $cliente = new Cliente();
            $cliente->setNome($dto->nome);
            $cliente->setCpf($dto->cpf);
            $cliente->setTelefone($dto->telefone);
            $cliente->setEndereco($dto->endereco);
            $cliente->setProfissao($dto->profissao);
            $cliente->setPlacaCarro($dto->placa_carro);
            $cliente->setIndicacao($dto->indicacao);

            $dao = new ClienteDAO();
            $id = $dao->criar($cliente);

            // ✅ NOVO: processa documentos (se vierem)
            $docs = $this->salvarDocumentosUpload((int)$id, $_FILES['documentos'] ?? null);

            $this->responderJson(true, 'Cliente criado com sucesso', [
                'id' => (int)$id,
                'documentos' => $docs
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function listar(): void
    {
        try {
            $dao = new ClienteDAO();
            $linhas = $dao->listar();

            $dados = [];
            foreach ($linhas as $row) {
                $dados[] = [
                    'id' => (int)$row['id'],
                    'nome' => $row['nome'],
                    'cpf' => $row['cpf'] ?? null,
                    'telefone' => $row['telefone'] ?? null,
                    'endereco' => $row['endereco'] ?? null,
                    'profissao' => $row['profissao'] ?? null,
                    'placa_carro' => $row['placa_carro'] ?? null,
                    'indicacao' => $row['indicacao'] ?? null,
                    'tem_emprestimo_ativo' => (int)($row['tem_emprestimo_ativo'] ?? 0),
                ];
            }

            $this->responderJson(true, 'Lista de clientes', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function detalhes(): void
    {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dao = new ClienteDAO();
            $c = $dao->buscarPorId($id);

            if (!$c) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            $dados = [
                'id' => $c->getId(),
                'nome' => $c->getNome(),
                'cpf' => $c->getCpf(),
                'telefone' => $c->getTelefone(),
                'endereco' => $c->getEndereco(),
                'profissao' => $c->getProfissao(),
                'placa_carro' => $c->getPlacaCarro(),
                'indicacao' => $c->getIndicacao(),
                // ✅ NOVO: lista documentos do cliente
                'documentos' => $this->listarDocumentos((int)$c->getId()),
            ];

            $this->responderJson(true, 'Detalhes do cliente', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function atualizar(): void
    {
        try {
            $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dto = new ClienteDTO($_POST);
            $dto->validar();

            $dao = new ClienteDAO();
            $existente = $dao->buscarPorId($id);
            if (!$existente) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            $existente->setNome($dto->nome);
            $existente->setCpf($dto->cpf);
            $existente->setTelefone($dto->telefone);
            $existente->setEndereco($dto->endereco);
            $existente->setProfissao($dto->profissao);
            $existente->setPlacaCarro($dto->placa_carro);
            $existente->setIndicacao($dto->indicacao);

            $dao->atualizar($existente);

            // ✅ NOVO: processa documentos (se vierem)
            $docsNovos = $this->salvarDocumentosUpload((int)$id, $_FILES['documentos'] ?? null);
            $docsTodos = $this->listarDocumentos((int)$id);

            $this->responderJson(true, 'Cliente atualizado com sucesso', [
                'id' => (int)$existente->getId(),
                'documentos_novos' => $docsNovos,
                'documentos' => $docsTodos,
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function excluir(): void
    {
        try {
            $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dao = new ClienteDAO();
            $empDAO = new EmprestimoDAO();

            $cliente = $dao->buscarPorId($id);

            if (!$cliente) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            // 🔥 REGRA DE NEGÓCIO
            $emprestimos = $empDAO->listarPorCliente($id);

            if ($emprestimos && count($emprestimos) > 0) {
                throw new RuntimeException(
                    'Não é possível excluir este cliente, pois ele possui empréstimos registrados no sistema.'
                );
            }

            $dao->excluir($id);

            // opcional: apagar a pasta de uploads também
            // $this->removerPastaUploadsCliente($id);

            $this->responderJson(true, 'Cliente excluído com sucesso');
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    /* =========================================================
       ✅ ENDPOINTS (rotas) para documentos
       - clientes/documentos/listar  (GET)
       - clientes/documentos/excluir (POST)
    ========================================================= */

    public function documentosListar(): void
    {
        try {
            $clienteId = isset($_GET['cliente_id']) ? (int)$_GET['cliente_id'] : 0;
            if ($clienteId <= 0) throw new InvalidArgumentException('cliente_id inválido.');

            // valida se cliente existe
            $dao = new ClienteDAO();
            $c = $dao->buscarPorId($clienteId);
            if (!$c) throw new RuntimeException('Cliente não encontrado.');

            $docs = $this->listarDocumentos($clienteId);

            $this->responderJson(true, 'Documentos do cliente', [
                'cliente_id' => $clienteId,
                'documentos' => $docs
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function documentosExcluir(): void
    {
        try {
            $clienteId = isset($_POST['cliente_id']) ? (int)$_POST['cliente_id'] : 0;
            $docId = isset($_POST['doc_id']) ? trim((string)$_POST['doc_id']) : '';

            if ($clienteId <= 0) throw new InvalidArgumentException('cliente_id inválido.');
            if ($docId === '') throw new InvalidArgumentException('doc_id inválido.');

            // valida se cliente existe
            $dao = new ClienteDAO();
            $c = $dao->buscarPorId($clienteId);
            if (!$c) throw new RuntimeException('Cliente não encontrado.');

            $index = $this->loadIndex($clienteId);
            if (!$index) {
                throw new RuntimeException('Nenhum documento encontrado para este cliente.');
            }

            $found = null;
            $newIndex = [];
            foreach ($index as $it) {
                if ((string)($it['id'] ?? '') === $docId) {
                    $found = $it;
                    continue;
                }
                $newIndex[] = $it;
            }

            if (!$found) {
                throw new RuntimeException('Documento não encontrado.');
            }

            // segurança: só apaga dentro da pasta do cliente
            $dirCliente = $this->uploadsBaseDir() . DIRECTORY_SEPARATOR . $clienteId;
            $arquivo = (string)($found['arquivo'] ?? '');
            if ($arquivo === '') throw new RuntimeException('Arquivo inválido no índice.');

            $fullPath = $dirCliente . DIRECTORY_SEPARATOR . $arquivo;
            $realBase = realpath($dirCliente);
            $realFile = file_exists($fullPath) ? realpath($fullPath) : false;

            if (!$realBase || !$realFile || strpos($realFile, $realBase) !== 0) {
                throw new RuntimeException('Caminho inválido para exclusão.');
            }

            if (file_exists($realFile)) {
                @unlink($realFile);
            }

            $this->saveIndex($clienteId, $newIndex);

            $this->responderJson(true, 'Documento excluído', [
                'cliente_id' => $clienteId,
                'doc_id' => $docId,
                'documentos' => $this->listarDocumentos($clienteId),
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    /* =========================================================
       ✅ DOCS: Upload + Index JSON (sem mexer no banco)
    ========================================================= */

    private function uploadsBaseDir(): string
    {
        // /KRAx/public/uploads/clientes
        $public = realpath(__DIR__ . '/../../public');
        if (!$public) {
            throw new RuntimeException("Pasta /public não encontrada.");
        }

        return $public . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'clientes';
    }

    private function ensureDir(string $dir): void
    {
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new RuntimeException("Não foi possível criar diretório de uploads.");
            }
        }
    }

    private function indexPath(int $clienteId): string
    {
        return $this->uploadsBaseDir() . DIRECTORY_SEPARATOR . $clienteId . DIRECTORY_SEPARATOR . '_index.json';
    }

    private function loadIndex(int $clienteId): array
    {
        $idx = $this->indexPath($clienteId);
        if (!file_exists($idx)) return [];

        $raw = file_get_contents($idx);
        $arr = json_decode($raw ?: '[]', true);
        return is_array($arr) ? $arr : [];
    }

    private function saveIndex(int $clienteId, array $items): void
    {
        $idx = $this->indexPath($clienteId);
        $this->ensureDir(dirname($idx));
        file_put_contents($idx, json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private function sanitizeFilename(string $name): string
    {
        $name = trim($name);
        $name = str_replace(["\\", "/"], "-", $name);
        $name = preg_replace('/[^\w\s\.\-\(\)\[\]]+/u', '', $name) ?: 'arquivo';
        $name = preg_replace('/\s+/', ' ', $name);
        return trim($name);
    }

    private function normalizeFilesArray($files): array
    {
        // Transforma $_FILES['documentos'] em lista uniforme
        if (!$files || !is_array($files)) return [];

        // single
        if (!is_array($files['name'] ?? null)) {
            return [[
                'name' => $files['name'] ?? '',
                'type' => $files['type'] ?? '',
                'tmp_name' => $files['tmp_name'] ?? '',
                'error' => $files['error'] ?? UPLOAD_ERR_NO_FILE,
                'size' => $files['size'] ?? 0,
            ]];
        }

        // multiple
        $out = [];
        $count = count($files['name'] ?? []);
        for ($i = 0; $i < $count; $i++) {
            $out[] = [
                'name' => $files['name'][$i] ?? '',
                'type' => $files['type'][$i] ?? '',
                'tmp_name' => $files['tmp_name'][$i] ?? '',
                'error' => $files['error'][$i] ?? UPLOAD_ERR_NO_FILE,
                'size' => $files['size'][$i] ?? 0,
            ];
        }
        return $out;
    }

    private function listarDocumentos(int $clienteId): array
    {
        $base = $this->uploadsBaseDir() . DIRECTORY_SEPARATOR . $clienteId;
        if (!is_dir($base)) return [];

        $items = $this->loadIndex($clienteId);

        // mais recentes primeiro (criado_em ISO)
        usort($items, function ($a, $b) {
            return strcmp((string)($b['criado_em'] ?? ''), (string)($a['criado_em'] ?? ''));
        });

        return $items;
    }

    private function salvarDocumentosUpload(int $clienteId, $files): array
    {
        $lista = $this->normalizeFilesArray($files);
        if (!$lista) return [];

        // se não tem arquivo de verdade, sai
        $hasAny = false;
        foreach ($lista as $f) {
            if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $hasAny = true;
                break;
            }
        }
        if (!$hasAny) return [];

        $dirCliente = $this->uploadsBaseDir() . DIRECTORY_SEPARATOR . $clienteId;
        $this->ensureDir($dirCliente);

        $index = $this->loadIndex($clienteId);
        $novos = [];

        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : null;

        foreach ($lista as $f) {
            $err = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
            if ($err === UPLOAD_ERR_NO_FILE) continue;

            if ($err !== UPLOAD_ERR_OK) {
                throw new RuntimeException("Falha ao anexar arquivo ({$f['name']}), código {$err}.");
            }

            $tmp = (string)($f['tmp_name'] ?? '');
            if (!$tmp || !is_uploaded_file($tmp)) {
                throw new RuntimeException("Arquivo inválido para upload ({$f['name']}).");
            }

            $origName = $this->sanitizeFilename((string)($f['name'] ?? 'arquivo'));
            $size = (int)($f['size'] ?? 0);

            // limites (ajuste se quiser)
            if ($size <= 0) {
                throw new RuntimeException("Arquivo vazio ({$origName}).");
            }
            if ($size > 25 * 1024 * 1024) { // 25MB
                throw new RuntimeException("Arquivo muito grande ({$origName}). Máximo 25MB.");
            }

            $ext = '';
            $pos = strrpos($origName, '.');
            if ($pos !== false) $ext = strtolower(substr($origName, $pos));

            // mime "real"
            $mime = '';
            if ($finfo) {
                $mime = (string)finfo_file($finfo, $tmp);
            }
            if (!$mime) {
                $mime = (string)($f['type'] ?? 'application/octet-stream');
            }

            // nome único
            $rand = bin2hex(random_bytes(6));
            $safeBase = preg_replace('/\.[^.]+$/', '', $origName);
            $safeBase = $this->sanitizeFilename($safeBase);
            $stored = date('Ymd_His') . '_' . $rand . '_' . $safeBase . ($ext ?: '');

            $dest = $dirCliente . DIRECTORY_SEPARATOR . $stored;

            if (!move_uploaded_file($tmp, $dest)) {
                throw new RuntimeException("Não foi possível salvar o arquivo ({$origName}).");
            }

            // URL pública (como fica dentro de /public)
            $publicUrl = "/KRAx/public/uploads/clientes/{$clienteId}/" . rawurlencode($stored);

            $item = [
                'id' => $rand, // id simples no index
                'nome_original' => $origName,
                'arquivo' => $stored,
                'mime' => $mime,
                'tamanho' => $size,
                'url' => $publicUrl,
                'criado_em' => date('c'),
            ];

            $index[] = $item;
            $novos[] = $item;
        }

        if ($finfo) finfo_close($finfo);

        $this->saveIndex($clienteId, $index);
        return $novos;
    }

    // (Opcional) se quiser apagar tudo ao excluir cliente
    private function removerPastaUploadsCliente(int $clienteId): void
    {
        $dir = $this->uploadsBaseDir() . DIRECTORY_SEPARATOR . $clienteId;
        if (!is_dir($dir)) return;

        $rii = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($rii as $file) {
            if ($file->isDir()) rmdir($file->getPathname());
            else unlink($file->getPathname());
        }
        rmdir($dir);
    }

    private function responderJson(bool $ok, string $mensagem, array $dados = []): void
    {
        header('Content-Type: application/json');
        echo json_encode([
            'ok' => $ok,
            'mensagem' => $mensagem,
            'dados' => $dados
        ]);
        exit;
    }
}
