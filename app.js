const MONTH_LABELS = {
  Dec: "Dec",
  Jan: "Jan",
  Feb: "Feb"
};

const MONTH_ORDER = {
  Dec: 0,
  Jan: 1,
  Feb: 2
};

const LAYOUT_KEY = "martins-usaco-public-layout-v1";

const state = {
  problems: [],
  exams: [],
  filteredExams: [],
  selectedExamKey: "",
  selectedContest: "Dec",
  filters: {
    search: "",
    season: "all",
    contest: "all",
    type: "all"
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  try {
    const [problemsRes, classificationsRes] = await Promise.all([
      fetch("problems.json", { cache: "no-store" }),
      fetch("problem-classifications.json", { cache: "no-store" })
    ]);

    if (!problemsRes.ok) throw new Error("Problem data could not be loaded.");
    const problems = await problemsRes.json();
    const classifications = classificationsRes.ok ? await classificationsRes.json() : {};

    state.problems = problems
      .filter(isCurrentProblem)
      .map((problem) => withClassification(problem, classifications[problem.id]));
    state.exams = buildExams(state.problems);

    fillControls();
    syncFromHash();
    applyFilters();
  } catch (error) {
    console.error(error);
    els.loadError.hidden = false;
  }
});

function bindElements() {
  [
    "desk-shell",
    "search-input",
    "season-filter",
    "contest-filter",
    "type-filter",
    "exam-list",
    "exam-eyebrow",
    "exam-title",
    "month-tabs",
    "problem-stack",
    "splitter-rail",
    "load-error"
  ].forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  restorePanelLayout();
  setupPanelResize();

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.seasonFilter.addEventListener("change", (event) => {
    state.filters.season = event.target.value;
    applyFilters();
  });

  els.contestFilter.addEventListener("change", (event) => {
    state.filters.contest = event.target.value;
    if (event.target.value !== "all") state.selectedContest = event.target.value;
    applyFilters();
  });

  els.typeFilter.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    applyFilters();
  });

  els.examList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exam-key]");
    if (!button) return;
    selectExam(button.dataset.examKey);
  });

  els.monthTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-contest]");
    if (!button) return;
    state.selectedContest = button.dataset.contest;
    state.filters.contest = "all";
    els.contestFilter.value = "all";
    renderExamPaper();
  });

  window.addEventListener("hashchange", () => {
    syncFromHash();
    applyFilters();
  });
}

function fillControls() {
  fillSelect(els.seasonFilter, "시즌", unique(state.problems.map((problem) => problem.season)).map((season) => ({
    value: season,
    label: formatSeason(season)
  })));
  fillSelect(els.contestFilter, "월", ["Dec", "Jan", "Feb"].map((value) => ({ value, label: MONTH_LABELS[value] })));
  fillSelect(els.typeFilter, "분류", unique(state.problems.flatMap((problem) => problem.types)));
}

function fillSelect(select, label, items) {
  select.innerHTML = `<option value="all">${escapeHtml(label)}</option>` + items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const optionLabel = typeof item === "string" ? item : item.label;
    return `<option value="${escapeAttr(value)}">${escapeHtml(optionLabel)}</option>`;
  }).join("");
}

function applyFilters() {
  state.filteredExams = state.exams.filter((exam) => {
    const matchesSeason = state.filters.season === "all" || exam.season === state.filters.season;
    const hasMatchingProblem = exam.problems.some((problem) => {
      const matchesContest = state.filters.contest === "all" || problem.contest === state.filters.contest;
      return matchesContest && matchesProblem(problem, exam);
    });
    return matchesSeason && hasMatchingProblem;
  });

  if (!state.filteredExams.some((exam) => exam.key === state.selectedExamKey)) {
    state.selectedExamKey = state.filteredExams[0]?.key || "";
  }

  ensureVisibleContest();
  updateHash();
  render();
}

function render() {
  renderExamList();
  renderExamPaper();
}

function visibleProblems(exam) {
  if (!exam) return [];
  const displayContest = state.filters.contest === "all" ? state.selectedContest : state.filters.contest;
  return exam.problems.filter((problem) => {
    const matchesContest = problem.contest === displayContest;
    return matchesContest && matchesProblem(problem, exam);
  });
}

