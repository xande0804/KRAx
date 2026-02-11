<?php
$pageJs = $pageJs ?? [];
?>
</main>

<!-- JS base (sempre carregados) -->
<script src="../../public/assets/js/app.js"></script>
<script src="../../public/assets/js/ux/toast.js"></script>
<script src="../../public/assets/js/modals/core.js"></script>
<script src="../../public/assets/js/utils/masks.js"></script>

<!-- Modais globais -->
<script src="../../public/assets/js/modals/excluirCliente.action.js"></script>
<script src="../../public/assets/js/modals/novoEmprestimo.modal.js"></script>
<script src="../../public/assets/js/modals/novoCliente.modal.js"></script>
<script src="../../public/assets/js/modals/detalhesCliente.modal.js"></script>
<script src="../../public/assets/js/modals/editarCliente.modal.js"></script>
<script src="../../public/assets/js/modals/lancarPagamento.modal.js"></script>
<script src="../../public/assets/js/modals/detalhesEmprestimo.modal.js"></script>
<script src="../../public/assets/js/modals/index.js"></script>

<!-- JS específicos da página -->
<?php foreach ($pageJs as $js): ?>
  <script src="../../public/assets/js/<?= $js ?>.js"></script>
<?php endforeach; ?>

</body>
</html>
