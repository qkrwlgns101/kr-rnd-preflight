"use strict";

const RULES = {
  R001_DATE_OUTSIDE_PERIOD: {
    risk: "high",
    title: "협약기간 밖 집행",
    reason: "집행일이 입력한 현재 협약기간 밖에 있습니다."
  },
  R002_DUPLICATE_INVOICE: {
    risk: "high",
    title: "증빙번호 중복",
    reason: "취소되지 않은 거래에서 같은 증빙번호가 두 번 이상 사용되었습니다."
  },
  R003_EVIDENCE_MISSING: {
    risk: "high",
    title: "증빙 연결 누락",
    reason: "증빙 ID가 비어 있거나 증빙목록에서 찾을 수 없습니다."
  },
  R004_BUDGET_CODE_UNKNOWN: {
    risk: "medium",
    title: "알 수 없는 비목코드",
    reason: "거래의 비목코드가 예산표에 없습니다."
  },
  R005_BUDGET_EXCEEDED: {
    risk: "high",
    title: "비목예산 초과",
    reason: "해당 거래에서 비목 누적액이 입력한 예산을 처음 초과합니다."
  },
  R006_PARTICIPANT_UNKNOWN: {
    risk: "medium",
    title: "참여인력 불일치",
    reason: "인건비 거래의 참여인력이 참여인력 목록에 없습니다."
  },
  R007_VENDOR_NAME_INCONSISTENT: {
    risk: "low",
    title: "거래처명 표기 불일치",
    reason: "같은 거래처 ID에 서로 다른 거래처명이 사용되었습니다."
  }
};

const ALIASES = {
  budget: {
    code: ["code", "budget_code", "비목코드", "세목코드"],
    name: ["name", "budget_name", "비목명", "세목명"],
    budget: ["budget", "budget_amount", "예산", "예산액", "협약예산"]
  },
  participants: {
    participant_id: ["participant_id", "참여인력id", "참여자id", "참여인력", "성명"],
    name: ["name", "participant_name", "이름", "성명"]
  },
  evidence: {
    evidence_id: ["evidence_id", "증빙id", "증빙번호", "파일명"],
    type: ["type", "evidence_type", "증빙유형", "종류"]
  },
  transactions: {
    transaction_id: ["transaction_id", "거래id", "집행id", "집행번호", "연번"],
    date: ["date", "transaction_date", "집행일", "집행일자", "거래일"],
    budget_code: ["budget_code", "code", "비목코드", "세목코드"],
    amount: ["amount", "transaction_amount", "집행액", "집행금액", "금액"],
    invoice_no: ["invoice_no", "invoice", "증빙번호", "세금계산서번호"],
    evidence_id: ["evidence_id", "증빙id", "증빙파일", "파일명"],
    participant_id: ["participant_id", "참여인력id", "참여자id", "참여인력", "성명"],
    vendor_id: ["vendor_id", "거래처id", "사업자등록번호", "거래처코드"],
    vendor_name: ["vendor_name", "거래처명", "공급자명"],
    status: ["status", "상태", "거래상태"],
    description: ["description", "적요", "내용", "사용내용"]
  }
};

function parseCsv(text) {
  if (typeof text !== "string") throw new Error("CSV 내용이 문자열이 아닙니다.");
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((value) => value.trim());
  if (headers.some((header) => header === "")) throw new Error("CSV 헤더에 빈 열 이름이 있습니다.");
  const normalized = headers.map(normalizeHeader);
  if (new Set(normalized).size !== normalized.length) throw new Error("CSV 헤더가 중복되었습니다.");

  return rows.slice(1).map((values, rowIndex) => {
    const item = { __row: rowIndex + 2 };
    headers.forEach((header, columnIndex) => {
      item[header] = (values[columnIndex] ?? "").trim();
    });
    return item;
  });
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function findHeader(rows, aliases) {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]).filter((key) => key !== "__row");
  const wanted = new Set(aliases.map(normalizeHeader));
  return headers.find((header) => wanted.has(normalizeHeader(header))) ?? null;
}

function mappedValue(row, header) {
  return header ? String(row[header] ?? "").trim() : "";
}

