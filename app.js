const STORAGE_KEYS = {
  completed: "martiny-usaco-completed",
  notes: "martiny-usaco-notes"
};

const DIFFICULTIES = {
  1: "Meteor",
  2: "Aurora",
  3: "Radiant",
  4: "Twilight",
  5: "Interstellar",
  6: "Nebula",
  7: "Yonder"
};

const TYPE_ORDER = [
  "구현",
  "시뮬레이션",
  "완전탐색",
  "그리디",
  "정렬",
  "카운팅",
  "문자열",
  "수학",
  "누적합",
  "차이 배열",
  "자료구조",
  "그래프",
  "격자",
  "기하",
  "구성",
  "애드혹"
];

const state = {
  problems: [],
  filtered: [],
  selectedTypes: new Set(),
  completed: new Set(readJson(STORAGE_KEYS.completed, [])),
  notes: readJson(STORAGE_KEYS.notes, {}),
  filters: {
    search: "",
    season: "all",
    contest: "all",
    difficulty: "all",
    progress: "all",
    typeMode: "or",
    sort: "recommended"
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  setupStarMap();
  bindEvents();

  try {
    const response = await fetch("problems.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Problem data is empty.");

    state.problems = data;
    console.log("Loaded problems:", state.problems.length);
    buildControls();
    applyFilters();
  } catch (error) {
    console.error("Failed to load problem data:", error);
    els.statusText.textContent = "문제 데이터 로딩 실패";
    els.loadError.hidden = false;
  }
});

function bindElements() {
  [
    "app-shell",
    "filter-panel",
    "filter-toggle",
    "search-input",
    "type-search",
    "season-filter",
    "contest-filter",
    "difficulty-filter",
    "progress-filter",
    "type-mode",
    "sort-order",
    "reset-filters",
    "type-filters",
    "difficulty-legend",
    "status-text",
    "active-filters",
    "problem-list",
    "empty-state",
    "load-error"
  ].forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  els.filterToggle.addEventListener("click", () => {
    setFilterPanelOpen(els.filterPanel.hidden);
  });

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.typeSearch.addEventListener("input", updateTypeChipVisibility);

  els.seasonFilter.addEventListener("change", (event) => {
    state.filters.season = event.target.value;
    applyFilters();
  });

  els.contestFilter.addEventListener("change", (event) => {
    state.filters.contest = event.target.value;
    applyFilters();
  });

  els.difficultyFilter.addEventListener("change", (event) => {
    state.filters.difficulty = event.target.value;
    applyFilters();
  });

  els.progressFilter.addEventListener("change", (event) => {
    state.filters.progress = event.target.value;
    applyFilters();
  });

  els.typeMode.addEventListener("change", (event) => {
    state.filters.typeMode = event.target.value;
    applyFilters();
  });

  els.sortOrder.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    applyFilters();
  });

  els.resetFilters.addEventListener("click", resetFilters);

  els.typeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    toggleType(button.dataset.type);
  });

  els.difficultyLegend.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level]");
    if (!button) return;
    state.filters.difficulty = state.filters.difficulty === button.dataset.level ? "all" : button.dataset.level;
    syncControlsFromState();
    applyFilters();
  });

  els.activeFilters.addEventListener("click", (event) => {
    const type = event.target.closest("[data-clear-type]");
    const filter = event.target.closest("[data-clear-filter]");
    if (type) {
      state.selectedTypes.delete(type.dataset.clearType);
      applyFilters();
    }
    if (filter) {
      clearFilter(filter.dataset.clearFilter);
    }
  });

  els.problemList.addEventListener("click", (event) => {
    const tag = event.target.closest("[data-problem-type]");
    if (!tag) return;
    toggleType(tag.dataset.problemType);
  });

  els.problemList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-complete-id]");
    if (!checkbox) return;
    if (checkbox.checked) {
      state.completed.add(checkbox.dataset.completeId);
    } else {
      state.completed.delete(checkbox.dataset.completeId);
    }
    saveCompleted();
    applyFilters();
  });

  els.problemList.addEventListener("input", (event) => {
    const note = event.target.closest("[data-note-id]");
    if (!note) return;
    state.notes[note.dataset.noteId] = note.value;
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.notes));
  });
}

function buildControls() {
  fillSelect(els.seasonFilter, "전체", unique(state.problems.map((problem) => problem.season)));
  fillSelect(els.contestFilter, "전체", ["Dec", "Jan", "Feb", "First", "Second", "Third"]);
  fillSelect(
    els.difficultyFilter,
    "전체",
    Object.entries(DIFFICULTIES).map(([level, name]) => ({ value: level, label: `Lv.${level} ${name}` }))
  );

  const types = sortTypes(unique(state.problems.flatMap((problem) => problem.types)));
  els.typeFilters.innerHTML = types.map((type) => (
    `<button class="chip" type="button" data-type="${escapeAttr(type)}">${escapeHtml(type)}</button>`
  )).join("");

  els.difficultyLegend.innerHTML = Object.entries(DIFFICULTIES).map(([level, name]) => `
    <button class="difficulty-chip" type="button" data-level="${level}" style="--level-color: var(--level-${level})">
      <span>Lv.${level}</span>
      <strong>${escapeHtml(name)}</strong>
    </button>
  `).join("");
}

