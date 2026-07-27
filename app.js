const STORAGE_KEY = "meuConsumoDataV1";
const ETHANOL_DENSITY = 0.789;

const state = {
  currentOccasion: null,
  history: [],
  settings: {
    standardDoseGrams: 14
  }
};

let categoryChart = null;
let timelineChart = null;
let timerInterval = null;
let deferredInstallPrompt = null;
let pendingConfirmAction = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  newOccasionBtn: $("#newOccasionBtn"),
  addDrinkBtn: $("#addDrinkBtn"),
  addDrinkSecondaryBtn: $("#addDrinkSecondaryBtn"),
  finishOccasionBtn: $("#finishOccasionBtn"),
  installAppBtn: $("#installAppBtn"),

  occasionNameDisplay: $("#occasionNameDisplay"),
  occasionStatusText: $("#occasionStatusText"),
  occasionTimer: $("#occasionTimer"),

  occasionDialog: $("#occasionDialog"),
  occasionForm: $("#occasionForm"),
  occasionNameInput: $("#occasionNameInput"),
  occasionStartInput: $("#occasionStartInput"),

  drinkDialog: $("#drinkDialog"),
  drinkForm: $("#drinkForm"),
  drinkDialogTitle: $("#drinkDialogTitle"),
  drinkEditId: $("#drinkEditId"),
  drinkName: $("#drinkName"),
  drinkCategory: $("#drinkCategory"),
  drinkBrand: $("#drinkBrand"),
  drinkVolume: $("#drinkVolume"),
  drinkAlcoholPercent: $("#drinkAlcoholPercent"),
  drinkQuantity: $("#drinkQuantity"),
  drinkStartTime: $("#drinkStartTime"),
  drinkEndTime: $("#drinkEndTime"),
  drinkNotes: $("#drinkNotes"),
  drinkCalculationPreview: $("#drinkCalculationPreview"),

  metricDrinks: $("#metricDrinks"),
  metricVolume: $("#metricVolume"),
  metricPureAlcohol: $("#metricPureAlcohol"),
  metricPureAlcoholGrams: $("#metricPureAlcoholGrams"),
  metricStandardDrinks: $("#metricStandardDrinks"),
  metricCalories: $("#metricCalories"),
  metricAttention: $("#metricAttention"),
  metricAttentionHint: $("#metricAttentionHint"),
  attentionCard: $("#attentionCard"),
  standardDoseLabel: $("#standardDoseLabel"),

  drinksTableBody: $("#drinksTableBody"),

  summaryFirstDrink: $("#summaryFirstDrink"),
  summaryLastDrink: $("#summaryLastDrink"),
  summaryDuration: $("#summaryDuration"),
  summaryDrinkCount: $("#summaryDrinkCount"),
  summaryVolume: $("#summaryVolume"),
  summaryPureAlcohol: $("#summaryPureAlcohol"),
  summaryAlcoholGrams: $("#summaryAlcoholGrams"),
  summaryStandardDrinks: $("#summaryStandardDrinks"),
  summaryCalories: $("#summaryCalories"),

  waterCount: $("#waterCount"),
  addWaterBtn: $("#addWaterBtn"),
  removeWaterBtn: $("#removeWaterBtn"),
  foodCheckbox: $("#foodCheckbox"),
  foodNotes: $("#foodNotes"),
  hydrationReminder: $("#hydrationReminder"),

  standardDoseInput: $("#standardDoseInput"),
  safetyAlertPanel: $("#safetyAlertPanel"),
  safetyAlertTitle: $("#safetyAlertTitle"),
  safetyAlertText: $("#safetyAlertText"),

  historyFilter: $("#historyFilter"),
  historyStartDate: $("#historyStartDate"),
  historyEndDate: $("#historyEndDate"),
  historyTableBody: $("#historyTableBody"),
  exportCsvBtn: $("#exportCsvBtn"),
  clearDataBtn: $("#clearDataBtn"),

  confirmDialog: $("#confirmDialog"),
  confirmDialogTitle: $("#confirmDialogTitle"),
  confirmDialogText: $("#confirmDialogText"),
  confirmCancelBtn: $("#confirmCancelBtn"),
  confirmActionBtn: $("#confirmActionBtn"),

  toast: $("#toast")
};

function init() {
  loadState();
  bindEvents();
  initializeCharts();
  renderAll();
  registerServiceWorker();
}

