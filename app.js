/* =======================================================================
   Menus Familiaux — logique de l'application
   Stockage: localStorage (aucune donnée n'est envoyée sur internet)
   ======================================================================= */

const STORAGE_KEY = "menusFamiliaux_v5";

const CAT_LABELS = { entree: "Entrée", plat: "Plat", dessert: "Dessert" };
const CAT_ORDER = ["entree", "plat", "dessert"];
const MEAL_LABELS = { lunch: "Déjeuner", dinner: "Dîner" };

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// ------------------------------------------------------------------
// Data store
// ------------------------------------------------------------------
let data = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dishes: parsed.dishes || [],
        days: parsed.days || {},
        periods: parsed.periods || []
      };
    }
  } catch (e) {
    console.error("Erreur de lecture des données", e);
  }
  return { dishes: [], days: {}, periods: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fmtDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDateBadge(iso) {
  const d = parseISO(iso);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

function mondayOf(iso) {
  const d = parseISO(iso);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return fmtDateISO(d);
}

function fmtWeekLabel(iso) {
  const d = parseISO(iso);
  return `Semaine du ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

// ------------------------------------------------------------------
// Toast
// ------------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ------------------------------------------------------------------
// Modal helpers
// ------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.add("active");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("active");
  });
});

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("screen-" + btn.dataset.screen).classList.add("active");
  });
});

// =======================================================================
// PLANNING SCREEN
// =======================================================================

function renderPlanning() {
  const container = document.getElementById("planningList");
  const dates = Object.keys(data.days).sort();

  if (dates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big">📅</div>
        <p><strong>Aucune période planifiée</strong><br/>Créez votre première période pour générer le calendrier des repas.</p>
      </div>`;
    return;
  }

  let html = "";
  let lastWeek = null;
  for (const iso of dates) {
    const week = mondayOf(iso);
    if (week !== lastWeek) {
      html += `<div class="week-divider">${fmtWeekLabel(week)}</div>`;
      lastWeek = week;
    }
    const day = data.days[iso];
    html += renderDayCard(iso, day);
  }
  container.innerHTML = html;

  container.querySelectorAll("[data-meal-slot]").forEach((el) => {
    el.addEventListener("click", () => {
      openMealComposer(el.dataset.date, el.dataset.meal);
    });
  });
  container.querySelectorAll("[data-dish-view]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openDishDetail(el.dataset.dishView);
    });
  });
}

function renderDayCard(iso, day) {
  const peopleTxt = day.personCount != null ? `${day.personCount} convives` : "Nombre de convives non défini";
  return `
    <div class="card day-card">
      <span class="date-badge">${fmtDateBadge(iso)}</span>
      <div class="day-people">${peopleTxt}</div>
      ${renderMealRow(iso, "lunch", day.lunch || [])}
      ${renderMealRow(iso, "dinner", day.dinner || [])}
    </div>`;
}

