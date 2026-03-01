/* Dashboard Appartement - Version 1 (offline)
   Stockage: localStorage
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const storageKey = "apt_dashboard_v1";

const defaultState = {
  recipes: [
    {
      id: cryptoId(),
      name: "Omelette",
      ingredients: ["œufs - 2", "beurre - 10 g", "sel", "poivre"],
      steps: "1) Battre les œufs\n2) Cuire 3-4 min\n3) Assaisonner",
      cost: 1.5,
      createdAt: Date.now()
    }
  ],
  groceries: [
    { id: cryptoId(), name: "lait", qty: "1", unit: "L", done: false, createdAt: Date.now() }
  ],
  budget: [
    { id: cryptoId(), label: "Courses", amount: 18.40, cat: "Courses", date: new Date().toISOString() }
  ],
  tasks: [
    { id: cryptoId(), label: "Sortir poubelles", done: false, createdAt: Date.now() }
  ]
};

function cryptoId(){
  // Compatible vieux navigateurs
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function loadState(){
  try{
    const raw = localStorage.getItem(storageKey);
    if(!raw) return structuredCloneCompat(defaultState);
    const parsed = JSON.parse(raw);
    return mergeDefaults(parsed, defaultState);
  }catch(e){
    return structuredCloneCompat(defaultState);
  }
}

function saveState(){
  localStorage.setItem(storageKey, JSON.stringify(state));
  refreshAll();
}

function structuredCloneCompat(obj){
  return JSON.parse(JSON.stringify(obj));
}

function mergeDefaults(obj, defaults){
  const out = structuredCloneCompat(defaults);
  // shallow merge arrays/objects as-is if present
  for(const k of Object.keys(defaults)){
    if(obj && Object.prototype.hasOwnProperty.call(obj, k)){
      out[k] = obj[k];
    }
  }
  return out;
}

let state = loadState();

/* ---------- Navigation ---------- */
/* ---------- Navigation (sidebar) ---------- */
function setView(view){
  document.querySelectorAll(".navLink").forEach(b =>
    b.classList.toggle("is-active", b.dataset.view === view)
  );
  document.querySelectorAll(".view").forEach(v => v.classList.remove("is-visible"));
  const target = document.getElementById("view-" + view);
  if(target) target.classList.add("is-visible");

  const titleMap = {
    home: "Accueil",
    recipes: "Recettes",
    groceries: "Courses",
    budget: "Budget",
    tasks: "Tâches",
  };
  const pt = document.getElementById("pageTitle");
  if(pt) pt.textContent = titleMap[view] || "Dashboard";
}

document.querySelectorAll(".navLink").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

/* ---------- Clock ---------- */
function tickClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  $("#clock").textContent = `${hh}:${mm}`;
}
setInterval(tickClock, 1000);
tickClock();

/* ---------- Recipes ---------- */
function addRecipe(){
  const name = $("#r-name").value.trim();
  const ingRaw = $("#r-ingredients").value.trim();
  const steps = $("#r-steps").value.trim();
  const cost = parseFloat($("#r-cost").value || "0");

  if(!name || !ingRaw){
    alert("Nom + ingrédients requis.");
    return;
  }

  const ingredients = ingRaw
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  state.recipes.unshift({
    id: cryptoId(),
    name,
    ingredients,
    steps,
    cost: isFinite(cost) ? cost : 0,
    createdAt: Date.now()
  });

  $("#r-name").value = "";
  $("#r-ingredients").value = "";
  $("#r-steps").value = "";
  $("#r-cost").value = "";

  saveState();
}

function normalize(str){
  return (str || "")
    .toLowerCase()
    .normalize ? (str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) : str.toLowerCase();
}

