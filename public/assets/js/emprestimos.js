// assets/js/emprestimos.js
(function () {
  const tabsContainer = document.getElementById("emprestimosTabs");
  if (!tabsContainer) return;

  const tabs = Array.from(tabsContainer.querySelectorAll(".tab"));
  const items = Array.from(document.querySelectorAll(".list-item"));

  function applyFilter(filter) {
    let visibleCount = 0;

    items.forEach(item => {
      const status = item.getAttribute("data-status");

      const show =
        filter === "all" ||
        status === filter;

      item.style.display = show ? "" : "none";
      if (show) visibleCount++;
    });

    return visibleCount;
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const filter = tab.getAttribute("data-filter");

      // remove active de todas
      tabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      applyFilter(filter);
    });
  });
})();
