// assets/js/clientes.js
(function () {
  const input = document.getElementById("clientesSearch");
  const list = document.getElementById("clientesList");
  if (!input || !list) return;

  const items = Array.from(list.querySelectorAll(".list-item"));
  const countEl = document.getElementById("clientesCount");

  function applyFilter() {
    const q = input.value.trim().toLowerCase();
    let visible = 0;

    items.forEach((item) => {
      const hay = (item.getAttribute("data-filter") || "").toLowerCase();
      const show = hay.includes(q);
      item.style.display = show ? "" : "none";
      if (show) visible++;
    });

    if (countEl) countEl.textContent = String(visible);
  }

  input.addEventListener("input", applyFilter);
})();