function renderMealRow(iso, mealType, dishIds) {
  const label = MEAL_LABELS[mealType];
  if (!dishIds || dishIds.length === 0) {
    return `
      <div class="meal-row">
        <div class="meal-label">${label}</div>
        <button class="meal-empty-btn" data-meal-slot data-date="${iso}" data-meal="${mealType}">+ Ajouter le ${label.toLowerCase()}</button>
      </div>`;
  }
  const chips = dishIds
    .map((id) => {
      const dish = data.dishes.find((d) => d.id === id);
      const name = dish ? dish.name : "Plat supprimé";
      return `<button class="dish-chip" data-dish-view="${id}">${escapeHtml(name)}</button>`;
    })
    .join("");
  return `
    <div class="meal-row" data-meal-slot data-date="${iso}" data-meal="${mealType}">
      <div class="meal-label">${label}</div>
      ${chips}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ------------------- New period modal -------------------

let editingPeriodId = null;

document.getElementById("btnNewPeriod").addEventListener("click", () => openPeriodForm(null));

document.getElementById("btnAddRange").addEventListener("click", () => addRangeRow());

function addRangeRow(prefill) {
  const container = document.getElementById("rangesContainer");
  const row = document.createElement("div");
  row.className = "range-row";
  row.innerHTML = `
    <input type="date" class="range-start" value="${prefill ? prefill.start : ""}" />
    <input type="date" class="range-end" value="${prefill ? prefill.end : ""}" />
    <input type="number" class="range-count" min="1" placeholder="Pers." value="${prefill ? prefill.count : ""}" />
    <button class="range-remove" type="button">✕</button>`;
  row.querySelector(".range-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function openPeriodForm(periodId) {
  editingPeriodId = periodId;
  const period = periodId ? data.periods.find((p) => p.id === periodId) : null;

  document.getElementById("periodModalTitle").textContent = period ? "Modifier la période" : "Nouvelle période";
  document.getElementById("btnSavePeriod").textContent = period ? "Enregistrer les modifications" : "Générer le calendrier";
  document.getElementById("btnDeletePeriod").style.display = period ? "block" : "none";

  document.getElementById("periodStart").value = period ? period.start : "";
  document.getElementById("periodEnd").value = period ? period.end : "";
  document.getElementById("rangesContainer").innerHTML = "";
  if (period && period.ranges.length) {
    period.ranges.forEach((r) => addRangeRow(r));
  } else {
    addRangeRow();
  }
  openModal("modalPeriod");
}

function readRangesFromForm() {
  const rangeRows = document.querySelectorAll("#rangesContainer .range-row");
  const ranges = [];
  rangeRows.forEach((row) => {
    const rStart = row.querySelector(".range-start").value;
    const rEnd = row.querySelector(".range-end").value;
    const rCount = parseInt(row.querySelector(".range-count").value, 10);
    if (rStart && rEnd && rCount) {
      ranges.push({ start: rStart, end: rEnd, count: rCount });
    }
  });
  return ranges;
}

// Removes days that belonged to a period and fall outside [newStart, newEnd].
// Returns true if any removed day already had meals planned (for a confirmation warning).
function pruneDaysOutsideRange(periodId, newStart, newEnd) {
  let hadMeals = false;
  Object.keys(data.days).forEach((iso) => {
    const day = data.days[iso];
    if (day.periodId === periodId && (iso < newStart || iso > newEnd)) {
      if ((day.lunch && day.lunch.length) || (day.dinner && day.dinner.length)) hadMeals = true;
      delete data.days[iso];
    }
  });
  return hadMeals;
}

function applyPeriodToDays(period) {
  const d = parseISO(period.start);
  const endD = parseISO(period.end);
  let count = 0;
  while (d <= endD) {
    const iso = fmtDateISO(d);
    const range = period.ranges.find((r) => iso >= r.start && iso <= r.end);
    const personCount = range ? range.count : null;
    if (!data.days[iso]) {
      data.days[iso] = { personCount, lunch: [], dinner: [], periodId: period.id };
    } else {
      data.days[iso].personCount = personCount;
      data.days[iso].periodId = period.id;
    }
    count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

document.getElementById("btnSavePeriod").addEventListener("click", () => {
  const start = document.getElementById("periodStart").value;
  const end = document.getElementById("periodEnd").value;
  if (!start || !end) {
    showToast("Merci de renseigner les deux dates.");
    return;
  }
  if (parseISO(end) < parseISO(start)) {
    showToast("La date de fin doit être après la date de début.");
    return;
  }

  const ranges = readRangesFromForm();
  if (ranges.length === 0) {
    showToast("Ajoutez au moins une plage avec un nombre de convives.");
    return;
  }

  if (editingPeriodId) {
    const period = data.periods.find((p) => p.id === editingPeriodId);
    const hadMeals = pruneDaysOutsideRange(editingPeriodId, start, end);
    if (hadMeals && !confirm("Réduire la période supprimera des repas déjà planifiés en dehors des nouvelles dates. Continuer ?")) {
      return;
    }
    period.start = start;
    period.end = end;
    period.ranges = ranges;
    applyPeriodToDays(period);
    saveData();
    closeModal("modalPeriod");
    renderPeriods();
    renderPlanning();
    showToast("Période mise à jour.");
  } else {
    const period = { id: uid(), start, end, ranges };
    data.periods.push(period);
    const created = applyPeriodToDays(period);
    saveData();
    closeModal("modalPeriod");
    renderPeriods();
    renderPlanning();
    showToast(`Calendrier généré : ${created} jour(s).`);
  }
});

document.getElementById("btnDeletePeriod").addEventListener("click", () => {
  if (!editingPeriodId) return;
  const affectedDays = Object.values(data.days).filter((d) => d.periodId === editingPeriodId);
  const hasMeals = affectedDays.some((d) => (d.lunch && d.lunch.length) || (d.dinner && d.dinner.length));
  const msg = hasMeals
    ? "Supprimer cette période effacera aussi les repas déjà planifiés sur ces jours. Continuer ?"
    : "Supprimer cette période et les jours associés du calendrier ?";
  if (!confirm(msg)) return;

  Object.keys(data.days).forEach((iso) => {
    if (data.days[iso].periodId === editingPeriodId) delete data.days[iso];
  });
  data.periods = data.periods.filter((p) => p.id !== editingPeriodId);
  saveData();
  closeModal("modalPeriod");
  renderPeriods();
  renderPlanning();
  showToast("Période supprimée.");
});

function renderPeriods() {
  const container = document.getElementById("periodsList");
  if (!data.periods || data.periods.length === 0) {
    container.innerHTML = "";
    return;
  }
  const sorted = data.periods.slice().sort((a, b) => a.start.localeCompare(b.start));
  container.innerHTML = sorted
    .map((p) => {
      const summary = p.ranges
        .map((r) => `${r.count} pers. (${fmtDateBadge(r.start)} → ${fmtDateBadge(r.end)})`)
        .join(" · ");
      return `
      <div class="period-card">
        <div class="info">
          <span class="dates">${fmtDateBadge(p.start)} → ${fmtDateBadge(p.end)}</span>
          <span class="ranges-summary">${escapeHtml(summary)}</span>
        </div>
        <div class="actions">
          <button class="icon-btn" data-period-edit="${p.id}">✏️</button>
          <button class="icon-btn danger" data-period-delete="${p.id}">🗑️</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-period-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openPeriodForm(btn.dataset.periodEdit));
  });
  container.querySelectorAll("[data-period-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingPeriodId = btn.dataset.periodDelete;
      document.getElementById("btnDeletePeriod").click();
    });
  });
}