function fillSelect(select, allLabel, values) {
  select.innerHTML = `<option value="all">${allLabel}</option>` + values.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    return `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function applyFilters() {
  const selectedTypes = [...state.selectedTypes];

  state.filtered = state.problems.filter((problem) => {
    const done = state.completed.has(problem.id);
    const searchMatches = !state.filters.search || searchableText(problem).includes(state.filters.search);
    const seasonMatches = state.filters.season === "all" || problem.season === state.filters.season;
    const contestMatches = state.filters.contest === "all" || problem.contest === state.filters.contest;
    const difficultyMatches = state.filters.difficulty === "all" || String(problem.difficultyLevel) === state.filters.difficulty;
    const progressMatches = state.filters.progress === "all" || (state.filters.progress === "done" ? done : !done);
    const typeMatches = selectedTypes.length === 0 || (
      state.filters.typeMode === "and"
        ? selectedTypes.every((type) => problem.types.includes(type))
        : selectedTypes.some((type) => problem.types.includes(type))
    );
    return searchMatches && seasonMatches && contestMatches && difficultyMatches && progressMatches && typeMatches;
  });

  sortProblems();
  renderProblems();
  updateFilterUi();
  updateTypeChipVisibility();
  renderActiveFilters();
}

function searchableText(problem) {
  return [
    problem.title,
    problem.season,
    problem.contest,
    problem.contestLabel,
    problem.difficultyName,
    problem.source,
    problem.sourceId,
    problem.url,
    problem.number,
    ...problem.types,
    ...problem.practicePoints
  ].join(" ").toLowerCase();
}

function sortProblems() {
  state.filtered.sort((a, b) => {
    if (state.filters.sort === "difficulty") {
      return a.difficultyLevel - b.difficultyLevel || a.recommendedOrder - b.recommendedOrder;
    }
    if (state.filters.sort === "title") {
      return a.title.localeCompare(b.title, "en") || a.recommendedOrder - b.recommendedOrder;
    }
    if (state.filters.sort === "unfinished") {
      return Number(state.completed.has(a.id)) - Number(state.completed.has(b.id)) || a.recommendedOrder - b.recommendedOrder;
    }
    if (state.filters.sort === "season") {
      return seasonKey(a) - seasonKey(b) || a.number - b.number;
    }
    return a.recommendedOrder - b.recommendedOrder;
  });
}

function seasonKey(problem) {
  const seasonOrder = ["2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2026"];
  const contestOrder = ["Dec", "Jan", "Feb", "First", "Second", "Third"];
  return seasonOrder.indexOf(problem.season) * 100 + contestOrder.indexOf(problem.contest) * 10 + problem.number;
}

function renderProblems() {
  els.problemList.innerHTML = state.filtered.map((problem) => {
    const completed = state.completed.has(problem.id);
    const level = problem.difficultyLevel;
    const source = problem.source && problem.sourceId ? `${escapeHtml(problem.source)} #${escapeHtml(problem.sourceId)}` : "";
    return `
      <article class="problem-card ${completed ? "is-complete" : ""}" style="--level-color: var(--level-${level})">
        <label class="complete-toggle">
          <input type="checkbox" data-complete-id="${escapeAttr(problem.id)}" ${completed ? "checked" : ""} aria-label="${escapeAttr(problem.title)} 완료">
          <span></span>
        </label>

        <div class="problem-core">
          <div class="problem-meta">
            <span>${escapeHtml(problem.season)}</span>
            <span>${escapeHtml(problem.contestLabel)}</span>
            <span>Bronze ${problem.number}</span>
            ${source ? `<span>${source}</span>` : ""}
          </div>
          <h3>
            <a href="${escapeAttr(problem.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(problem.title)}</a>
          </h3>
          <div class="level-pill">
            <i></i>
            <span>Lv.${level}</span>
            <strong>${escapeHtml(problem.difficultyName)}</strong>
          </div>
        </div>

        <div class="tag-row">
          ${problem.types.map((type) => `
            <button class="tag-button ${state.selectedTypes.has(type) ? "is-active" : ""}" type="button" data-problem-type="${escapeAttr(type)}">${escapeHtml(type)}</button>
          `).join("")}
        </div>

        <ul class="practice-list">
          ${problem.practicePoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>

        <textarea class="problem-note" data-note-id="${escapeAttr(problem.id)}" placeholder="메모">${escapeHtml(state.notes[problem.id] || problem.note || "")}</textarea>
      </article>
    `;
  }).join("");

  els.emptyState.hidden = state.filtered.length !== 0;
  els.statusText.textContent = `${state.filtered.length} / ${state.problems.length}`;
}

function updateFilterUi() {
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("is-active", state.selectedTypes.has(button.dataset.type));
  });
  document.querySelectorAll("[data-level]").forEach((button) => {
    button.classList.toggle("is-active", state.filters.difficulty === button.dataset.level);
  });
}

