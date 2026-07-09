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

const TAG_GROUPS = [
  ["풀이 기법", ["완전탐색", "그리디", "동적 계획법", "백트래킹", "이분 탐색", "재귀", "비트마스크", "부분집합 DP"]],
  ["구현·탐색", ["구현", "시뮬레이션", "정렬", "카운팅", "문자열", "DFS/BFS"]],
  ["그래프", ["그래프 색칠", "최단 경로", "트리"]],
  ["구간·수열", ["구간 처리", "누적합", "차분 배열", "투 포인터", "슬라이딩 윈도우"]],
  ["자료구조", ["배열", "집합", "맵", "해시", "스택/큐", "힙/우선순위 큐"]],
  ["문제 형태", ["격자", "좌표/기하", "수학/관찰", "게임 이론", "구성"]]
];

const LAYOUT_KEY = "martins-usaco-public-layout-v3";

const state = {
  problems: [],
  exams: [],
  filteredExams: [],
  selectedExamKey: "",
  selectedContest: "Dec",
  railScrollTopBeforeFilter: null,
  filters: {
    search: "",
    levels: new Set(),
    types: new Set()
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
    "exam-rail",
    "search-input",
    "difficulty-filters",
    "difficulty-clear",
    "algorithm-filters",
    "algorithm-clear",
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
  preventFilterPointerFocus(els.difficultyFilters);
  preventFilterPointerFocus(els.algorithmFilters);

  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.difficultyFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level]");
    if (!button) return;
    toggleFilter(state.filters.levels, Number(button.dataset.level));
    button.blur();
    state.railScrollTopBeforeFilter = 0;
    applyFilters();
  });

  els.algorithmFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    toggleFilter(state.filters.types, button.dataset.type);
    button.blur();
    state.railScrollTopBeforeFilter = 0;
    applyFilters();
  });

  els.difficultyClear.addEventListener("click", () => {
    state.filters.levels.clear();
    state.railScrollTopBeforeFilter = 0;
    applyFilters();
  });

  els.algorithmClear.addEventListener("click", () => {
    state.filters.types.clear();
    state.railScrollTopBeforeFilter = 0;
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
    renderExamPaper();
  });

  window.addEventListener("hashchange", () => {
    syncFromHash();
    applyFilters();
  });
}

function preventFilterPointerFocus(container) {
  container.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".filter-chip")) return;
    state.railScrollTopBeforeFilter = els.examRail?.scrollTop || 0;
    event.preventDefault();
  });
}