function filterRecipes(){
  const nameQ = normalize($("#r-search-name").value.trim());
  const ingQ = normalize($("#r-search-ingredients").value.trim());
  const ingTokens = ingQ ? ingQ.split(",").map(s => normalize(s.trim())).filter(Boolean) : [];

  return state.recipes.filter(r => {
    const n = normalize(r.name);
    if(nameQ && !n.includes(nameQ)) return false;

    if(ingTokens.length){
      const hay = normalize(r.ingredients.join(" "));
      // Tous les ingrédients demandés doivent matcher
      for(const t of ingTokens){
        if(!hay.includes(t)) return false;
      }
    }
    return true;
  });
}

function renderRecipes(){
  const list = $("#recipes-list");
  const items = filterRecipes();

  list.innerHTML = "";
  if(!items.length){
    list.innerHTML = `<div class="muted">Aucune recette.</div>`;
    return;
  }

  for(const r of items){
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${escapeHtml(r.name)} ${r.cost ? `<span class="pill">~${formatMoney(r.cost)}€</span>` : ""}</div>
        <div class="item-sub"><strong>Ingrédients</strong>\n${escapeHtml(r.ingredients.join("\n"))}</div>
        ${r.steps ? `<div class="item-sub"><strong>Étapes</strong>\n${escapeHtml(r.steps)}</div>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn ghost" data-act="to-groceries" data-id="${r.id}">➕ Courses</button>
        <button class="btn danger ghost" data-act="del" data-id="${r.id}">✕</button>
      </div>
    `;
    list.appendChild(el);
  }

  // actions
  list.querySelectorAll("button[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      if(act === "del"){
        state.recipes = state.recipes.filter(x => x.id !== id);
        saveState();
      }
      if(act === "to-groceries"){
        const r = state.recipes.find(x => x.id === id);
        if(!r) return;
        // Ajoute chaque ingrédient "nom - qty" brut
        r.ingredients.forEach(line => {
          const [namePart, qtyPart] = line.split("-").map(s => (s||"").trim());
          state.groceries.unshift({
            id: cryptoId(),
            name: namePart || line,
            qty: qtyPart || "",
            unit: "",
            done: false,
            createdAt: Date.now()
          });
        });
        saveState();
        setView("groceries");
      }
    });
  });
}