function ensureVisibleContest() {
  const exam = currentExam();
  if (!exam) return;
  if (state.filters.contest !== "all") {
    state.selectedContest = state.filters.contest;
    return;
  }
  const currentHasMatch = exam.problems.some((problem) => (
    problem.contest === state.selectedContest && matchesProblem(problem, exam)
  ));
  if (currentHasMatch) return;
  state.selectedContest = ["Dec", "Jan", "Feb"].find((contest) => (
    exam.problems.some((problem) => problem.contest === contest && matchesProblem(problem, exam))
  )) || "Dec";
}

function matchesProblem(problem, exam) {
  const searchText = [
    exam.label,
    exam.displayLabel,
    exam.season,
    formatSeason(exam.season),
    exam.contest,
    problem.contest,
    problem.title,
    problem.source,
    problem.sourceId,
    ...problem.types
  ].join(" ").toLowerCase();
  const matchesSearch = !state.filters.search || searchText.includes(state.filters.search);
  const matchesType = state.filters.type === "all" || problem.types.includes(state.filters.type);
  return matchesSearch && matchesType;
}

function renderExamList() {
  if (!state.filteredExams.length) {
    els.examList.innerHTML = `<div class="load-fail">조건에 맞는 문제가 없습니다.</div>`;
    return;
  }

  const html = [];
  state.filteredExams.forEach((exam) => {
    const matchingCount = exam.problems.filter((problem) => {
      const matchesContest = state.filters.contest === "all" || problem.contest === state.filters.contest;
      return matchesContest && matchesProblem(problem, exam);
    }).length;
    const countText = matchingCount === exam.problems.length ? `${exam.problems.length}문제` : `${matchingCount}문제 표시`;
    html.push(`
      <button class="exam-button ${exam.key === state.selectedExamKey ? "is-active" : ""}" type="button" data-exam-key="${escapeAttr(exam.key)}">
        <strong>${escapeHtml(exam.displayLabel)}</strong>
        <span class="exam-meta">${escapeHtml(countText)} · <b>${escapeHtml(exam.difficultyLabel)}</b></span>
      </button>
    `);
  });
  els.examList.innerHTML = html.join("");
}

function renderExamPaper() {
  const exam = currentExam();
  if (!exam) {
    els.examEyebrow.textContent = "Problems";
    els.examTitle.textContent = "문제가 없습니다";
    els.monthTabs.innerHTML = "";
    els.problemStack.innerHTML = "";
    return;
  }

  els.examEyebrow.textContent = "문제 목록";
  els.examTitle.textContent = exam.displayLabel;
  els.monthTabs.innerHTML = ["Dec", "Jan", "Feb"].map((contest) => `
    <button class="month-tab ${state.selectedContest === contest ? "is-active" : ""}" type="button" data-contest="${contest}">
      ${MONTH_LABELS[contest]}
    </button>
  `).join("");
  els.problemStack.innerHTML = visibleProblems(exam).map(renderProblemRow).join("");
}

function renderProblemRow(problem) {
  const source = problem.source && problem.sourceId ? `${problem.source} #${problem.sourceId}` : problem.source || "";
  return `
    <a class="problem-row public-problem-row" href="${escapeAttr(problem.url)}" target="_blank" rel="noopener noreferrer">
      <span class="problem-row-top">
        <span class="problem-title">
          <span>#${problem.number} · ${escapeHtml(source)}</span>
          <strong>${escapeHtml(problem.title)}</strong>
        </span>
        <span class="level-pill">Lv.${problem.difficultyLevel}</span>
      </span>
      <span class="tag-row">
        ${problem.types.map((type) => `<span class="tag">${escapeHtml(type)}</span>`).join("")}
      </span>
    </a>
  `;
}

function selectExam(examKey) {
  const exam = state.filteredExams.find((item) => item.key === examKey);
  if (!exam) return;
  state.selectedExamKey = exam.key;
  state.selectedContest = "Dec";
  state.filters.contest = "all";
  els.contestFilter.value = "all";
  ensureVisibleContest();
  updateHash();
  render();
}

function currentExam() {
  return state.filteredExams.find((exam) => exam.key === state.selectedExamKey) || state.filteredExams[0];
}

