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
      // Backward compat: ensure archived field exists on all periods and days
      (parsed.periods || []).forEach((p) => { if (p.archived === undefined) p.archived = false; });
      Object.values(parsed.days || {}).forEach((d) => { if (d.archived === undefined) d.archived = false; });
      return {
        dishes: parsed.dishes || [],
        days: parsed.days || {},
        periods: parsed.periods || [],
        ephemeralDishes: parsed.ephemeralDishes || {}
      };
    }
  } catch (e) {
    console.error("Erreur de lecture des données", e);
  }
  return { dishes: [], days: {}, periods: [], ephemeralDishes: {} };
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

  const activeDates = dates.filter((iso) => !data.days[iso].archived);
  const archivedDates = dates.filter((iso) => data.days[iso].archived);

  let html = "";

  // Active days
  if (activeDates.length === 0 && archivedDates.length > 0) {
    html += `<div class="empty-state"><p><strong>Tous les jours sont archivés</strong><br/>Désarchivez une période ou un jour pour les voir ici.</p></div>`;
  } else {
    let lastWeek = null;
    for (const iso of activeDates) {
      const week = mondayOf(iso);
      if (week !== lastWeek) {
        html += `<div class="week-divider">${fmtWeekLabel(week)}</div>`;
        lastWeek = week;
      }
      const day = data.days[iso];
      html += renderDayCard(iso, day);
    }
  }

  // Archived days
  if (archivedDates.length > 0) {
    html += `<div class="archive-section-title">📦 Anciens menus</div>`;
    let lastWeek = null;
    for (const iso of archivedDates) {
      const week = mondayOf(iso);
      if (week !== lastWeek) {
        html += `<div class="week-divider">${fmtWeekLabel(week)}</div>`;
        lastWeek = week;
      }
      const day = data.days[iso];
      html += renderDayCard(iso, day);
    }
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
  container.querySelectorAll(".dish-chip.deleted").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Ce plat a été supprimé. Voulez-vous ouvrir le compositeur pour le remplacer ?")) {
        const date = el.dataset.deletedDate;
        const meal = el.dataset.deletedMeal;
        const deletedId = el.dataset.deletedId;
        // Remove the deleted dish from the meal before opening composer
        const mealDishes = data.days[date][meal] || [];
        data.days[date][meal] = mealDishes.filter((id) => id !== deletedId);
        saveData();
        openMealComposer(date, meal);
      }
    });
  });
  container.querySelectorAll("[data-day-archive]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDayArchived(btn.dataset.dayArchive);
    });
  });
}