function mapRows(rows, type, requiredFields) {
  const schema = ALIASES[type];
  const columns = {};
  for (const [field, aliases] of Object.entries(schema)) columns[field] = findHeader(rows, aliases);
  const missing = requiredFields.filter((field) => !columns[field]);
  if (missing.length > 0) {
    throw new Error(`${type} CSV 필수 열을 찾을 수 없습니다: ${missing.join(", ")}`);
  }
  return rows.map((row) => {
    const mapped = { __row: row.__row };
    for (const field of Object.keys(schema)) mapped[field] = mappedValue(row, columns[field]);
    return mapped;
  });
}

function parseAmount(value, label) {
  let cleaned = String(value ?? "").trim();
  const negative = /^\(.*\)$/.test(cleaned);
  cleaned = cleaned.replace(/[₩원,\s]/g, "").replace(/^\((.*)\)$/, "$1");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(cleaned)) throw new Error(`${label} 금액 형식이 올바르지 않습니다: ${value}`);
  const number = Number(cleaned) * (negative ? -1 : 1);
  if (!Number.isFinite(number)) throw new Error(`${label} 금액을 숫자로 바꿀 수 없습니다.`);
  return number;
}

function normalizeDate(value, label) {
  const raw = String(value ?? "").trim();
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const utc = Date.UTC(1899, 11, 30) + Number(raw) * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  const match = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(raw);
  if (!match) throw new Error(`${label} 날짜 형식이 올바르지 않습니다: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} 존재하지 않는 날짜입니다: ${value}`);
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return ["cancelled", "canceled", "취소", "취소됨", "환입"].includes(status) ? "cancelled" : "posted";
}