function buildExams(problems) {
  const groups = new Map();
  problems.forEach((problem) => {
    const key = problem.season;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        season: problem.season,
        contest: "year",
        label: problem.season,
        displayLabel: formatSeason(problem.season),
        problems: []
      });
    }
    groups.get(key).problems.push(problem);
  });

  return [...groups.values()]
    .map((exam) => {
      const sortedProblems = exam.problems.sort((a, b) => {
        const monthDifference = (MONTH_ORDER[a.contest] ?? 9) - (MONTH_ORDER[b.contest] ?? 9);
        return monthDifference || a.number - b.number;
      });
      const difficultyScore = examDifficultyScore(sortedProblems);
      return {
        ...exam,
        problems: sortedProblems,
        difficultyScore,
        difficultyLabel: examDifficultyLabel(difficultyScore)
      };
    })
    .sort((a, b) => examKey(a) - examKey(b));
}

function examDifficultyScore(problems) {
  if (!problems.length) return 0;
  const levels = problems.map((problem) => Number(problem.difficultyLevel) || 1);
  const average = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  const peak = Math.max(...levels);
  return Math.round((average * 0.75 + peak * 0.25) * 10) / 10;
}

function examDifficultyLabel(score) {
  if (score <= 3.0) return "쉬움";
  if (score <= 4.3) return "보통";
  if (score <= 5.0) return "어려움";
  return "매우 어려움";
}

function examKey(exam) {
  const startYear = Number(String(exam.season).slice(0, 4));
  return startYear;
}

function isCurrentProblem(problem) {
  const seasonStart = Number(String(problem.season).slice(0, 4));
  return seasonStart >= 2017;
}

function formatSeason(season) {
  const value = String(season);
  const range = value.match(/^20(\d{2})-(\d{2})$/);
  if (range) return `${range[1]}-${range[2]}`;
  const singleYear = value.match(/^20(\d{2})$/);
  if (singleYear) {
    const start = Number(singleYear[1]);
    return `${String(start).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
  }
  return value;
}

function restorePanelLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
    if (Number.isFinite(saved.rail)) setPanelWidth("rail", saved.rail);
  } catch {
    localStorage.removeItem(LAYOUT_KEY);
  }
}

function setupPanelResize() {
  setupSplitter(els.splitterRail, "rail");
}

function setupSplitter(splitter, target) {
  if (!splitter) return;

  splitter.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 1180px)").matches) return;
    event.preventDefault();
    splitter.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = panelWidth(target);
    splitter.classList.add("is-dragging");
    document.body.classList.add("is-resizing");

    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setPanelWidth(target, startWidth + delta);
    };

    const finish = () => {
      splitter.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing");
      savePanelLayout();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  });
}

function panelWidth(target) {
  const fallback = target === "rail" ? 250 : 320;
  const value = getComputedStyle(els.deskShell).getPropertyValue(target === "rail" ? "--rail-width" : "--paper-width");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setPanelWidth(target, width) {
  const shellWidth = els.deskShell.getBoundingClientRect().width;
  const min = 210;
  const hardMax = 390;
  const maxByContent = Math.max(min, shellWidth - 760);
  const next = Math.round(clamp(width, min, Math.min(hardMax, maxByContent)));
  els.deskShell.style.setProperty("--rail-width", `${next}px`);
}

function savePanelLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ rail: panelWidth("rail") }));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function withClassification(problem, classification = {}) {
  return {
    ...problem,
    types: classification.types || problem.types || [],
    difficultyLevel: classification.difficultyLevel || problem.difficultyLevel
  };
}

function syncFromHash() {
  const match = location.hash.match(/^#exam\/(.+)$/);
  if (!match) return;
  const examKeyFromHash = decodeURIComponent(match[1]);
  if (state.exams.some((exam) => exam.key === examKeyFromHash)) {
    state.selectedExamKey = examKeyFromHash;
  }
}

function updateHash() {
  if (!state.selectedExamKey) return;
  const nextHash = `#exam/${encodeURIComponent(state.selectedExamKey)}`;
  if (location.hash !== nextHash) history.replaceState(null, "", nextHash);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