function renderActiveFilters() {
  const chips = [];
  if (state.filters.search) chips.push(activeChip(`검색 ${state.filters.search}`, "search"));
  if (state.filters.season !== "all") chips.push(activeChip(state.filters.season, "season"));
  if (state.filters.contest !== "all") chips.push(activeChip(state.filters.contest, "contest"));
  if (state.filters.difficulty !== "all") chips.push(activeChip(`Lv.${state.filters.difficulty}`, "difficulty"));
  if (state.filters.progress !== "all") chips.push(activeChip(selectedText(els.progressFilter), "progress"));
  if (state.filters.typeMode !== "or") chips.push(activeChip("AND", "typeMode"));
  if (state.filters.sort !== "recommended") chips.push(activeChip(selectedText(els.sortOrder), "sort"));
  [...state.selectedTypes].forEach((type) => {
    chips.push(`<button class="active-filter" type="button" data-clear-type="${escapeAttr(type)}">${escapeHtml(type)}</button>`);
  });
  els.activeFilters.innerHTML = chips.length ? chips.join("") : "필터 없음";
}

function activeChip(label, filter) {
  return `<button class="active-filter" type="button" data-clear-filter="${filter}">${escapeHtml(label)}</button>`;
}

function toggleType(type) {
  if (state.selectedTypes.has(type)) {
    state.selectedTypes.delete(type);
  } else {
    state.selectedTypes.add(type);
  }
  applyFilters();
}

function clearFilter(filter) {
  if (filter === "search") state.filters.search = "";
  if (filter === "season") state.filters.season = "all";
  if (filter === "contest") state.filters.contest = "all";
  if (filter === "difficulty") state.filters.difficulty = "all";
  if (filter === "progress") state.filters.progress = "all";
  if (filter === "typeMode") state.filters.typeMode = "or";
  if (filter === "sort") state.filters.sort = "recommended";
  syncControlsFromState();
  applyFilters();
}

function resetFilters() {
  state.selectedTypes.clear();
  state.filters = {
    search: "",
    season: "all",
    contest: "all",
    difficulty: "all",
    progress: "all",
    typeMode: "or",
    sort: "recommended"
  };
  syncControlsFromState();
  applyFilters();
}

function syncControlsFromState() {
  els.searchInput.value = state.filters.search;
  els.typeSearch.value = "";
  els.seasonFilter.value = state.filters.season;
  els.contestFilter.value = state.filters.contest;
  els.difficultyFilter.value = state.filters.difficulty;
  els.progressFilter.value = state.filters.progress;
  els.typeMode.value = state.filters.typeMode;
  els.sortOrder.value = state.filters.sort;
}

function updateTypeChipVisibility() {
  const query = els.typeSearch.value.trim().toLowerCase();
  document.querySelectorAll("[data-type]").forEach((button) => {
    const matches = !query || button.dataset.type.toLowerCase().includes(query) || state.selectedTypes.has(button.dataset.type);
    button.hidden = !matches;
  });
}

function selectedText(select) {
  return select.options[select.selectedIndex]?.textContent || "";
}

function saveCompleted() {
  localStorage.setItem(STORAGE_KEYS.completed, JSON.stringify([...state.completed]));
}

function setFilterPanelOpen(open) {
  els.filterPanel.hidden = !open;
  els.appShell.classList.toggle("has-open-filter", open);
  els.filterToggle.setAttribute("aria-expanded", String(open));
  els.filterToggle.textContent = open ? "필터 닫기" : "필터 열기";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "ko", { numeric: true }));
}

function sortTypes(types) {
  const order = new Map(TYPE_ORDER.map((type, index) => [type, index]));
  return [...types].sort((a, b) => {
    const rankA = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
    const rankB = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.localeCompare(b, "ko", { numeric: true });
  });
}

function setupStarMap() {
  const canvas = document.getElementById("star-map");
  const ctx = canvas.getContext("2d");
  const stars = Array.from({ length: 72 }, (_, index) => ({
    x: (Math.sin(index * 33.7) + 1) / 2,
    y: (Math.cos(index * 19.3) + 1) / 2,
    r: index % 8 === 0 ? 2.2 : 0.9 + (index % 5) * 0.24,
    phase: index * 0.7
  }));

  const resize = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  const draw = (time) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    stars.forEach((star, index) => {
      const x = star.x * width;
      const y = star.y * height;
      const glow = 0.34 + Math.sin(time * 0.002 + star.phase) * 0.16;
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(154, 218, 255, 0.42)";
      ctx.fillStyle = `rgba(230, 236, 255, ${glow})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (index % 9 === 0) {
        const next = stars[(index + 13) % stars.length];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(next.x * width, next.y * height);
        ctx.strokeStyle = "rgba(154, 218, 255, 0.14)";
        ctx.stroke();
      }
    });

    requestAnimationFrame(draw);
  };

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
}

function toCamel(id) {
  return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
