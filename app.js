const ADMIN_FEE_RATE = 0.05;
const BURDEN_MULTIPLIER = 1.3;

const els = {
  annualRevenue: document.getElementById("annualRevenue"),
  grossMargin: document.getElementById("grossMargin"),
  annualSalary: document.getElementById("annualSalary"),
  commissionRate: document.getElementById("commissionRate"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  printBtn: document.getElementById("printBtn"),
  resetBtn: document.getElementById("resetBtn"),
  kpiRevenue: document.getElementById("kpiRevenue"),
  kpiGrossProfit: document.getElementById("kpiGrossProfit"),
  kpiAdjustedGrossProfit: document.getElementById("kpiAdjustedGrossProfit"),
  kpiOte: document.getElementById("kpiOte"),
  kpiRetained: document.getElementById("kpiRetained"),
  analysisRevenue: document.getElementById("analysisRevenue"),
  analysisGrossProfit: document.getElementById("analysisGrossProfit"),
  analysisGrossMargin: document.getElementById("analysisGrossMargin"),
  analysisSalary: document.getElementById("analysisSalary"),
  analysisBurden: document.getElementById("analysisBurden"),
  analysisAdminFee: document.getElementById("analysisAdminFee"),
  analysisTotalInvestment: document.getElementById("analysisTotalInvestment"),
  analysisAgp: document.getElementById("analysisAgp"),
  analysisEligibleAgp: document.getElementById("analysisEligibleAgp"),
  analysisCommissionRate: document.getElementById("analysisCommissionRate"),
  analysisCommission: document.getElementById("analysisCommission"),
  analysisRetainedGp: document.getElementById("analysisRetainedGp"),
  analysisRetainedPct: document.getElementById("analysisRetainedPct"),
  analysisOte: document.getElementById("analysisOte"),
  analysisSustainability: document.getElementById("analysisSustainability"),
  assessmentHeadline: document.getElementById("assessmentHeadline"),
  assessmentAdditionalRevenue: document.getElementById("assessmentAdditionalRevenue"),
  assessmentOte: document.getElementById("assessmentOte"),
  assessmentRetainedGp: document.getElementById("assessmentRetainedGp"),
  recoveryPercent: document.getElementById("recoveryPercent"),
  recoveryProgress: document.getElementById("recoveryProgress"),
  recoveryBreakEvenRevenue: document.getElementById("recoveryBreakEvenRevenue"),
  recoveryBreakEvenGrossProfit: document.getElementById("recoveryBreakEvenGrossProfit"),
  recoveryRecoveredAgp: document.getElementById("recoveryRecoveredAgp"),
  recoveryRemainingBurden: document.getElementById("recoveryRemainingBurden"),
  recoveryRevenueAbove: document.getElementById("recoveryRevenueAbove"),
  recoveryCommissionStatus: document.getElementById("recoveryCommissionStatus"),
  recoverySalary: document.getElementById("recoverySalary"),
  recoveryCommission: document.getElementById("recoveryCommission"),
  recoveryOte: document.getElementById("recoveryOte"),
  insightsList: document.getElementById("insightsList")
};

const editableInputs = [
  { el: els.annualRevenue, type: "currency" },
  { el: els.grossMargin, type: "percent" },
  { el: els.annualSalary, type: "currency" },
  { el: els.commissionRate, type: "percent" }
];

function sanitizeNumber(text) {
  if (!text) {
    return "";
  }
  const cleaned = text.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) {
    return cleaned;
  }
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

function parseInputValue(input) {
  const cleaned = sanitizeNumber(input.value);
  if (cleaned === "") {
    return null;
  }
  const number = Number(cleaned);
  if (!Number.isFinite(number)) {
    return null;
  }
  return number;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function dashIfMissing(value, formatter) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return formatter(value);
}

function setText(el, value, formatter) {
  el.textContent = dashIfMissing(value, formatter);
}

function allInputsPresent(values) {
  return values.every((v) => v !== null);
}

function calculate(values) {
  const revenue = values.revenue;
  const marginPct = values.marginPct;
  const salary = values.salary;
  const commissionPct = values.commissionPct;

  const margin = marginPct / 100;
  const commissionRate = commissionPct / 100;
  const grossProfit = revenue * margin;
  const adminFee = grossProfit * ADMIN_FEE_RATE;
  const adjustedGrossProfit = grossProfit - adminFee;
  const annualBurden = salary * BURDEN_MULTIPLIER;
  const commissionEligibleAgp = adjustedGrossProfit - annualBurden;
  const commissionActive = adjustedGrossProfit > annualBurden;
  const salesCommission = commissionActive ? commissionEligibleAgp * commissionRate : 0;
  const annualOte = salary + salesCommission;
  const retainedGp = adjustedGrossProfit - annualBurden - salesCommission;
  const retainedPct = grossProfit === 0 ? 0 : retainedGp / grossProfit;
  const breakEvenRevenue = margin > 0 ? annualBurden / (margin * (1 - ADMIN_FEE_RATE)) : null;
  const breakEvenGrossProfit = annualBurden / (1 - ADMIN_FEE_RATE);
  const recoveredAgp = Math.max(0, Math.min(adjustedGrossProfit, annualBurden));
  const remainingBurden = Math.max(annualBurden - adjustedGrossProfit, 0);
  const revenueAboveBreakEven = breakEvenRevenue === null ? null : Math.max(revenue - breakEvenRevenue, 0);
  const recoveryPct = annualBurden > 0 ? (adjustedGrossProfit / annualBurden) * 100 : 0;
  const neededAgp = Math.max(annualBurden - adjustedGrossProfit, 0);
  const additionalRevenueRequired = margin > 0 ? neededAgp / (margin * (1 - ADMIN_FEE_RATE)) : null;
  const sustainable = adjustedGrossProfit > annualBurden && retainedGp > 0;

  return {
    revenue,
    marginPct,
    salary,
    commissionPct,
    grossProfit,
    adminFee,
    adjustedGrossProfit,
    annualBurden,
    commissionEligibleAgp,
    commissionActive,
    salesCommission,
    annualOte,
    retainedGp,
    retainedPct,
    breakEvenRevenue,
    breakEvenGrossProfit,
    recoveredAgp,
    remainingBurden,
    revenueAboveBreakEven,
    recoveryPct,
    additionalRevenueRequired,
    sustainable
  };
}

function renderEmpty() {
  const currencyTargets = [
    els.kpiRevenue, els.kpiGrossProfit, els.kpiAdjustedGrossProfit, els.kpiOte, els.kpiRetained,
    els.analysisRevenue, els.analysisGrossProfit, els.analysisSalary, els.analysisBurden, els.analysisAdminFee,
    els.analysisTotalInvestment, els.analysisAgp, els.analysisEligibleAgp, els.analysisCommission, els.analysisRetainedGp,
    els.analysisOte, els.assessmentAdditionalRevenue, els.assessmentOte, els.assessmentRetainedGp,
    els.recoveryBreakEvenRevenue, els.recoveryBreakEvenGrossProfit, els.recoveryRecoveredAgp, els.recoveryRemainingBurden,
    els.recoveryRevenueAbove, els.recoverySalary, els.recoveryCommission, els.recoveryOte
  ];
  currencyTargets.forEach((target) => {
    target.textContent = "-";
  });

  [els.analysisGrossMargin, els.analysisCommissionRate, els.analysisRetainedPct].forEach((target) => {
    target.textContent = "-";
  });

  els.analysisSustainability.textContent = "-";
  els.assessmentHeadline.textContent = "Awaiting complete assumptions.";
  els.recoveryPercent.textContent = "-";
  els.recoveryCommissionStatus.textContent = "-";
  els.recoveryProgress.style.width = "0%";
  els.insightsList.innerHTML = [
    "Enter annual assumptions to generate live executive insights.",
    "Commission remains inactive until Adjusted Gross Profit exceeds Annual Burden.",
    "Administration Fee is fixed at 5% of Gross Profit.",
    "Annual Burden is calculated at Salary x 1.30.",
    "Break Even Revenue is burden divided by (Gross Margin × 95%)."
  ].map((line) => `<li>${line}</li>`).join("");
}

function renderCalculated(data) {
  setText(els.kpiRevenue, data.revenue, formatCurrency);
  setText(els.kpiGrossProfit, data.grossProfit, formatCurrency);
  setText(els.kpiAdjustedGrossProfit, data.adjustedGrossProfit, formatCurrency);
  setText(els.kpiOte, data.annualOte, formatCurrency);
  setText(els.kpiRetained, data.retainedGp, formatCurrency);

  setText(els.analysisRevenue, data.revenue, formatCurrency);
  setText(els.analysisGrossProfit, data.grossProfit, formatCurrency);
  setText(els.analysisGrossMargin, data.marginPct, formatPercent);
  setText(els.analysisSalary, data.salary, formatCurrency);
  setText(els.analysisBurden, data.annualBurden, formatCurrency);
  setText(els.analysisAdminFee, data.adminFee, formatCurrency);
  setText(els.analysisTotalInvestment, data.annualBurden + data.adminFee, formatCurrency);
  setText(els.analysisAgp, data.adjustedGrossProfit, formatCurrency);
  setText(els.analysisEligibleAgp, Math.max(data.commissionEligibleAgp, 0), formatCurrency);
  setText(els.analysisCommissionRate, data.commissionPct, formatPercent);
  setText(els.analysisCommission, data.salesCommission, formatCurrency);
  setText(els.analysisRetainedGp, data.retainedGp, formatCurrency);
  setText(els.analysisRetainedPct, data.retainedPct * 100, formatPercent);
  setText(els.analysisOte, data.annualOte, formatCurrency);

  const sustainability = data.sustainable ? "Financially Sustainable" : "Not Yet Sustainable";
  const commissionState = data.commissionActive ? "Commission Active" : "Commission Not Yet Earned";
  els.analysisSustainability.textContent = `${sustainability} • ${commissionState}`;
  els.assessmentHeadline.textContent = data.sustainable
    ? "Financially Sustainable. Commission Active."
    : data.commissionActive
      ? "Commission Active, but retained return is not yet sustainable."
      : "Not Yet Sustainable. Commission Not Yet Earned.";
  setText(els.assessmentAdditionalRevenue, data.additionalRevenueRequired, formatCurrency);
  setText(els.assessmentOte, data.annualOte, formatCurrency);
  setText(els.assessmentRetainedGp, data.retainedGp, formatCurrency);

  setText(els.recoveryBreakEvenRevenue, data.breakEvenRevenue, formatCurrency);
  setText(els.recoveryBreakEvenGrossProfit, data.breakEvenGrossProfit, formatCurrency);
  setText(els.recoveryRecoveredAgp, data.recoveredAgp, formatCurrency);
  setText(els.recoveryRemainingBurden, data.remainingBurden, formatCurrency);
  setText(els.recoveryRevenueAbove, data.revenueAboveBreakEven, formatCurrency);
  els.recoveryCommissionStatus.textContent = commissionState;
  setText(els.recoverySalary, data.salary, formatCurrency);
  setText(els.recoveryCommission, data.salesCommission, formatCurrency);
  setText(els.recoveryOte, data.annualOte, formatCurrency);

  els.recoveryPercent.textContent = formatPercent(data.recoveryPct);
  const progress = Math.max(0, Math.min(data.recoveryPct, 100));
  els.recoveryProgress.style.width = `${progress}%`;

  const insights = [
    `Break even occurs at ${dashIfMissing(data.breakEvenRevenue, formatCurrency)} in annual revenue.`,
    data.commissionActive
      ? `Representative is commission eligible with ${formatCurrency(data.salesCommission)} in annual commission.`
      : `Representative is not commission eligible and remains at ${formatCurrency(data.salary)} OTE.`,
    `Administration fee equals ${formatCurrency(data.adminFee)} annually at the fixed 5% rate.`,
    `Company retains ${formatCurrency(data.retainedGp)} (${formatPercent(data.retainedPct * 100)}) of gross profit.`,
    `Annual OTE equals ${formatCurrency(data.annualOte)}.`
  ];
  els.insightsList.innerHTML = insights.map((line) => `<li>${line}</li>`).join("");
}

function getCurrentValues() {
  return {
    revenue: parseInputValue(els.annualRevenue),
    marginPct: parseInputValue(els.grossMargin),
    salary: parseInputValue(els.annualSalary),
    commissionPct: parseInputValue(els.commissionRate)
  };
}

function refresh() {
  const values = getCurrentValues();
  if (!allInputsPresent(Object.values(values))) {
    renderEmpty();
    return null;
  }
  const data = calculate(values);
  renderCalculated(data);
  return data;
}

function attachInputFormatting() {
  editableInputs.forEach(({ el, type }) => {
    el.addEventListener("input", () => {
      const cleaned = sanitizeNumber(el.value);
      el.value = cleaned;
      refresh();
    });

    el.addEventListener("focus", () => {
      const parsed = parseInputValue(el);
      if (parsed === null) {
        el.value = "";
        return;
      }
      el.value = String(parsed);
    });

    el.addEventListener("blur", () => {
      const parsed = parseInputValue(el);
      if (parsed === null) {
        el.value = "";
        refresh();
        return;
      }
      el.value = type === "currency" ? formatCurrency(parsed) : formatPercent(parsed);
      refresh();
    });
  });
}

function exportCsv() {
  const data = refresh();
  if (!data) {
    return;
  }
  const rows = [
    ["Metric", "Value"],
    ["Annual Revenue", formatCurrency(data.revenue)],
    ["Gross Profit", formatCurrency(data.grossProfit)],
    ["Administration Fee", formatCurrency(data.adminFee)],
    ["Adjusted Gross Profit", formatCurrency(data.adjustedGrossProfit)],
    ["Annual Salary", formatCurrency(data.salary)],
    ["Annual Burden", formatCurrency(data.annualBurden)],
    ["Commission Eligible AGP", formatCurrency(Math.max(data.commissionEligibleAgp, 0))],
    ["Sales Commission", formatCurrency(data.salesCommission)],
    ["Annual OTE", formatCurrency(data.annualOte)],
    ["Company Retained GP", formatCurrency(data.retainedGp)],
    ["Company Retained %", formatPercent(data.retainedPct * 100)],
    ["Break Even Revenue", dashIfMissing(data.breakEvenRevenue, formatCurrency)],
    ["Break Even Gross Profit", formatCurrency(data.breakEvenGrossProfit)],
    ["Recovered AGP", formatCurrency(data.recoveredAgp)],
    ["Remaining Burden", formatCurrency(data.remainingBurden)],
    ["Revenue Above Break Even", dashIfMissing(data.revenueAboveBreakEven, formatCurrency)],
    ["Commission Status", data.commissionActive ? "Commission Active" : "Commission Not Yet Earned"],
    ["Financial Sustainability", data.sustainable ? "Financially Sustainable" : "Not Yet Sustainable"]
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `22vets-sales-rep-commission-scenario-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function resetCalculator() {
  editableInputs.forEach(({ el }) => {
    el.value = "";
  });
  renderEmpty();
}

function init() {
  attachInputFormatting();
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.printBtn.addEventListener("click", () => window.print());
  els.resetBtn.addEventListener("click", resetCalculator);
  renderEmpty();
}

init();
