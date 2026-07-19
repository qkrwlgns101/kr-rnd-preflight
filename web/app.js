"use strict";

const $ = (selector) => document.querySelector(selector);
const fileInputs = {
  budget: $("#budgetFile"),
  participants: $("#participantsFile"),
  evidence: $("#evidenceFile"),
  transactions: $("#transactionsFile")
};
const fileNames = {
  budget: $("#budgetName"),
  participants: $("#participantsName"),
  evidence: $("#evidenceName"),
  transactions: $("#transactionsName")
};
let demoFiles = null;
let lastResult = null;

for (const [key, input] of Object.entries(fileInputs)) {
  input.addEventListener("change", () => {
    demoFiles = null;
    fileNames[key].textContent = input.files[0]?.name ?? "선택 안 됨";
    fileNames[key].classList.toggle("selected", Boolean(input.files[0]));
  });
}

function showError(message) {
  const box = $("#errorBox");
  box.textContent = message;
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearError() {
  $("#errorBox").hidden = true;
}

async function readSelectedFiles() {
  if (demoFiles) return demoFiles;
  const missing = Object.entries(fileInputs).filter(([, input]) => !input.files[0]).map(([key]) => key);
  if (missing.length > 0) throw new Error("예산표, 참여인력, 증빙목록, 집행내역 CSV를 모두 선택하세요.");
  const entries = await Promise.all(Object.entries(fileInputs).map(async ([key, input]) => [key, await input.files[0].text()]));
  return Object.fromEntries(entries);
}

async function loadDemo() {
  clearError();
  const button = $("#demoButton");
  button.disabled = true;
  try {
    const keys = Object.keys(fileInputs);
    const entries = await Promise.all(keys.map(async (key) => {
      const response = await fetch(`examples/${key}.csv`);
      if (!response.ok) throw new Error("예시 파일을 불러오지 못했습니다.");
      return [key, await response.text()];
    }));
    demoFiles = Object.fromEntries(entries);
    $("#projectName").value = "스마트센서 시제품 개발 — 가상 과제";
    $("#agreementStart").value = "2026-01-01";
    $("#agreementEnd").value = "2026-07-31";
    $("#personnelCodes").value = "LAB";
    for (const key of keys) {
      fileNames[key].textContent = `예시 ${key}.csv`;
      fileNames[key].classList.add("selected");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function riskLabel(risk) {
  return { high: "높음", medium: "보통", low: "낮음" }[risk] ?? risk;
}

function renderResult(result) {
  lastResult = result;
  const summary = result.summary;
  $("#metrics").innerHTML = `
    <article><span>전체 거래</span><strong>${formatNumber(summary.transactions)}</strong></article>
    <article><span>확인 필요</span><strong>${formatNumber(summary.findings)}</strong></article>
    <article class="metric-high"><span>높은 위험</span><strong>${formatNumber(summary.high)}</strong></article>
    <article><span>취소 제외</span><strong>${formatNumber(summary.cancelled_transactions)}</strong></article>`;

  const tbody = $("#findingsBody");
  tbody.replaceChildren();
  if (result.findings.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5" class="empty-result">설정된 기계적 검사에서 불일치가 발견되지 않았습니다.</td>';
    tbody.append(row);
  } else {
    for (const finding of result.findings) {
      const row = document.createElement("tr");
      const cells = [
        `<span class="risk risk-${finding.risk}">${riskLabel(finding.risk)}</span>`,
        escapeHtml(finding.transaction_id),
        formatNumber(finding.source_row),
        `<strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.reason)}</small>`,
        escapeHtml(String(finding.value ?? "—"))
      ];
      row.innerHTML = cells.map((cell) => `<td>${cell}</td>`).join("");
      tbody.append(row);
    }
  }
  $("#results").hidden = false;
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function validate(event) {
  event.preventDefault();
  clearError();
  const button = $("#validateButton");
  button.disabled = true;
  button.textContent = "검사 중…";
  try {
    const project = {
      project_name: $("#projectName").value,
      agreement_start: $("#agreementStart").value,
      agreement_end_current: $("#agreementEnd").value,
      personnel_budget_codes: $("#personnelCodes").value
    };
    if (!project.project_name || !project.agreement_start || !project.agreement_end_current) {
      throw new Error("과제명과 협약기간을 모두 입력하세요.");
    }
    const files = await readSelectedFiles();
    const response = await fetch("validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, files })
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "검사 중 오류가 발생했습니다.");
    renderResult(payload.result);
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "불일치 검사 시작";
  }
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

$("#downloadJson").addEventListener("click", () => {
  if (!lastResult) return;
  download("preflight-result.json", JSON.stringify(lastResult, null, 2), "application/json;charset=utf-8");
});

$("#downloadCsv").addEventListener("click", () => {
  if (!lastResult) return;
  const headers = ["위험", "거래ID", "CSV행", "규칙ID", "검사항목", "사유", "확인값"];
  const rows = lastResult.findings.map((finding) => [
    riskLabel(finding.risk), finding.transaction_id, finding.source_row, finding.rule_id,
    finding.title, finding.reason, finding.value ?? ""
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  download("preflight-findings.csv", csv, "text/csv;charset=utf-8");
});

$("#shutdownButton").addEventListener("click", async () => {
  try { await fetch("shutdown", { method: "POST" }); } catch { /* process may close first */ }
  document.body.innerHTML = '<main class="closed"><h1>검증기를 종료했습니다.</h1><p>이 창을 닫아도 됩니다.</p></main>';
});

$("#demoButton").addEventListener("click", loadDemo);
$("#validationForm").addEventListener("submit", validate);