function bindEvents() {
  elements.newOccasionBtn.addEventListener("click", openOccasionDialog);
  elements.occasionForm.addEventListener("submit", startOccasion);

  elements.addDrinkBtn.addEventListener("click", () => openDrinkDialog());
  elements.addDrinkSecondaryBtn.addEventListener("click", () => openDrinkDialog());
  elements.drinkForm.addEventListener("submit", saveDrink);

  elements.finishOccasionBtn.addEventListener("click", () => {
    if (!state.currentOccasion) return;
    openConfirmDialog(
      "Finalizar ocasião",
      "A ocasião atual será salva no histórico.",
      finishCurrentOccasion
    );
  });

  ["input", "change"].forEach((eventName) => {
    elements.drinkVolume.addEventListener(eventName, updateDrinkPreview);
    elements.drinkAlcoholPercent.addEventListener(eventName, updateDrinkPreview);
    elements.drinkQuantity.addEventListener(eventName, updateDrinkPreview);
  });

  $$("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.close);
      if (dialog?.open) dialog.close();
    });
  });

  elements.addWaterBtn.addEventListener("click", () => updateWater(1));
  elements.removeWaterBtn.addEventListener("click", () => updateWater(-1));

  elements.foodCheckbox.addEventListener("change", saveWellnessData);
  elements.foodNotes.addEventListener("input", debounce(saveWellnessData, 250));

  elements.standardDoseInput.addEventListener("change", () => {
    const value = clamp(Number(elements.standardDoseInput.value) || 14, 1, 30);
    state.settings.standardDoseGrams = value;
    elements.standardDoseInput.value = value;
    saveState();
    renderAll();
    showToast("Dose padrão atualizada.");
  });

  elements.historyFilter.addEventListener("change", () => {
    const isCustom = elements.historyFilter.value === "custom";
    elements.historyStartDate.classList.toggle("hidden", !isCustom);
    elements.historyEndDate.classList.toggle("hidden", !isCustom);
    renderHistory();
  });

  elements.historyStartDate.addEventListener("change", renderHistory);
  elements.historyEndDate.addEventListener("change", renderHistory);
  elements.exportCsvBtn.addEventListener("click", exportHistoryCsv);

  elements.clearDataBtn.addEventListener("click", () => {
    openConfirmDialog(
      "Apagar todos os dados",
      "Esta ação removerá a ocasião atual, o histórico e as configurações salvas neste navegador.",
      clearAllData
    );
  });

  elements.confirmCancelBtn.addEventListener("click", () => {
    pendingConfirmAction = null;
    elements.confirmDialog.close();
  });

  elements.confirmActionBtn.addEventListener("click", () => {
    if (typeof pendingConfirmAction === "function") pendingConfirmAction();
    pendingConfirmAction = null;
    elements.confirmDialog.close();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installAppBtn.classList.remove("hidden");
  });

  elements.installAppBtn.addEventListener("click", installApp);
}

function openOccasionDialog() {
  const now = new Date();
  elements.occasionNameInput.value = "";
  elements.occasionStartInput.value = toDateTimeLocal(now);
  elements.occasionDialog.showModal();
  setTimeout(() => elements.occasionNameInput.focus(), 50);
}

function startOccasion(event) {
  event.preventDefault();

  const name = elements.occasionNameInput.value.trim();
  const start = elements.occasionStartInput.value;

  if (!name || !start) {
    showToast("Preencha o nome e a data de início.");
    return;
  }

  const createOccasion = () => {
    state.currentOccasion = {
      id: crypto.randomUUID(),
      name,
      startAt: new Date(start).toISOString(),
      endAt: null,
      drinks: [],
      waterCups: 0,
      hadFood: false,
      foodNotes: ""
    };

    saveState();
    elements.occasionDialog.close();
    renderAll();
    showToast("Ocasião iniciada.");
  };

  if (state.currentOccasion) {
    openConfirmDialog(
      "Substituir ocasião atual",
      "A ocasião atual ainda não foi finalizada. Iniciar outra ocasião apagará o acompanhamento atual.",
      createOccasion
    );
  } else {
    createOccasion();
  }
}

