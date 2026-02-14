<?php
$pageJs = $pageJs ?? [];
?>
</main>

<!-- JS base (sempre carregados) -->
<script src="/KRAx/public/assets/js/ux/toast.js"></script>
<script src="/KRAx/public/assets/js/modals/core.js"></script>
<script src="/KRAx/public/assets/js/utils/masks.js"></script>

<!-- Modais globais -->
<script src="/KRAx/public/assets/js/modals/excluirCliente.action.js"></script>
<script src="/KRAx/public/assets/js/modals/novoEmprestimo.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/novoCliente.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/detalhesCliente.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/editarCliente.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/lancarPagamento.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/editarEmprestimo.modal.js"></script>

<script src="/KRAx/public/assets/js/modals/detalhesEmprestimo.modal.js"></script>
<script src="/KRAx/public/assets/js/modals/index.js"></script>

<!-- JS específicos da página -->
<?php foreach ($pageJs as $js): ?>
  <script src="/KRAx/public/assets/js/<?= $js ?>.js"></script>
<?php endforeach; ?>

</body>
</html>