// =======================================================================
// MEAL COMPOSER
// =======================================================================

let composerState = null; // { date, mealType, selections: {entree:[], plat:[], dessert:[]} }

function openMealComposer(date, mealType) {
  const day = data.days[date];
  const existing = day[mealType] || [];
  const selections = { entree: [], plat: [], dessert: [] };
  existing.forEach((id) => {
    const dish = data.dishes.find((d) => d.id === id);
    if (dish && selections[dish.category]) selections[dish.category].push(id);
  });

  composerState = { date, mealType, selections, personCount: day.personCount };

  document.getElementById("mealComposerTitle").textContent =
    `${MEAL_LABELS[mealType]} — ${fmtDateBadge(date)}`;
  document.getElementById("mealComposerSubtitle").textContent =
    day.personCount != null ? `Prévu pour ${day.personCount} personnes` : "Nombre de convives non défini";

  if (data.dishes.length === 0) {
    document.getElementById("mealComposerBody").innerHTML = `
      <div class="empty-state">
        <div class="big">🍲</div>
        <p>Aucun plat dans votre base. Ajoutez d'abord des plats dans l'onglet "Plats".</p>
      </div>`;
  } else {
    document.getElementById("mealComposerBody").innerHTML = CAT_ORDER.map(renderComposerSection).join("");
    attachComposerHandlers();
  }

  openModal("modalMeal");
}

function renderComposerSection(cat) {
  return `
    <div class="composer-section" data-cat="${cat}">
      <h3>${CAT_LABELS[cat]}${cat === "plat" ? " *" : ""}</h3>
      <div class="composer-count" data-count="${cat}"></div>
      <div class="selected-chips" data-chips="${cat}"></div>
      <input type="search" class="composer-search" data-search="${cat}" placeholder="Rechercher ${CAT_LABELS[cat].toLowerCase() === "plat" ? "un plat" : "une " + CAT_LABELS[cat].toLowerCase()}..." />
      <button type="button" class="composer-new-dish" data-newdish="${cat}">➕ Nouveau plat</button>
      <div class="suggestion-list" data-suggestions="${cat}"></div>
    </div>`;
}

function computeUsageCounts() {
  const usage = {};
  Object.values(data.days).forEach((day) => {
    (day.lunch || []).forEach((id) => (usage[id] = (usage[id] || 0) + 1));
    (day.dinner || []).forEach((id) => (usage[id] = (usage[id] || 0) + 1));
  });
  return usage;
}