function prepareDataFromCsv(project, csvFiles) {
  const agreementStart = normalizeDate(project.agreement_start, "협약 시작일");
  const agreementEnd = normalizeDate(project.agreement_end_current, "현재 협약 종료일");
  if (agreementStart > agreementEnd) throw new Error("협약 시작일이 종료일보다 늦습니다.");

  const budgetRows = mapRows(parseCsv(csvFiles.budget), "budget", ["code", "budget"]);
  const participantRows = mapRows(parseCsv(csvFiles.participants), "participants", ["participant_id"]);
  const evidenceRows = mapRows(parseCsv(csvFiles.evidence), "evidence", ["evidence_id"]);
  const transactionRows = mapRows(parseCsv(csvFiles.transactions), "transactions", ["date", "budget_code", "amount"]);
  if (budgetRows.length === 0) throw new Error("예산 CSV에 데이터 행이 없습니다.");
  if (transactionRows.length === 0) throw new Error("집행내역 CSV에 데이터 행이 없습니다.");

  const budget = budgetRows.map((row) => ({
    code: row.code,
    name: row.name,
    budget: parseAmount(row.budget, `예산 CSV ${row.__row}행`),
    source_row: row.__row
  }));
  const participants = participantRows.filter((row) => row.participant_id).map((row) => ({
    participant_id: row.participant_id,
    name: row.name,
    source_row: row.__row
  }));
  const evidence = evidenceRows.filter((row) => row.evidence_id).map((row) => ({
    evidence_id: row.evidence_id,
    type: row.type,
    source_row: row.__row
  }));
  const transactions = transactionRows.map((row, index) => ({
    transaction_id: row.transaction_id || `ROW-${String(index + 1).padStart(4, "0")}`,
    date: normalizeDate(row.date, `집행내역 CSV ${row.__row}행`),
    budget_code: row.budget_code,
    amount: parseAmount(row.amount, `집행내역 CSV ${row.__row}행`),
    invoice_no: row.invoice_no,
    evidence_id: row.evidence_id,
    participant_id: row.participant_id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    status: normalizeStatus(row.status),
    description: row.description,
    source_row: row.__row
  }));

  return {
    project: {
      project_name: String(project.project_name ?? "").trim() || "이름 없는 과제",
      agreement_start: agreementStart,
      agreement_end_current: agreementEnd,
      personnel_budget_codes: String(project.personnel_budget_codes ?? "LAB")
        .split(/[,;\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    },
    budget,
    participants,
    evidence,
    transactions
  };
}

function validateData(data) {
  const { project, budget, participants, evidence, transactions } = data;
  const findings = [];
  const add = (ruleId, transaction, details = {}) => {
    const rule = RULES[ruleId];
    findings.push({
      rule_id: ruleId,
      risk: rule.risk,
      title: rule.title,
      reason: rule.reason,
      transaction_id: transaction.transaction_id,
      source_row: transaction.source_row,
      date: transaction.date,
      amount: transaction.amount,
      ...details
    });
  };

  const ids = new Set();
  for (const transaction of transactions) {
    if (ids.has(transaction.transaction_id)) throw new Error(`거래 ID가 중복되었습니다: ${transaction.transaction_id}`);
    ids.add(transaction.transaction_id);
  }

  const active = transactions.filter((transaction) => transaction.status !== "cancelled");
  const budgetByCode = new Map(budget.map((item) => [item.code, item]));
  const participantIds = new Set(participants.map((item) => item.participant_id));
  const evidenceIds = new Set(evidence.map((item) => item.evidence_id));
  const personnelCodes = new Set(project.personnel_budget_codes);

  for (const transaction of active) {
    if (transaction.date < project.agreement_start || transaction.date > project.agreement_end_current) {
      add("R001_DATE_OUTSIDE_PERIOD", transaction, {
        value: transaction.date,
        expected: `${project.agreement_start}~${project.agreement_end_current}`
      });
    }
  }

  const invoiceFirstSeen = new Map();
  for (const transaction of active) {
    if (!transaction.invoice_no) continue;
    if (invoiceFirstSeen.has(transaction.invoice_no)) {
      add("R002_DUPLICATE_INVOICE", transaction, {
        value: transaction.invoice_no,
        first_transaction_id: invoiceFirstSeen.get(transaction.invoice_no)
      });
    } else {
      invoiceFirstSeen.set(transaction.invoice_no, transaction.transaction_id);
    }
  }

  for (const transaction of active) {
    if (!transaction.evidence_id || !evidenceIds.has(transaction.evidence_id)) {
      add("R003_EVIDENCE_MISSING", transaction, { value: transaction.evidence_id || "(공란)" });
    }
    if (!budgetByCode.has(transaction.budget_code)) {
      add("R004_BUDGET_CODE_UNKNOWN", transaction, { value: transaction.budget_code || "(공란)" });
    }
    if (personnelCodes.has(transaction.budget_code) && !participantIds.has(transaction.participant_id)) {
      add("R006_PARTICIPANT_UNKNOWN", transaction, { value: transaction.participant_id || "(공란)" });
    }
  }

  const cumulative = new Map();
  const exceededCodes = new Set();
  const ordered = [...active].sort((a, b) => a.date.localeCompare(b.date) || a.source_row - b.source_row);
  for (const transaction of ordered) {
    const category = budgetByCode.get(transaction.budget_code);
    if (!category) continue;
    const next = (cumulative.get(transaction.budget_code) ?? 0) + transaction.amount;
    cumulative.set(transaction.budget_code, next);
    if (next > category.budget && !exceededCodes.has(transaction.budget_code)) {
      exceededCodes.add(transaction.budget_code);
      add("R005_BUDGET_EXCEEDED", transaction, {
        value: transaction.budget_code,
        cumulative_amount: next,
        budget_amount: category.budget,
        over_amount: next - category.budget
      });
    }
  }

  const vendorNameById = new Map();
  for (const transaction of active) {
    if (!transaction.vendor_id || !transaction.vendor_name) continue;
    const currentName = transaction.vendor_name.trim();
    if (!vendorNameById.has(transaction.vendor_id)) {
      vendorNameById.set(transaction.vendor_id, currentName);
      continue;
    }
    const firstName = vendorNameById.get(transaction.vendor_id);
    if (currentName !== firstName) {
      add("R007_VENDOR_NAME_INCONSISTENT", transaction, {
        value: transaction.vendor_id,
        first_name: firstName,
        current_name: currentName
      });
    }
  }

  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach((finding) => { counts[finding.risk] += 1; });
  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    project: project.project_name,
    summary: {
      transactions: transactions.length,
      active_transactions: active.length,
      cancelled_transactions: transactions.length - active.length,
      findings: findings.length,
      ...counts
    },
    findings,
    notice: "이 결과는 입력 데이터의 기계적 불일치 후보입니다. 집행 적정성이나 정산 통과를 보증하지 않습니다."
  };
}

module.exports = { ALIASES, RULES, parseCsv, prepareDataFromCsv, validateData };
