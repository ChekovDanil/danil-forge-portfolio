const exportId = new URLSearchParams(window.location.search).get("export");

if (exportId) {
  document.body.classList.add("export-mode");
  for (const artboard of document.querySelectorAll("[data-art]")) {
    artboard.hidden = artboard.dataset.art !== exportId;
    artboard.closest(".board-wrap").hidden = artboard.hidden;
  }
  document.title = `Routine export · ${exportId}`;
}