function openDrinkDialog(drinkId = null) {
  if (!state.currentOccasion) {
    showToast("Inicie uma ocasião antes de adicionar bebidas.");
    return;
  }

  elements.drinkForm.reset();
  elements.drinkEditId.value = "";
  elements.drinkQuantity.value = "1";
  elements.drinkDialogTitle.textContent = "Adicionar bebida";

  const nowTime = toTimeInput(new Date());
  elements.drinkStartTime.value = nowTime;
  elements.drinkEndTime.value = nowTime;

  if (drinkId) {
    const drink = state.currentOccasion.drinks.find((item) => item.id === drinkId);
    if (!drink) return;

    elements.drinkDialogTitle.textContent = "Editar bebida";
    elements.drinkEditId.value = drink.id;
    elements.drinkName.value = drink.name;
    elements.drinkCategory.value = drink.category;
    elements.drinkBrand.value = drink.brand || "";
    elements.drinkVolume.value = drink.volumeMl;
    elements.drinkAlcoholPercent.value = drink.alcoholPercent;
    elements.drinkQuantity.value = drink.quantity;
    elements.drinkStartTime.value = drink.startTime;
    elements.drinkEndTime.value = drink.endTime;
    elements.drinkNotes.value = drink.notes || "";
  }

  updateDrinkPreview();
  elements.drinkDialog.showModal();
}

function applyPreset(preset) {
  const nowTime = toTimeInput(new Date());

  const presets = {
    askov: {
      name: "Askov",
      category: "Bebida alcoólica mista",
      brand: "Askov",
      volumeMl: 900,
      alcoholPercent: ""
    },
    "skol-beats": {
      name: "Skol Beats",
      category: "Bebida pronta",
      brand: "Skol",
      volumeMl: 269,
      alcoholPercent: ""
    },
    custom: {
      name: "",
      category: "",
      brand: "",
      volumeMl: "",
      alcoholPercent: ""
    }
  };

  const selected = presets[preset];
  if (!selected) return;

  elements.drinkName.value = selected.name;
  elements.drinkCategory.value = selected.category;
  elements.drinkBrand.value = selected.brand;
  elements.drinkVolume.value = selected.volumeMl;
  elements.drinkAlcoholPercent.value = selected.alcoholPercent;
  elements.drinkQuantity.value = 1;
  elements.drinkStartTime.value = nowTime;
  elements.drinkEndTime.value = nowTime;
  updateDrinkPreview();

  if (!selected.alcoholPercent) {
    showToast("Confira e informe o teor alcoólico do rótulo.");
  }
}

function saveDrink(event) {
  event.preventDefault();

  const payload = {
    id: elements.drinkEditId.value || crypto.randomUUID(),
    name: elements.drinkName.value.trim(),
    category: elements.drinkCategory.value,
    brand: elements.drinkBrand.value.trim(),
    volumeMl: Number(elements.drinkVolume.value),
    alcoholPercent: Number(elements.drinkAlcoholPercent.value),
    quantity: Number(elements.drinkQuantity.value),
    startTime: elements.drinkStartTime.value,
    endTime: elements.drinkEndTime.value,
    notes: elements.drinkNotes.value.trim()
  };

  if (
    !payload.name ||
    !payload.category ||
    payload.volumeMl <= 0 ||
    payload.alcoholPercent <= 0 ||
    payload.quantity <= 0 ||
    !payload.startTime ||
    !payload.endTime
  ) {
    showToast("Revise os campos obrigatórios.");
    return;
  }

  const existingIndex = state.currentOccasion.drinks.findIndex((item) => item.id === payload.id);

  if (existingIndex >= 0) {
    state.currentOccasion.drinks[existingIndex] = payload;
    showToast("Bebida atualizada.");
  } else {
    state.currentOccasion.drinks.push(payload);
    showToast("Bebida adicionada.");
  }

  saveState();
  elements.drinkDialog.close();
  renderAll();
}

function updateDrinkPreview() {
  const volume = Number(elements.drinkVolume.value) || 0;
  const percent = Number(elements.drinkAlcoholPercent.value) || 0;
  const quantity = Number(elements.drinkQuantity.value) || 0;
  const pureAlcoholMl = calculatePureAlcoholMl(volume, quantity, percent);

  elements.drinkCalculationPreview.textContent =
    `${formatNumber(pureAlcoholMl, 2)} ml de álcool puro`;
}

function calculatePureAlcoholMl(volumeMl, quantity, alcoholPercent) {
  return volumeMl * quantity * (alcoholPercent / 100);
}

