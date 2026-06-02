const state = window.PROJECT_MANAGER_STATE;

const pageTitle = document.querySelector("#page-title");
const currentMode = document.querySelector("#current-mode");
const focusTitle = document.querySelector("#focus-title");
const focusSummary = document.querySelector("#focus-summary");
const nextCheckIn = document.querySelector("#next-check-in");
const lastUpdated = document.querySelector("#last-updated");
const prioritiesList = document.querySelector("#priorities-list");
const blockersList = document.querySelector("#blockers-list");
const metrics = document.querySelector("#metrics");
const projectsGrid = document.querySelector("#projects-grid");
const nextActionsList = document.querySelector("#next-actions-list");
const selectedTag = document.querySelector("#selected-tag");
const selectedTitle = document.querySelector("#selected-title");
const selectedDescription = document.querySelector("#selected-description");
const selectedMeta = document.querySelector("#selected-meta");
const viewButtons = document.querySelectorAll("[data-view]");

let activeView = "Day";
let gantt = null;

function renderHeader() {
  pageTitle.textContent = state.meta.title;
  currentMode.textContent = state.meta.currentMode;
  focusTitle.textContent = state.meta.focusTitle;
  focusSummary.textContent = state.meta.focusSummary;
  nextCheckIn.textContent = state.meta.nextCheckIn;
  lastUpdated.textContent = state.meta.lastUpdated;
}

function renderList(target, items) {
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function renderMetrics() {
  const cards = [
    {
      label: "Projetos",
      value: state.projects.length,
      text: "frentes com leitura ativa",
      color: "linear-gradient(90deg, #65d8ff, #5f8cff)"
    },
    {
      label: "Blocos",
      value: state.ganttTasks.length,
      text: "faixas e marcos do mapa",
      color: "linear-gradient(90deg, #ff7c66, #f7b955)"
    },
    {
      label: "Prioridades",
      value: state.priorities.length,
      text: "eixos de atenção agora",
      color: "linear-gradient(90deg, #73d6ab, #65d8ff)"
    },
    {
      label: "Bloqueios",
      value: state.blockers.length,
      text: "travas que pedem decisão",
      color: "linear-gradient(90deg, #f7b955, #ff7c66)"
    }
  ];

  metrics.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="metric-line" style="background:${card.color}"></div>
          <strong>${card.value}</strong>
          <span>${card.label}</span>
          <p>${card.text}</p>
        </article>
      `
    )
    .join("");
}

function renderProjects() {
  projectsGrid.innerHTML = state.projects
    .map(
      (project) => `
        <article class="project-card">
          <span class="status-badge status-${project.status}">${project.statusLabel}</span>
          <h4>${project.name}</h4>
          <p>${project.summary}</p>
          <div class="project-progress">
            <span style="width:${project.progress}%"></span>
          </div>
          <div class="project-meta">
            <span>Prioridade: ${project.priority}</span>
            <span>Próximo passo: ${project.nextStep}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderNextActions() {
  nextActionsList.innerHTML = state.nextActions
    .map(
      (action) => `
        <label class="next-action">
          <input type="checkbox" ${action.done ? "checked" : ""} disabled />
          <div>
            <strong>${action.title}</strong>
            <p>${action.description}</p>
          </div>
        </label>
      `
    )
    .join("");
}

function updateInspector(task) {
  if (!task) {
    selectedTag.textContent = "selecione um bloco";
    selectedTitle.textContent = "Nenhum evento selecionado";
    selectedDescription.textContent =
      "Clique em uma barra do mapa temporal para ver contexto, decisões e próximos passos.";
    selectedMeta.innerHTML = "";
    return;
  }

  selectedTag.textContent = task.tag;
  selectedTitle.textContent = task.name;
  selectedDescription.textContent = task.description;
  selectedMeta.innerHTML = task.meta.map((entry) => `<span>${entry}</span>`).join("");
}

function buildPopup(task) {
  return `
    <div class="gantt-popup">
      <strong>${task.name}</strong>
      <p>${task.description}</p>
    </div>
  `;
}

function renderGantt() {
  const container = document.querySelector("#gantt");
  container.innerHTML = "";

  gantt = new Gantt("#gantt", state.ganttTasks, {
    view_mode: activeView,
    language: "pt-BR",
    popup: ({ task }) => buildPopup(task),
    on_click: (task) => updateInspector(task)
  });

  window.setTimeout(() => {
    const bars = container.querySelectorAll(".bar-wrapper");
    const firstBar = container.querySelector(".bar");
    const barY = firstBar?.getAttribute("y") ?? "n/a";
    const barHeight = firstBar?.getAttribute("height") ?? "n/a";
    selectedTitle.textContent = `${state.ganttTasks[0].name} (${bars.length} barras)`;
    selectedMeta.insertAdjacentHTML("beforeend", `<span>Debug y:${barY} h:${barHeight}</span>`);
  }, 80);

  updateInspector(state.ganttTasks[0]);
}

function bindViews() {
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      viewButtons.forEach((entry) => entry.classList.remove("is-active"));
      button.classList.add("is-active");
      renderGantt();
    });
  });
}

renderHeader();
renderList(prioritiesList, state.priorities);
renderList(blockersList, state.blockers);
renderMetrics();
renderProjects();
renderNextActions();
renderGantt();
bindViews();