function renderDayCard(iso, day) {
  const peopleTxt = day.personCount != null ? `${day.personCount} convives` : "Nombre de convives non défini";
  const archiveTitle = day.archived ? "Désarchiver ce jour" : "Archiver ce jour";
  return `
    <div class="card day-card${day.archived ? " archived" : ""}">
      <span class="date-badge">${fmtDateBadge(iso)}</span>
      <button class="day-archive-btn" data-day-archive="${iso}" title="${archiveTitle}">📦</button>
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
      // Check ephemeral dishes first
      if (typeof id === "string" && id.startsWith("eph_")) {
        const ed = data.ephemeralDishes[id];
        if (ed) {
          return `<button class="dish-chip ephemeral" data-dish-view="${id}">🕐 ${escapeHtml(ed.name)}</button>`;
        }
        // Ephemeral dish was removed — treat as deleted
        return `<button class="dish-chip deleted" data-deleted-date="${iso}" data-deleted-meal="${mealType}" data-deleted-id="${id}">Plat supprimé</button>`;
      }
      const dish = data.dishes.find((d) => d.id === id);
      if (dish) {
        return `<button class="dish-chip" data-dish-view="${id}">${escapeHtml(dish.name)}</button>`;
      }
      return `<button class="dish-chip deleted" data-deleted-date="${iso}" data-deleted-meal="${mealType}" data-deleted-id="${id}">Plat supprimé</button>`;
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
      data.days[iso] = { personCount, lunch: [], dinner: [], periodId: period.id, archived: !!period.archived };
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
  const active = sorted.filter((p) => !p.archived);
  const archived = sorted.filter((p) => p.archived);

  function periodCardHTML(p) {
    const summary = p.ranges
      .map((r) => `${r.count} pers. (${fmtDateBadge(r.start)} → ${fmtDateBadge(r.end)})`)
      .join(" · ");
    const archiveIcon = p.archived ? "📤" : "📥";
    const archiveTitle = p.archived ? "Désarchiver" : "Archiver";
    return `
      <div class="period-card${p.archived ? " archived" : ""}">
        <div class="info">
          <span class="dates">${fmtDateBadge(p.start)} → ${fmtDateBadge(p.end)}</span>
          <span class="ranges-summary">${escapeHtml(summary)}</span>
        </div>
        <div class="actions">
          <button class="icon-btn" data-period-edit="${p.id}">✏️</button>
          <button class="icon-btn archive-toggle" data-period-archive="${p.id}" title="${archiveTitle}">${archiveIcon}</button>
          <button class="icon-btn danger" data-period-delete="${p.id}">🗑️</button>
        </div>
      </div>`;
  }

  let html = active.map(periodCardHTML).join("");
  if (archived.length > 0) {
    html += `<div class="archive-section-title">📦 Archivées</div>`;
    html += archived.map(periodCardHTML).join("");
  }
  container.innerHTML = html;

  container.querySelectorAll("[data-period-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openPeriodForm(btn.dataset.periodEdit));
  });
  container.querySelectorAll("[data-period-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingPeriodId = btn.dataset.periodDelete;
      document.getElementById("btnDeletePeriod").click();
    });
  });
  container.querySelectorAll("[data-period-archive]").forEach((btn) => {
    btn.addEventListener("click", () => togglePeriodArchived(btn.dataset.periodArchive));
  });
}

// ------------------- Archive toggles -------------------

function togglePeriodArchived(periodId) {
  const period = data.periods.find((p) => p.id === periodId);
  if (!period) return;
  const newState = !period.archived;
  period.archived = newState;
  // Sync all days belonging to this period
  Object.values(data.days).forEach((day) => {
    if (day.periodId === periodId) day.archived = newState;
  });
  saveData();
  renderPeriods();
  renderPlanning();
  showToast(newState ? "Période archivée." : "Période désarchivée.");
}

function toggleDayArchived(iso) {
  const day = data.days[iso];
  if (!day) return;
  day.archived = !day.archived;
  saveData();
  renderPlanning();
  showToast(day.archived ? "Jour archivé." : "Jour désarchivé.");
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
    // Check regular dishes first, then ephemeral
    const dish = data.dishes.find((d) => d.id === id);
    if (dish && selections[dish.category]) {
      selections[dish.category].push(id);
    } else if (typeof id === "string" && id.startsWith("eph_")) {
      const ed = data.ephemeralDishes[id];
      if (ed && selections[ed.category]) selections[ed.category].push(id);
    }
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
      <div class="composer-search-row">
        <input type="search" class="composer-search" data-search="${cat}" placeholder="Rechercher ${CAT_LABELS[cat].toLowerCase() === "plat" ? "un plat" : "une " + CAT_LABELS[cat].toLowerCase()}..." />
        <button type="button" class="btn-tous" data-tous="${cat}">Tous</button>
      </div>
      <button type="button" class="composer-new-dish" data-newdish="${cat}">➕ Nouveau plat</button>
      <div class="suggestion-list" data-suggestions="${cat}"></div>
    </div>`;
}

function computeUsageCounts() {
  const usage = {};
  Object.values(data.days).forEach((day) => {
    if (day.archived) return; // exclude archived days from suggestions
    (day.lunch || []).forEach((id) => {
      if (typeof id === "string" && id.startsWith("eph_")) return; // skip ephemeral
      usage[id] = (usage[id] || 0) + 1;
    });
    (day.dinner || []).forEach((id) => {
      if (typeof id === "string" && id.startsWith("eph_")) return; // skip ephemeral
      usage[id] = (usage[id] || 0) + 1;
    });
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
      const eph = (typeof id === "string" && id.startsWith("eph_")) ? data.ephemeralDishes[id] : null;
      const displayName = dish ? dish.name : (eph ? eph.name : "?");
      const prefix = eph ? "🕐 " : "";
      return `<span class="selected-chip">${prefix}${escapeHtml(displayName)}<button data-remove="${cat}:${id}">✕</button></span>`;
    })
    .join("");
  chipsEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [c, id] = btn.dataset.remove.split(":");
      composerState.selections[c] = composerState.selections[c].filter((x) => x !== id);
      persistComposerState();
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
    pool = shuffle(pool).slice(0, 5);
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
        persistComposerState();
        renderComposerCategory(c);
      });
    });
  }
}
function persistComposerState() {
  if (!composerState) return;
  const flat = [
    ...composerState.selections.entree,
    ...composerState.selections.plat,
    ...composerState.selections.dessert
  ];
  data.days[composerState.date][composerState.mealType] = flat;
  saveData();
  renderPlanning();
}
function attachComposerHandlers() {
  CAT_ORDER.forEach((cat) => {
    renderComposerCategory(cat);
    const searchInput = document.querySelector(`[data-search="${cat}"]`);
    const suggList = document.querySelector(`[data-suggestions="${cat}"]`);

    searchInput.addEventListener("input", () => renderComposerCategory(cat));
    searchInput.addEventListener("focus", () => suggList.classList.add("open"));
    searchInput.addEventListener("blur", () => {
      setTimeout(() => suggList.classList.remove("open"), 150);
    });

    document.querySelector(`[data-newdish="${cat}"]`).addEventListener("click", () => {
      composerAddContext = cat;
      openDishForm(null, cat);
    });

    document.querySelector(`[data-tous="${cat}"]`).addEventListener("click", () => openAllDishesModal(cat));
  });
}