function calculateDrinkTotals(drink) {
  const totalVolumeMl = drink.volumeMl * drink.quantity;
  const pureAlcoholMl = calculatePureAlcoholMl(
    drink.volumeMl,
    drink.quantity,
    drink.alcoholPercent
  );
  const alcoholGrams = pureAlcoholMl * ETHANOL_DENSITY;

  // 7 kcal por grama de álcool. É uma aproximação e não inclui açúcares/carboidratos.
  const calories = alcoholGrams * 7;

  return {
    totalVolumeMl,
    pureAlcoholMl,
    alcoholGrams,
    calories
  };
}

function getOccasionTotals(occasion) {
  const base = {
    drinkUnits: 0,
    totalVolumeMl: 0,
    pureAlcoholMl: 0,
    alcoholGrams: 0,
    standardDrinks: 0,
    calories: 0
  };

  if (!occasion) return base;

  const totals = occasion.drinks.reduce((acc, drink) => {
    const values = calculateDrinkTotals(drink);
    acc.drinkUnits += drink.quantity;
    acc.totalVolumeMl += values.totalVolumeMl;
    acc.pureAlcoholMl += values.pureAlcoholMl;
    acc.alcoholGrams += values.alcoholGrams;
    acc.calories += values.calories;
    return acc;
  }, base);

  totals.standardDrinks =
    totals.alcoholGrams / Math.max(1, state.settings.standardDoseGrams);

  return totals;
}

function getAttentionLevel(standardDrinks) {
  if (standardDrinks <= 0) {
    return {
      key: "none",
      label: "Sem registro",
      hint: "Adicione uma bebida para calcular.",
      title: "Atenção",
      text: "Esta ferramenta apresenta apenas uma estimativa baseada nas informações cadastradas."
    };
  }

  if (standardDrinks < 1) {
    return {
      key: "low",
      label: "Baixo",
      hint: "Ainda assim, não dirija.",
      title: "Não dirija",
      text: "Se você consumiu bebida alcoólica, não conduza veículos, motocicletas, máquinas ou equipamentos."
    };
  }

  if (standardDrinks < 2.5) {
    return {
      key: "moderate",
      label: "Moderado",
      hint: "Redobre a atenção.",
      title: "Atenção redobrada",
      text: "Considere desacelerar o consumo, beber água, alimentar-se e permanecer acompanhado por alguém de confiança."
    };
  }

  if (standardDrinks < 4) {
    return {
      key: "high",
      label: "Alto",
      hint: "Considere interromper o consumo.",
      title: "Consumo elevado",
      text: "Considere interromper o consumo, beber água, alimentar-se e permanecer acompanhado por alguém de confiança."
    };
  }

  return {
    key: "very-high",
    label: "Muito alto",
    hint: "Procure ajuda se houver sintomas.",
    title: "Sinais de emergência",
    text: "Confusão intensa, dificuldade para acordar, respiração lenta, vômitos repetidos, convulsões ou desmaio podem indicar intoxicação alcoólica. Procure atendimento de emergência imediatamente."
  };
}

function renderAll() {
  renderOccasionState();
  renderMetrics();
  renderDrinksTable();
  renderSummary();
  renderWellness();
  renderHistory();
  updateCharts();
  updateTimer();
}

function renderOccasionState() {
  const hasOccasion = Boolean(state.currentOccasion);

  elements.addDrinkBtn.disabled = !hasOccasion;
  elements.addDrinkSecondaryBtn.disabled = !hasOccasion;
  elements.finishOccasionBtn.disabled = !hasOccasion;

  if (!hasOccasion) {
    elements.occasionNameDisplay.textContent = "Nenhuma ocasião iniciada";
    elements.occasionStatusText.textContent = "Clique em “Iniciar nova ocasião” para começar.";
    elements.occasionTimer.textContent = "00:00:00";
    stopTimer();
    return;
  }

  elements.occasionNameDisplay.textContent = state.currentOccasion.name;
  elements.occasionStatusText.textContent =
    `Iniciada em ${formatDateTime(state.currentOccasion.startAt)}.`;

  startTimer();
}

