/* Public homepage impact-statistics content, controlled from Owner Admin. */
(() => {
  "use strict";
  const section = document.querySelector(".fm-reach-section");
  if (!section) return;
  async function apply() {
    try {
      const response = await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/content", {cache:"no-store"});
      if (!response.ok) return;
      const data = await response.json();
      const entries = data && data.entries && typeof data.entries === "object" ? data.entries : {};
      const visibility = entries["impact.visible"];
      if (visibility && typeof visibility.text === "string") section.hidden = visibility.text.trim().toLowerCase() === "false";
      section.querySelectorAll("[data-content-key]").forEach(element => {
        const item = entries[element.getAttribute("data-content-key")];
        if (item && typeof item.text === "string") {
          element.textContent = item.text;
          element.style.textDecoration = item.struck ? "line-through" : "";
        }
      });
    } catch (_) {
      /* Keep the authored defaults visible if the content service is unavailable. */
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, {once:true});
  else apply();
})();
