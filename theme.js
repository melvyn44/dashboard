// theme.js
(function(){
  const KEY = "apt_theme";
  const root = document.documentElement;

  function apply(theme){
    root.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
  }

  const saved = localStorage.getItem(KEY);
  if(saved === "light" || saved === "dark") apply(saved);
  else apply("dark"); // défaut

  const btn = document.getElementById("themeToggle");
  if(btn){
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      apply(cur === "dark" ? "light" : "dark");
    });
  }
})();