function renderMetrics() {
  const totals = getOccasionTotals(state.currentOccasion);
  const attention = getAttentionLevel(totals.standardDrinks);

  elements.metricDrinks.textContent = formatNumber(totals.drinkUnits, 1);
  elements.metricVolume.textContent = `${formatNumber(totals.totalVolumeMl, 0)} ml`;
  elements.metricPureAlcohol.textContent = `${formatNumber(totals.pureAlcoholMl, 2)} ml`;
  elements.metricPureAlcoholGrams.textContent = `${formatNumber(totals.alcoholGrams, 2)} g`;
  elements.metricStandardDrinks.textContent = formatNumber(totals.standardDrinks, 2);
  elements.metricCalories.textContent = `${formatNumber(totals.calories, 0)} kcal`;
  elements.metricAttention.textContent = attention.label;
  elements.metricAttentionHint.textContent = attention.hint;
  elements.attentionCard.dataset.level = attention.key;

  elements.standardDoseLabel.textContent =
    `considerando ${formatNumber(state.settings.standardDoseGrams, 1)} g`;

  elements.safetyAlertPanel.dataset.level = attention.key;
  elements.safetyAlertTitle.textContent = attention.title;
  elements.safetyAlertText.textContent = attention.text;
}

function renderDrinksTable() {
  const drinks = state.currentOccasion?.drinks || [];

  if (!drinks.length) {
    elements.drinksTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">Nenhuma bebida registrada.</td>
      </tr>
    `;
    return;
  }

  elements.drinksTableBody.innerHTML = drinks
    .map((drink) => {
      const totals = calculateDrinkTotals(drink);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(drink.name)}</strong>
            <div class="table-subtext">${escapeHtml(drink.brand || drink.category)}</div>
          </td>
          <td>${formatNumber(drink.volumeMl, 0)} ml</td>
          <td>${formatNumber(drink.alcoholPercent, 1)}%</td>
          <td>${formatNumber(drink.quantity, 1)}</td>
          <td>${formatNumber(totals.pureAlcoholMl, 2)} ml</td>
          <td>${escapeHtml(drink.startTime)}–${escapeHtml(drink.endTime)}</td>
          <td>
            <button class="action-btn" type="button" data-edit-drink="${drink.id}">Editar</button>
            <button class="action-btn delete" type="button" data-delete-drink="${drink.id}">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");

  $$("[data-edit-drink]").forEach((button) => {
    button.addEventListener("click", () => openDrinkDialog(button.dataset.editDrink));
  });

  $$("[data-delete-drink]").forEach((button) => {
    button.addEventListener("click", () => {
      const drinkId = button.dataset.deleteDrink;
      openConfirmDialog(
        "Excluir bebida",
        "O registro selecionado será removido da ocasião atual.",
        () => deleteDrink(drinkId)
      );
    });
  });
}

function deleteDrink(drinkId) {
  if (!state.currentOccasion) return;

  state.currentOccasion.drinks = state.currentOccasion.drinks.filter(
    (drink) => drink.id !== drinkId
  );

  saveState();
  renderAll();
  showToast("Bebida excluída.");
}

function renderSummary() {
  const occasion = state.currentOccasion;
  const totals = getOccasionTotals(occasion);
  const sorted = [...(occasion?.drinks || [])].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  elements.summaryFirstDrink.textContent = sorted[0]?.startTime || "—";
  elements.summaryLastDrink.textContent = sorted.at(-1)?.endTime || "—";
  elements.summaryDuration.textContent = occasion
    ? formatDuration(getOccasionDurationMs(occasion), false)
    : "00:00";
  elements.summaryDrinkCount.textContent = formatNumber(totals.drinkUnits, 1);
  elements.summaryVolume.textContent = `${formatNumber(totals.totalVolumeMl, 0)} ml`;
  elements.summaryPureAlcohol.textContent = `${formatNumber(totals.pureAlcoholMl, 2)} ml`;
  elements.summaryAlcoholGrams.textContent = `${formatNumber(totals.alcoholGrams, 2)} g`;
  elements.summaryStandardDrinks.textContent = formatNumber(totals.standardDrinks, 2);
  elements.summaryCalories.textContent = `${formatNumber(totals.calories, 0)} kcal`;
}

function renderWellness() {
  const occasion = state.currentOccasion;
  elements.waterCount.textContent = occasion?.waterCups ?? 0;
  elements.foodCheckbox.checked = Boolean(occasion?.hadFood);
  elements.foodNotes.value = occasion?.foodNotes ?? "";

  elements.addWaterBtn.disabled = !occasion;
  elements.removeWaterBtn.disabled = !occasion;
  elements.foodCheckbox.disabled = !occasion;
  elements.foodNotes.disabled = !occasion;

  if (!occasion) {
    elements.hydrationReminder.textContent =
      "Inicie uma ocasião para registrar água e alimentação.";
    return;
  }

  const drinkUnits = getOccasionTotals(occasion).drinkUnits;
  const waterCups = occasion.waterCups || 0;

  if (drinkUnits >= 1 && waterCups === 0) {
    elements.hydrationReminder.textContent =
      "Lembrete: você ainda não registrou nenhum copo de água.";
  } else if (drinkUnits > waterCups + 1) {
    elements.hydrationReminder.textContent =
      "Considere registrar mais água ao longo da ocasião.";
  } else {
    elements.hydrationReminder.textContent =
      "Continue fazendo pausas e bebendo água.";
  }
}

function updateWater(delta) {
  if (!state.currentOccasion) return;

  state.currentOccasion.waterCups = Math.max(
    0,
    (state.currentOccasion.waterCups || 0) + delta
  );

  saveState();
  renderWellness();
}

function saveWellnessData() {
  if (!state.currentOccasion) return;

  state.currentOccasion.hadFood = elements.foodCheckbox.checked;
  state.currentOccasion.foodNotes = elements.foodNotes.value.trim();
  saveState();
}

function finishCurrentOccasion() {
  if (!state.currentOccasion) return;

  const finished = {
    ...state.currentOccasion,
    endAt: new Date().toISOString(),
    standardDoseGrams: state.settings.standardDoseGrams
  };

  state.history.unshift(finished);
  state.currentOccasion = null;
  saveState();
  renderAll();
  showToast("Ocasião finalizada e salva no histórico.");
}

function renderHistory() {
  const filtered = getFilteredHistory();

  if (!filtered.length) {
    elements.historyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">Nenhuma ocasião encontrada.</td>
      </tr>
    `;
    return;
  }

  elements.historyTableBody.innerHTML = filtered
    .map((occasion) => {
      const previousStandardDose = state.settings.standardDoseGrams;
      if (occasion.standardDoseGrams) {
        state.settings.standardDoseGrams = occasion.standardDoseGrams;
      }

      const totals = getOccasionTotals(occasion);
      const attention = getAttentionLevel(totals.standardDrinks);
      state.settings.standardDoseGrams = previousStandardDose;

      return `
        <tr>
          <td>${formatDate(occasion.startAt)}</td>
          <td>${escapeHtml(occasion.name)}</td>
          <td>${formatNumber(totals.drinkUnits, 1)}</td>
          <td>${formatNumber(totals.pureAlcoholMl, 2)} ml</td>
          <td>${formatNumber(totals.standardDrinks, 2)}</td>
          <td>${formatDuration(getOccasionDurationMs(occasion), false)}</td>
          <td>${attention.label}</td>
        </tr>
      `;
    })
    .join("");
}