function isCompatible(dish, personCount) {
  if (personCount == null) return true;
  if (dish.minPeople != null && personCount < dish.minPeople) return false;
  if (dish.maxPeople != null && personCount > dish.maxPeople) return false;
  return true;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortSuggestions(dishes, personCount, usage) {
  return dishes.slice().sort((a, b) => {
    const ua = usage[a.id] || 0;
    const ub = usage[b.id] || 0;
    if (ua !== ub) return ua - ub; // les moins utilisés d'abord
    const ca = isCompatible(a, personCount);
    const cb = isCompatible(b, personCount);
    if (ca !== cb) return ca ? -1 : 1; // compatibles d'abord
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1; // favoris d'abord
    return a.name.localeCompare(b.name, "fr");
  });
}

function renderComposerCategory(cat) {
  const sel = composerState.selections[cat];
  document.querySelector(`[data-count="${cat}"]`).textContent = `${sel.length}/4 sélectionné(s)`;

  // chips
  const chipsEl = document.querySelector(`[data-chips="${cat}"]`);
  chipsEl.innerHTML = sel
    .map((id) => {
      const dish = data.dishes.find((d) => d.id === id);
      return `<span class="selected-chip">${escapeHtml(dish ? dish.name : "?")}<button data-remove="${cat}:${id}">✕</button></span>`;
    })
    .join("");
  chipsEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [c, id] = btn.dataset.remove.split(":");
      composerState.selections[c] = composerState.selections[c].filter((x) => x !== id);
      renderComposerCategory(c);
    });
  });

  // suggestions
  const searchInput = document.querySelector(`[data-search="${cat}"]`);
  const query = normalize(searchInput.value);
  const usage = computeUsageCounts();
  let pool = data.dishes.filter((d) => d.category === cat && !sel.includes(d.id));

  if (query) {
    pool = pool.filter((d) => normalize(d.name).includes(query));
    pool = sortSuggestions(pool, composerState.personCount, usage);
    pool = pool.slice(0, 12);
  } else {
    const favs = shuffle(pool.filter((d) => d.favorite));
    const nonFavs = shuffle(pool.filter((d) => !d.favorite));
    pool = [...favs, ...nonFavs].slice(0, 10);
  }

  const listEl = document.querySelector(`[data-suggestions="${cat}"]`);
  const atMax = sel.length >= 4;
  if (pool.length === 0) {
    listEl.innerHTML = `<p style="color:var(--ink-soft); font-size:14px; padding:4px 2px;">Aucun plat trouvé.</p>`;
  } else {
    listEl.innerHTML = pool
      .map((d) => {
        const compatible = isCompatible(d, composerState.personCount);
        const tags = `${d.favorite ? '<span class="tag fav">⭐ favori</span>' : ""}${
          compatible ? "" : '<span class="tag">effectif non idéal</span>'
        }`;
        return `
        <div class="suggestion-item ${compatible ? "compatible" : ""}">
          <span>${escapeHtml(d.name)}${tags}</span>
          <button class="add-mini-btn" data-add="${cat}:${d.id}" ${atMax ? "disabled" : ""}>Ajouter</button>
        </div>`;
      })
      .join("");
    listEl.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [c, id] = btn.dataset.add.split(":");
        if (composerState.selections[c].length >= 4) return;
        composerState.selections[c].push(id);
        renderComposerCategory(c);
      });
    });
  }
}

function attachComposerHandlers() {
  CAT_ORDER.forEach((cat) => {
    renderComposerCategory(cat);
    const searchInput = document.querySelector(`[data-search="${cat}"]`);
    const suggList = document.querySelector(`[data-suggestions="${cat}"]`);

    searchInput.addEventListener("input", () => renderComposerCategory(cat));
    searchInput.addEventListener("focus", () => suggList.classList.add("open"));
    searchInput.addEventListener("blur", () => {
      // petit délai pour laisser le clic sur "Ajouter" se déclencher avant de cacher la liste
      setTimeout(() => suggList.classList.remove("open"), 150);
    });

    document.querySelector(`[data-newdish="${cat}"]`).addEventListener("click", () => {
      composerAddContext = cat;
      openDishForm(null, cat);
    });
  });
}

document.getElementById("btnSaveMeal").addEventListener("click", () => {
  if (!composerState) return;
  if (composerState.selections.plat.length === 0) {
    showToast("Sélectionnez au moins un plat.");
    return;
  }
  const flat = [
    ...composerState.selections.entree,
    ...composerState.selections.plat,
    ...composerState.selections.dessert
  ];
  data.days[composerState.date][composerState.mealType] = flat;
  saveData();
  closeModal("modalMeal");
  renderPlanning();
  showToast("Repas enregistré.");
});