let allDishesContext = null;

function openAllDishesModal(cat) {
  allDishesContext = cat;
  document.getElementById("allDishesTitle").textContent = `Tous les plats — ${CAT_LABELS[cat]}`;
  document.getElementById("allDishesSearch").value = "";
  renderAllDishesList();
  openModal("modalAllDishes");
}

function renderAllDishesList() {
  const cat = allDishesContext;
  const sel = composerState.selections[cat];
  const query = normalize(document.getElementById("allDishesSearch").value);

  let pool = data.dishes.filter((d) => d.category === cat && !sel.includes(d.id));
  if (query) pool = pool.filter((d) => normalize(d.name).includes(query));
  pool.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const listEl = document.getElementById("allDishesList");
  const atMax = sel.length >= 4;
  if (pool.length === 0) {
    listEl.innerHTML = `<p style="color:var(--ink-soft); font-size:14px; padding:4px 2px;">Aucun plat trouvé.</p>`;
    return;
  }
  listEl.innerHTML = pool
    .map((d) => {
      const compatible = isCompatible(d, composerState.personCount);
      const tags = `${d.favorite ? '<span class="tag fav">⭐ favori</span>' : ""}${
        compatible ? "" : '<span class="tag">effectif non idéal</span>'
      }`;
      return `
      <div class="suggestion-item ${compatible ? "compatible" : ""}">
        <span>${escapeHtml(d.name)}${tags}</span>
        <button class="add-mini-btn" data-add-all="${d.id}" ${atMax ? "disabled" : ""}>Ajouter</button>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll("[data-add-all]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (composerState.selections[cat].length >= 4) return;
      composerState.selections[cat].push(btn.dataset.addAll);
      persistComposerState();
      renderComposerCategory(cat);
      renderAllDishesList();
    });
  });
}

document.getElementById("allDishesSearch").addEventListener("input", renderAllDishesList);

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
  // Handle ephemeral dishes
  if (typeof id === "string" && id.startsWith("eph_")) {
    const ed = data.ephemeralDishes[id];
    if (ed) {
      document.getElementById("detailDishName").textContent = ed.name;
      document.getElementById("dishDetailBody").innerHTML = `
        <div class="detail-row"><div class="label">Type</div><div class="value">🕐 Plat éphémère</div></div>
        <div class="detail-row"><div class="label">Catégorie</div><div class="value">${CAT_LABELS[ed.category] || ed.category}</div></div>
        <div class="detail-row"><div class="label">Notes</div><div class="value">${ed.notes ? escapeHtml(ed.notes) : "—"}</div></div>
      `;
      document.getElementById("btnEditFromDetail").style.display = "none";
      openModal("modalDishDetail");
    }
    return;
  }
  const dish = data.dishes.find((d) => d.id === id);
  if (!dish) {
    showToast("Ce plat n'existe plus dans la base.");
    return;
  }
  detailDishId = id;
  document.getElementById("btnEditFromDetail").style.display = "block";
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
  const fromComposer = !!composerAddContext && !id; // only for new dishes from composer

  document.getElementById("dishFormTitle").textContent = dish ? "Modifier le plat" : (fromComposer ? "Ajouter un plat au repas" : "Ajouter un plat");
  document.getElementById("dishFormName").value = dish ? dish.name : "";
  document.querySelectorAll('input[name="dishFormCat"]').forEach((r) => {
    r.checked = dish ? r.value === dish.category : r.value === (defaultCategory || "plat");
  });
  document.getElementById("dishFormMin").value = dish && dish.minPeople != null ? dish.minPeople : "";
  document.getElementById("dishFormMax").value = dish && dish.maxPeople != null ? dish.maxPeople : "";
  document.getElementById("dishFormFav").checked = dish ? !!dish.favorite : false;
  document.getElementById("dishFormNotes").value = dish ? dish.notes || "" : "";
  document.getElementById("btnDeleteDish").style.display = dish ? "block" : "none";

  // Ephemeral checkbox: visible only when adding from composer
  const ephemeralRow = document.getElementById("dishFormEphemeralRow");
  const persistentFields = document.getElementById("dishFormPersistentFields");
  const ephemeralCheckbox = document.getElementById("dishFormEphemeral");
  if (fromComposer) {
    ephemeralRow.style.display = "flex";
    ephemeralCheckbox.checked = false;
    persistentFields.style.display = "block";
  } else {
    ephemeralRow.style.display = "none";
    ephemeralCheckbox.checked = false;
    persistentFields.style.display = "block";
  }

  // Reset duplicate warning
  document.getElementById("dishFormDuplicateWarning").style.display = "none";
  document.getElementById("btnSaveDish").disabled = false;

  openModal("modalDishForm");
}

document.getElementById("btnSaveDish").addEventListener("click", () => {
  const name = document.getElementById("dishFormName").value.trim();
  if (!name) {
    showToast("Merci de donner un nom au plat.");
    return;
  }
  const ephemeral = document.getElementById("dishFormEphemeral").checked;
  const notes = document.getElementById("dishFormNotes").value.trim();

  // --- Ephemeral path: dish goes only to the current meal, not the database ---
  if (ephemeral && composerAddContext && composerState) {
    const cat = composerAddContext;
    if (composerState.selections[cat].length >= 4) {
      showToast("Maximum de 4 plats déjà atteint pour cette catégorie.");
      return;
    }
    const ephId = "eph_" + uid();
    data.ephemeralDishes[ephId] = { name, category: cat, notes };
    composerState.selections[cat].push(ephId);
    saveData();
    closeModal("modalDishForm");
    persistComposerState();
    renderComposerCategory(cat);
    showToast("Plat éphémère ajouté au repas.");
    composerAddContext = null;
    return;
  }

  // --- Normal path ---
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
      persistComposerState();
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

  // Check if dish is used in any meals
  let usageCount = 0;
  Object.values(data.days).forEach((day) => {
    if ((day.lunch || []).includes(dishFormEditingId)) usageCount++;
    if ((day.dinner || []).includes(dishFormEditingId)) usageCount++;
  });

  let msg = "Supprimer définitivement ce plat ?";
  if (usageCount > 0) {
    msg = `Ce plat est utilisé dans ${usageCount} repas. Le supprimer le retirera de ces repas. Continuer ?`;
  }
  if (!confirm(msg)) return;

  data.dishes = data.dishes.filter((d) => d.id !== dishFormEditingId);
  saveData();
  closeModal("modalDishForm");
  renderDishList();
  renderPlanning();
  showToast("Plat supprimé.");
});

// ------------------- Ephemeral dish toggle -------------------

document.getElementById("dishFormEphemeral").addEventListener("change", () => {
  const ephemeral = document.getElementById("dishFormEphemeral").checked;
  const persistentFields = document.getElementById("dishFormPersistentFields");
  const warning = document.getElementById("dishFormDuplicateWarning");
  const saveBtn = document.getElementById("btnSaveDish");

  persistentFields.style.display = ephemeral ? "none" : "block";
  // When ephemeral, duplicate names are fine — re-enable save
  if (ephemeral) {
    warning.style.display = "none";
    saveBtn.disabled = false;
  } else {
    // Re-trigger duplicate check
    document.getElementById("dishFormName").dispatchEvent(new Event("input"));
  }
});

// ------------------- Duplicate name check -------------------

document.getElementById("dishFormName").addEventListener("input", () => {
  const name = document.getElementById("dishFormName").value.trim();
  const warning = document.getElementById("dishFormDuplicateWarning");
  const saveBtn = document.getElementById("btnSaveDish");
  const ephemeral = document.getElementById("dishFormEphemeral").checked;

  if (!name || ephemeral) {
    warning.style.display = "none";
    saveBtn.disabled = false;
    return;
  }

  const norm = normalize(name);
  const duplicate = data.dishes.find((d) => {
    if (dishFormMode === "edit" && dishFormEditingId && d.id === dishFormEditingId) return false;
    return normalize(d.name) === norm;
  });

  if (duplicate) {
    warning.style.display = "block";
    saveBtn.disabled = true;
  } else {
    warning.style.display = "none";
    saveBtn.disabled = false;
  }
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
      data = { dishes: parsed.dishes, days: parsed.days, periods: parsed.periods || [], ephemeralDishes: parsed.ephemeralDishes || {} };
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
  data = { dishes: [], days: {}, periods: [], ephemeralDishes: {} };
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

const SW_VERSION = "v14"; // 👉 change cette valeur à chaque mise à jour (en même temps que CACHE_NAME dans sw.js)

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