function getFilteredHistory() {
  const filter = elements.historyFilter.value;
  const now = new Date();

  return state.history.filter((occasion) => {
    const date = new Date(occasion.startAt);

    if (filter === "today") {
      return isSameDay(date, now);
    }

    if (filter === "7days") {
      return date >= daysAgo(7);
    }

    if (filter === "30days") {
      return date >= daysAgo(30);
    }

    if (filter === "month") {
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }

    if (filter === "custom") {
      const start = elements.historyStartDate.value
        ? new Date(`${elements.historyStartDate.value}T00:00:00`)
        : null;
      const end = elements.historyEndDate.value
        ? new Date(`${elements.historyEndDate.value}T23:59:59`)
        : null;

      if (start && date < start) return false;
      if (end && date > end) return false;
    }

    return true;
  });
}

function exportHistoryCsv() {
  const history = getFilteredHistory();

  if (!history.length) {
    showToast("Não há dados para exportar.");
    return;
  }

  const rows = [
    [
      "Data",
      "Ocasião",
      "Quantidade de bebidas",
      "Volume total (ml)",
      "Álcool puro (ml)",
      "Álcool puro (g)",
      "Doses padrão",
      "Duração",
      "Nível de atenção",
      "Copos de água",
      "Alimentação"
    ]
  ];

  history.forEach((occasion) => {
    const originalDose = state.settings.standardDoseGrams;
    state.settings.standardDoseGrams =
      occasion.standardDoseGrams || state.settings.standardDoseGrams;

    const totals = getOccasionTotals(occasion);
    const attention = getAttentionLevel(totals.standardDrinks);
    state.settings.standardDoseGrams = originalDose;

    rows.push([
      formatDate(occasion.startAt),
      occasion.name,
      formatNumber(totals.drinkUnits, 1),
      formatNumber(totals.totalVolumeMl, 0),
      formatNumber(totals.pureAlcoholMl, 2),
      formatNumber(totals.alcoholGrams, 2),
      formatNumber(totals.standardDrinks, 2),
      formatDuration(getOccasionDurationMs(occasion), false),
      attention.label,
      occasion.waterCups || 0,
      occasion.hadFood ? "Sim" : "Não"
    ]);
  });

  const csv = rows
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historico-meu-consumo-${toDateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showToast("Histórico exportado.");
}

function initializeCharts() {
  if (typeof Chart === "undefined") return;

  Chart.defaults.color = "#d9c7cd";
  Chart.defaults.borderColor = "rgba(255,255,255,0.08)";

  categoryChart = new Chart($("#categoryChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Álcool puro (ml)",
          data: [],
          backgroundColor: "rgba(239, 51, 78, 0.72)",
          borderColor: "rgba(255, 107, 127, 1)",
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "ml de álcool puro"
          }
        }
      }
    }
  });

  timelineChart = new Chart($("#timelineChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Álcool acumulado (ml)",
          data: [],
          borderColor: "rgba(255, 107, 127, 1)",
          backgroundColor: "rgba(239, 51, 78, 0.18)",
          fill: true,
          tension: 0.28,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "ml acumulados"
          }
        }
      }
    }
  });
}