document.getElementById("btnClearMeal").addEventListener("click", () => {
  if (!composerState) return;
  data.days[composerState.date][composerState.mealType] = [];
  saveData();
  closeModal("modalMeal");
  renderPlanning();
  showToast("Repas vidé.");
});

// =======================================================================
// DISH DETAIL (read-only)
// =======================================================================

let detailDishId = null;

function openDishDetail(id) {
  const dish = data.dishes.find((d) => d.id === id);
  if (!dish) {
    showToast("Ce plat n'existe plus dans la base.");
    return;
  }
  detailDishId = id;
  document.getElementById("detailDishName").textContent = dish.name;
  const peopleRange =
    dish.minPeople != null || dish.maxPeople != null
      ? `${dish.minPeople ?? "?"} à ${dish.maxPeople ?? "?"} personnes`
      : "Non précisé";
  document.getElementById("dishDetailBody").innerHTML = `
    <div class="detail-row"><div class="label">Catégorie</div><div class="value">${CAT_LABELS[dish.category]}</div></div>
    <div class="detail-row"><div class="label">Nombre de personnes</div><div class="value">${peopleRange}</div></div>
    <div class="detail-row"><div class="label">Favori</div><div class="value">${dish.favorite ? "⭐ Oui" : "Non"}</div></div>
    <div class="detail-row"><div class="label">Notes</div><div class="value">${dish.notes ? escapeHtml(dish.notes) : "—"}</div></div>
  `;
  openModal("modalDishDetail");
}

document.getElementById("btnEditFromDetail").addEventListener("click", () => {
  closeModal("modalDishDetail");
  openDishForm(detailDishId);
});

// =======================================================================
// PLATS SCREEN (dish database)
// =======================================================================

let dishFilterCat = "tous";

document.getElementById("dishSearchInput").addEventListener("input", renderDishList);
document.getElementById("dishFilterRow").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-chip");
  if (!btn) return;
  document.querySelectorAll("#dishFilterRow .filter-chip").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  dishFilterCat = btn.dataset.cat;
  renderDishList();
});