/* Home recipe quick search */
function renderHomeRecipes(){
  const box = $("#home-recipes");
  const q = normalize($("#home-ingredient").value.trim());
  if(!q){
    box.innerHTML = `<div class="muted">Entre des ingrédients pour proposer des recettes.</div>`;
    return;
  }
  const tokens = q.split(",").map(s => normalize(s.trim())).filter(Boolean);
  const matches = state.recipes
    .map(r => {
      const hay = normalize(r.ingredients.join(" "));
      const score = tokens.reduce((acc,t)=> acc + (hay.includes(t) ? 1 : 0), 0);
      return { r, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b)=> b.score - a.score)
    .slice(0, 6);

  box.innerHTML = "";
  if(!matches.length){
    box.innerHTML = `<div class="muted">Aucune recette ne matche.</div>`;
    return;
  }

  for(const m of matches){
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${escapeHtml(m.r.name)} <span class="pill">${m.score}/${tokens.length} match</span></div>
        <div class="item-sub">${escapeHtml(m.r.ingredients.slice(0,4).join(" • "))}${m.r.ingredients.length>4 ? "…" : ""}</div>
      </div>
      <div class="item-actions">
        <button class="btn ghost" data-id="${m.r.id}">Voir</button>
      </div>
    `;
    el.querySelector("button").addEventListener("click", () => {
      setView("recipes");
      $("#r-search-name").value = m.r.name;
      $("#r-search-ingredients").value = "";
      renderRecipes();
      window.scrollTo(0,0);
    });
    box.appendChild(el);
  }
}

/* ---------- Groceries ---------- */
function addGrocery(){
  const name = $("#g-item").value.trim();
  const qty = $("#g-qty").value.trim();
  const unit = $("#g-unit").value.trim();

  if(!name){
    alert("Nom requis.");
    return;
  }

  state.groceries.unshift({
    id: cryptoId(),
    name, qty, unit,
    done: false,
    createdAt: Date.now()
  });

  $("#g-item").value = "";
  $("#g-qty").value = "";
  $("#g-unit").value = "";

  saveState();
}

function renderGroceries(){
  const list = $("#groceries-list");
  list.innerHTML = "";

  const items = state.groceries;
  if(!items.length){
    list.innerHTML = `<div class="muted">Rien à acheter.</div>`;
    return;
  }

  for(const g of items){
    const el = document.createElement("div");
    el.className = "item";
    const right = `${g.qty ? escapeHtml(g.qty) : ""}${g.unit ? " " + escapeHtml(g.unit) : ""}`.trim();
    el.innerHTML = `
      <div>
        <div class="item-title">${g.done ? "✅ " : ""}${escapeHtml(g.name)} ${right ? `<span class="pill">${right}</span>` : ""}</div>
        <div class="item-sub">${new Date(g.createdAt).toLocaleString()}</div>
      </div>
      <div class="item-actions">
        <button class="btn ghost" data-act="toggle" data-id="${g.id}">${g.done ? "Annuler" : "Fait"}</button>
        <button class="btn danger ghost" data-act="del" data-id="${g.id}">✕</button>
      </div>
    `;
    list.appendChild(el);
  }

  list.querySelectorAll("button[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      if(act === "del"){
        state.groceries = state.groceries.filter(x => x.id !== id);
        saveState();
      }
      if(act === "toggle"){
        const it = state.groceries.find(x => x.id === id);
        if(!it) return;
        it.done = !it.done;
        saveState();
      }
    });
  });
}

/* ---------- Budget ---------- */
function addExpense(){
  const label = $("#b-label").value.trim();
  const amount = parseFloat($("#b-amount").value || "0");
  const cat = $("#b-cat").value;

  if(!label || !isFinite(amount) || amount <= 0){
    alert("Libellé + montant > 0 requis.");
    return;
  }

  state.budget.unshift({
    id: cryptoId(),
    label,
    amount: Math.round(amount * 100) / 100,
    cat,
    date: new Date().toISOString()
  });

  $("#b-label").value = "";
  $("#b-amount").value = "";

  saveState();
}

function formatMoney(n){
  return (Math.round((n || 0) * 100) / 100).toFixed(2);
}

function renderBudget(){
  const list = $("#budget-list");
  list.innerHTML = "";

  const total = state.budget.reduce((acc,x)=> acc + (x.amount || 0), 0);

  const now = new Date();
  const ym = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
  const monthTotal = state.budget.reduce((acc,x)=>{
    const d = new Date(x.date);
    const xym = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    return acc + (xym === ym ? (x.amount || 0) : 0);
  }, 0);

  $("#b-total").textContent = `${formatMoney(total)} €`;
  $("#b-month").textContent = `${formatMoney(monthTotal)} €`;

  if(!state.budget.length){
    list.innerHTML = `<div class="muted">Aucune dépense.</div>`;
    return;
  }

  for(const e of state.budget){
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${escapeHtml(e.label)} <span class="pill">${escapeHtml(e.cat)}</span></div>
        <div class="item-sub">${new Date(e.date).toLocaleString()} • <strong>${formatMoney(e.amount)} €</strong></div>
      </div>
      <div class="item-actions">
        <button class="btn danger ghost" data-act="del" data-id="${e.id}">✕</button>
      </div>
    `;
    el.querySelector("button").addEventListener("click", () => {
      state.budget = state.budget.filter(x => x.id !== e.id);
      saveState();
    });
    list.appendChild(el);
  }
}

/* ---------- Tasks ---------- */
function addTask(){
  const label = $("#t-item").value.trim();
  if(!label){
    alert("Tâche requise.");
    return;
  }
  state.tasks.unshift({ id: cryptoId(), label, done:false, createdAt: Date.now() });
  $("#t-item").value = "";
  saveState();
}

function renderTasks(){
  const list = $("#tasks-list");
  list.innerHTML = "";

  if(!state.tasks.length){
    list.innerHTML = `<div class="muted">Aucune tâche.</div>`;
    return;
  }

  for(const t of state.tasks){
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${t.done ? "✅ " : ""}${escapeHtml(t.label)}</div>
        <div class="item-sub">${new Date(t.createdAt).toLocaleString()}</div>
      </div>
      <div class="item-actions">
        <button class="btn ghost" data-act="toggle" data-id="${t.id}">${t.done ? "Réouvrir" : "Fait"}</button>
        <button class="btn danger ghost" data-act="del" data-id="${t.id}">✕</button>
      </div>
    `;
    list.appendChild(el);
  }

  list.querySelectorAll("button[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      if(act === "del"){
        state.tasks = state.tasks.filter(x => x.id !== id);
        saveState();
      }
      if(act === "toggle"){
        const it = state.tasks.find(x => x.id === id);
        if(!it) return;
        it.done = !it.done;
        saveState();
      }
    });
  });
}

/* ---------- KPIs (Home) ---------- */
function renderKpis(){
  const groceriesTodo = state.groceries.filter(x => !x.done).length;
  const tasksTodo = state.tasks.filter(x => !x.done).length;
  $("#kpi-groceries").textContent = groceriesTodo;
  $("#kpi-tasks").textContent = tasksTodo;
}

/* ---------- Export / Import ---------- */
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dashboard-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = mergeDefaults(parsed, defaultState);
      saveState();
      alert("Import OK.");
    }catch(e){
      alert("Fichier invalide.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Helpers ---------- */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------- Bindings ---------- */
$("#r-add").addEventListener("click", addRecipe);
$("#r-search").addEventListener("click", renderRecipes);
$("#r-search-name").addEventListener("input", renderRecipes);
$("#r-search-ingredients").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); renderRecipes(); }});

$("#r-clear").addEventListener("click", () => {
  if(confirm("Supprimer toutes les recettes ?")){
    state.recipes = [];
    saveState();
  }
});

$("#g-add").addEventListener("click", addGrocery);
$("#g-clear").addEventListener("click", () => {
  if(confirm("Supprimer toute la liste de courses ?")){
    state.groceries = [];
    saveState();
  }
});

$("#b-add").addEventListener("click", addExpense);
$("#b-clear").addEventListener("click", () => {
  if(confirm("Supprimer toutes les dépenses ?")){
    state.budget = [];
    saveState();
  }
});

$("#t-add").addEventListener("click", addTask);
$("#t-clear").addEventListener("click", () => {
  if(confirm("Supprimer toutes les tâches ?")){
    state.tasks = [];
    saveState();
  }
});

$("#home-search").addEventListener("click", renderHomeRecipes);
$("#home-ingredient").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); renderHomeRecipes(); }});
$("#home-ingredient").addEventListener("input", () => {
  // évite de spammer sur vieux devices : petit debounce simple
  clearTimeout(window.__homeT);
  window.__homeT = setTimeout(renderHomeRecipes, 250);
});

$("#export").addEventListener("click", exportData);
$("#import").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if(f) importData(f);
  e.target.value = "";
});

/* ---------- Refresh ---------- */
function refreshAll(){
  renderRecipes();
  renderGroceries();
  renderBudget();
  renderTasks();
  renderKpis();
  renderHomeRecipes();
}

refreshAll();
// Notes cuisine
(function(){
  const KEY = "kitchen_notes_v1";
  const notes = document.getElementById("kitchenNotes");
  const save = document.getElementById("saveNotes");
  const clear = document.getElementById("clearNotes");

  if(!notes) return;

  notes.value = localStorage.getItem(KEY) || "";

  save?.addEventListener("click", () => {
    localStorage.setItem(KEY, notes.value || "");
    alert("Notes sauvées ✅");
  });

  clear?.addEventListener("click", () => {
    if(!confirm("Vider les notes ?")) return;
    notes.value = "";
    localStorage.setItem(KEY, "");
  });
})();