function fillControls() {
  const levels = unique(state.problems.map((problem) => Number(problem.difficultyLevel))).sort((a, b) => a - b);
  const types = unique(state.problems.flatMap((problem) => problem.types));
  els.difficultyFilters.innerHTML = levels.map((level) => `
    <button class="filter-chip" type="button" data-level="${level}" aria-pressed="false">Lv.${level}</button>
  `).join("");
  els.algorithmFilters.innerHTML = groupedTags(types).map(([label, tags]) => `
    <div class="algorithm-group">
      <span>${escapeHtml(label)}</span>
      <div class="filter-chips">
        ${tags.map((type) => `
          <button class="filter-chip" type="button" data-type="${escapeAttr(type)}" aria-pressed="false">${escapeHtml(type)}</button>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function toggleFilter(filters, value) {
  if (filters.has(value)) filters.delete(value);
  else filters.add(value);
}

function groupedTags(types) {
  const available = new Set(types);
  const groups = TAG_GROUPS
    .map(([label, tags]) => [label, tags.filter((tag) => available.delete(tag))])
    .filter(([, tags]) => tags.length);
  if (available.size) groups.push(["기타", [...available].sort((a, b) => a.localeCompare(b, "ko"))]);
  return groups;
}

function applyFilters() {
  const railScrollTop = state.railScrollTopBeforeFilter ?? els.examRail?.scrollTop ?? 0;
  state.railScrollTopBeforeFilter = null;
  state.filteredExams = state.exams.filter((exam) => {
    return exam.problems.some((problem) => matchesProblem(problem));
  });

  if (state.selectedExamKey && !state.filteredExams.some((exam) => exam.key === state.selectedExamKey)) {
    state.selectedExamKey = "";
  }

  if (state.selectedExamKey) ensureVisibleContest();
  updateHash();
  render();
  restoreRailScroll(railScrollTop);
}

function restoreRailScroll(scrollTop) {
  if (!els.examRail) return;
  const restore = () => {
    els.examRail.scrollTop = scrollTop;
  };
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}

function render() {
  renderFilterControls();
  renderExamList();
  renderExamPaper();
}

function visibleProblems(exam) {
  if (!exam) return state.problems.filter(matchesProblem);
  return exam.problems.filter((problem) => problem.contest === state.selectedContest && matchesProblem(problem));
}

function ensureVisibleContest() {
  const exam = currentExam();
  if (!exam) return;
  const currentHasMatch = exam.problems.some((problem) => (
    problem.contest === state.selectedContest && matchesProblem(problem)
  ));
  if (currentHasMatch) return;
  state.selectedContest = ["Dec", "Jan", "Feb"].find((contest) => (
    exam.problems.some((problem) => problem.contest === contest && matchesProblem(problem))
  )) || "Dec";
}

function matchesProblem(problem) {
  const searchText = [problem.title, problem.sourceId].join(" ").toLowerCase();
  const matchesSearch = !state.filters.search || searchText.includes(state.filters.search);
  const matchesLevel = state.filters.levels.size === 0 || state.filters.levels.has(Number(problem.difficultyLevel));
  const matchesTypes = [...state.filters.types].every((type) => problem.types.includes(type));
  return matchesSearch && matchesLevel && matchesTypes;
}

function renderFilterControls() {
  els.difficultyFilters.querySelectorAll("[data-level]").forEach((button) => {
    const active = state.filters.levels.has(Number(button.dataset.level));
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.algorithmFilters.querySelectorAll("[data-type]").forEach((button) => {
    const active = state.filters.types.has(button.dataset.type);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.difficultyClear.disabled = state.filters.levels.size === 0;
  els.algorithmClear.disabled = state.filters.types.size === 0;
}

function renderExamList() {
  if (!state.filteredExams.length) {
    els.examList.innerHTML = `<div class="load-fail">조건에 맞는 문제가 없습니다.</div>`;
    return;
  }

  const html = [];
  state.filteredExams.forEach((exam) => {
    const matchingCount = exam.problems.filter(matchesProblem).length;
    const countText = matchingCount === exam.problems.length ? `${exam.problems.length}문제` : `${matchingCount}문제 표시`;
    const contestSummary = ["Dec", "Jan", "Feb"]
      .map((contest) => `${contest} · ${exam.contestDifficulties[contest]?.label || "-"}`)
      .join(" / ");
    html.push(`
      <button class="exam-button ${exam.key === state.selectedExamKey ? "is-active" : ""}" type="button" data-exam-key="${escapeAttr(exam.key)}">
        <strong>${escapeHtml(exam.displayLabel)}</strong>
        <span class="exam-meta">${escapeHtml(contestSummary)}</span>
        ${matchingCount === exam.problems.length ? "" : `<span class="exam-result-count">${escapeHtml(countText)}</span>`}
      </button>
    `);
  });
  els.examList.innerHTML = html.join("");
}

function renderExamPaper() {
  const exam = currentExam();
  if (!exam) {
    const problems = visibleProblems();
    els.examEyebrow.textContent = "전체 문제";
    els.examTitle.textContent = `${problems.length}문제`;
    els.monthTabs.innerHTML = "";
    els.problemStack.innerHTML = problems.length
      ? problems.map(renderProblemRow).join("")
      : `<div class="load-fail">조건에 맞는 문제가 없습니다.</div>`;
    return;
  }

  els.examEyebrow.textContent = "문제 목록";
  els.examTitle.textContent = exam.displayLabel;
  els.monthTabs.innerHTML = ["Dec", "Jan", "Feb"].map((contest) => `
    <button class="month-tab ${state.selectedContest === contest ? "is-active" : ""}" type="button" data-contest="${contest}">
      <span>${MONTH_LABELS[contest]}</span>
      <small>${escapeHtml(exam.contestDifficulties[contest]?.label || "-")}</small>
    </button>
  `).join("");
  const problems = visibleProblems(exam);
  els.problemStack.innerHTML = problems.length
    ? problems.map(renderProblemRow).join("")
    : `<div class="load-fail">이 회차에는 조건에 맞는 문제가 없습니다.</div>`;
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
  state.selectedExamKey = state.selectedExamKey === exam.key ? "" : exam.key;
  state.selectedContest = "Dec";
  if (state.selectedExamKey) ensureVisibleContest();
  updateHash();
  render();
}

function currentExam() {
  return state.filteredExams.find((exam) => exam.key === state.selectedExamKey);
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
      const contestDifficulties = Object.fromEntries(["Dec", "Jan", "Feb"].map((contest) => {
        const contestProblems = sortedProblems.filter((problem) => problem.contest === contest);
        if (!contestProblems.length) return [contest, { score: null, label: "-" }];
        const score = examDifficultyScore(contestProblems);
        return [contest, { score, label: examDifficultyLabel(score) }];
      }));
      return {
        ...exam,
        problems: sortedProblems,
        difficultyScore,
        difficultyLabel: examDifficultyLabel(difficultyScore),
        contestDifficulties
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
  const fallback = target === "rail" ? 410 : 320;
  const value = getComputedStyle(els.deskShell).getPropertyValue(target === "rail" ? "--rail-width" : "--paper-width");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setPanelWidth(target, width) {
  const shellWidth = els.deskShell.getBoundingClientRect().width;
  const min = 210;
  const hardMax = 500;
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
  if (!state.selectedExamKey) {
    if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
    return;
  }
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