function renderDishList() {
  const container = document.getElementById("dishList");
  const query = normalize(document.getElementById("dishSearchInput").value);

  let list = data.dishes.slice();
  if (dishFilterCat !== "tous") list = list.filter((d) => d.category === dishFilterCat);
  if (query) list = list.filter((d) => normalize(d.name).includes(query));
  list.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (data.dishes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big">🍲</div>
        <p><strong>Aucun plat pour l'instant</strong><br/>Ajoutez vos premiers plats pour commencer à composer des menus.</p>
      </div>`;
    return;
  }
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Aucun plat ne correspond à votre recherche.</p></div>`;
    return;
  }

  container.innerHTML = list
    .map((d) => {
      const range = d.minPeople != null || d.maxPeople != null ? `${d.minPeople ?? "?"}-${d.maxPeople ?? "?"} pers. · ` : "";
      return `
      <div class="dish-list-item" data-open-dish="${d.id}">
        <div class="info">
          <span class="name">${escapeHtml(d.name)}</span>
          <span class="meta">${CAT_LABELS[d.category]} · ${range}${d.favorite ? "⭐" : ""}</span>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-open-dish]").forEach((el) => {
    el.addEventListener("click", () => openDishDetail(el.dataset.openDish));
  });
}

// ------------------- Dish form (add/edit) -------------------

let dishFormMode = "add";
let dishFormEditingId = null;
let composerAddContext = null; // catégorie où auto-ajouter le plat créé depuis le composeur

document.getElementById("btnNewDish").addEventListener("click", () => {
  composerAddContext = null;
  openDishForm(null);
});

function openDishForm(id, defaultCategory) {
  dishFormEditingId = id;
  dishFormMode = id ? "edit" : "add";
  const dish = id ? data.dishes.find((d) => d.id === id) : null;

  document.getElementById("dishFormTitle").textContent = dish ? "Modifier le plat" : "Ajouter un plat";
  document.getElementById("dishFormName").value = dish ? dish.name : "";
  document.querySelectorAll('input[name="dishFormCat"]').forEach((r) => {
    r.checked = dish ? r.value === dish.category : r.value === (defaultCategory || "plat");
  });
  document.getElementById("dishFormMin").value = dish && dish.minPeople != null ? dish.minPeople : "";
  document.getElementById("dishFormMax").value = dish && dish.maxPeople != null ? dish.maxPeople : "";
  document.getElementById("dishFormFav").checked = dish ? !!dish.favorite : false;
  document.getElementById("dishFormNotes").value = dish ? dish.notes || "" : "";
  document.getElementById("btnDeleteDish").style.display = dish ? "block" : "none";

  openModal("modalDishForm");
}

document.getElementById("btnSaveDish").addEventListener("click", () => {
  const name = document.getElementById("dishFormName").value.trim();
  if (!name) {
    showToast("Merci de donner un nom au plat.");
    return;
  }
  const category = document.querySelector('input[name="dishFormCat"]:checked').value;
  const minVal = document.getElementById("dishFormMin").value;
  const maxVal = document.getElementById("dishFormMax").value;
  const minPeople = minVal !== "" ? parseInt(minVal, 10) : null;
  const maxPeople = maxVal !== "" ? parseInt(maxVal, 10) : null;
  if (minPeople != null && maxPeople != null && minPeople > maxPeople) {
    showToast("Le minimum doit être inférieur ou égal au maximum.");
    return;
  }
  const favorite = document.getElementById("dishFormFav").checked;
  const notes = document.getElementById("dishFormNotes").value.trim();

let newDishId = null;
  if (dishFormMode === "edit" && dishFormEditingId) {
    const dish = data.dishes.find((d) => d.id === dishFormEditingId);
    Object.assign(dish, { name, category, minPeople, maxPeople, favorite, notes });
  } else {
    newDishId = uid();
    data.dishes.push({ id: newDishId, name, category, minPeople, maxPeople, favorite, notes });
  }
  saveData();
  closeModal("modalDishForm");
  renderDishList();
  renderPlanning();

  if (newDishId && composerAddContext && composerState) {
    const cat = composerAddContext;
    if (composerState.selections[cat].length < 4) {
      composerState.selections[cat].push(newDishId);
      renderComposerCategory(cat);
      showToast("Plat créé et ajouté au repas.");
    } else {
      showToast("Plat créé (maximum de 4 déjà atteint pour cette catégorie).");
    }
  } else {
    showToast("Plat enregistré.");
  }
  composerAddContext = null;
});

document.getElementById("btnDeleteDish").addEventListener("click", () => {
  if (!dishFormEditingId) return;
  if (!confirm("Supprimer définitivement ce plat ?")) return;
  data.dishes = data.dishes.filter((d) => d.id !== dishFormEditingId);
  saveData();
  closeModal("modalDishForm");
  renderDishList();
  renderPlanning();
  showToast("Plat supprimé.");
});

// =======================================================================
// REGLAGES (export / import / reset)
// =======================================================================

document.getElementById("btnExport").addEventListener("click", () => {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = fmtDateISO(new Date());
  a.href = url;
  a.download = `menus-familiaux-sauvegarde-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Fichier exporté.");
});

document.getElementById("btnImport").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.dishes || !parsed.days) throw new Error("Format invalide");
      if (!confirm("Importer ce fichier remplacera toutes les données actuelles. Continuer ?")) return;
      data = { dishes: parsed.dishes, days: parsed.days, periods: parsed.periods || [] };
      saveData();
      renderDishList();
      renderPeriods();
      renderPlanning();
      showToast("Importation réussie.");
    } catch (err) {
      showToast("Ce fichier n'est pas un fichier de sauvegarde valide.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Effacer TOUTES les données (plats et plannings) ? Cette action est irréversible.")) return;
  data = { dishes: [], days: {}, periods: [] };
  saveData();
  renderDishList();
  renderPeriods();
  renderPlanning();
  showToast("Toutes les données ont été effacées.");
});

// =======================================================================
// INIT
// =======================================================================

renderPeriods();
renderPlanning();
renderDishList();

const SW_VERSION = "v7"; // 👉 change cette valeur à chaque mise à jour (en même temps que CACHE_NAME dans sw.js)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`sw.js?v=${SW_VERSION}`, { updateViaCache: "none" }).catch(() => {
      /* offline caching indisponible, l'app fonctionne quand même en ligne */
    });
  });

  // Recharge automatiquement la page dès qu'une nouvelle version prend le contrôle
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
