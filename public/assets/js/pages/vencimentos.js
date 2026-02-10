// assets/js/vencimentos.js
(function () {
  const tabs = document.getElementById("vencTabs");
  if (!tabs) return;

  const buttons = Array.from(tabs.querySelectorAll(".tab"));
  const items = Array.from(document.querySelectorAll(".venc-item"));

  function applyFilter(period) {
    items.forEach(item => {
      const periods = (item.getAttribute("data-period") || "").split(" ");
      const show = periods.includes(period);
      item.style.display = show ? "" : "none";
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const period = btn.getAttribute("data-filter");
      applyFilter(period);
    });
  });
})();