function updateCharts() {
  if (!categoryChart || !timelineChart) return;

  const drinks = state.currentOccasion?.drinks || [];
  const categoryTotals = {};

  drinks.forEach((drink) => {
    const pureAlcoholMl = calculateDrinkTotals(drink).pureAlcoholMl;
    categoryTotals[drink.category] =
      (categoryTotals[drink.category] || 0) + pureAlcoholMl;
  });

  categoryChart.data.labels = Object.keys(categoryTotals);
  categoryChart.data.datasets[0].data = Object.values(categoryTotals).map((value) =>
    Number(value.toFixed(2))
  );
  categoryChart.update();

  const sorted = [...drinks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  let accumulated = 0;
  const labels = [];
  const values = [];

  sorted.forEach((drink) => {
    accumulated += calculateDrinkTotals(drink).pureAlcoholMl;
    labels.push(`${drink.startTime} · ${drink.name}`);
    values.push(Number(accumulated.toFixed(2)));
  });

  timelineChart.data.labels = labels;
  timelineChart.data.datasets[0].data = values;
  timelineChart.update();
}

function startTimer() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    updateTimer();
    renderSummary();
  }, 1000);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimer() {
  if (!state.currentOccasion) {
    elements.occasionTimer.textContent = "00:00:00";
    return;
  }

  elements.occasionTimer.textContent = formatDuration(
    getOccasionDurationMs(state.currentOccasion),
    true
  );
}

function getOccasionDurationMs(occasion) {
  const start = new Date(occasion.startAt).getTime();
  const end = occasion.endAt ? new Date(occasion.endAt).getTime() : Date.now();
  return Math.max(0, end - start);
}

function openConfirmDialog(title, text, action) {
  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogText.textContent = text;
  pendingConfirmAction = action;
  elements.confirmDialog.showModal();
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  state.currentOccasion = null;
  state.history = [];
  state.settings.standardDoseGrams = 14;
  elements.standardDoseInput.value = 14;
  renderAll();
  showToast("Todos os dados foram apagados.");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;

    state.currentOccasion = saved.currentOccasion || null;
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.settings = {
      standardDoseGrams:
        Number(saved.settings?.standardDoseGrams) > 0
          ? Number(saved.settings.standardDoseGrams)
          : 14
    };
  } catch (error) {
    console.error("Falha ao carregar dados salvos:", error);
  }

  elements.standardDoseInput.value = state.settings.standardDoseGrams;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch((error) => console.error("Erro ao registrar Service Worker:", error));
    });
  }
}

async function installApp() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installAppBtn.classList.add("hidden");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(Number(value) || 0);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(dateValue));
}

function formatDateTime(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(dateValue));
}

function formatDuration(milliseconds, includeSeconds = true) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (!includeSeconds) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

function toDateTimeLocal(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function daysAgo(numberOfDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - numberOfDays);
  return date;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[;"\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(callback, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

document.addEventListener("DOMContentLoaded", init);
