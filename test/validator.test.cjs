"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseCsv, prepareDataFromCsv, validateData } = require("../src/validator.cjs");

const root = path.resolve(__dirname, "..");
const readExample = (name) => fs.readFileSync(path.join(root, "examples", name), "utf8");
const project = {
  project_name: "스마트센서 시제품 개발 — 가상 과제",
  agreement_start: "2026-01-01",
  agreement_end_current: "2026-07-31",
  personnel_budget_codes: "LAB"
};
const files = {
  budget: readExample("budget.csv"),
  participants: readExample("participants.csv"),
  evidence: readExample("evidence.csv"),
  transactions: readExample("transactions.csv")
};

test("공개 예제에서 의도한 오류 8건만 찾는다", () => {
  const result = validateData(prepareDataFromCsv(project, files));
  const actual = result.findings.map((item) => `${item.rule_id}|${item.transaction_id}`).sort();
  const expected = [
    "R001_DATE_OUTSIDE_PERIOD|X001",
    "R002_DUPLICATE_INVOICE|X002",
    "R003_EVIDENCE_MISSING|X003",
    "R003_EVIDENCE_MISSING|X004",
    "R004_BUDGET_CODE_UNKNOWN|X005",
    "R005_BUDGET_EXCEEDED|X006",
    "R006_PARTICIPANT_UNKNOWN|X007",
    "R007_VENDOR_NAME_INCONSISTENT|X008"
  ].sort();
  assert.deepEqual(actual, expected);
  assert.deepEqual(result.summary, {
    transactions: 14,
    active_transactions: 13,
    cancelled_transactions: 1,
    findings: 8,
    high: 5,
    medium: 2,
    low: 1
  });
});

test("CSV의 쉼표, 따옴표, CRLF와 UTF-8 BOM을 처리한다", () => {
  const rows = parseCsv('\uFEFF이름,금액,설명\r\n테스트,"1,234","따옴표 ""포함"""\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].금액, "1,234");
  assert.equal(rows[0].설명, '따옴표 "포함"');
});

test("엑셀 일련번호 날짜와 괄호 음수를 읽는다", () => {
  const input = prepareDataFromCsv(project, {
    budget: "code,budget\nMAT,1000",
    participants: "participant_id\nP001",
    evidence: "evidence_id\nEV1",
    transactions: "date,budget_code,amount,evidence_id,status\n46023,MAT,(100),EV1,posted"
  });
  assert.equal(input.transactions[0].date, "2026-01-01");
  assert.equal(input.transactions[0].amount, -100);
});

test("잘못된 날짜와 필수 열 누락을 거부한다", () => {
  assert.throws(() => prepareDataFromCsv({ ...project, agreement_start: "2026-02-30" }, files), /존재하지 않는 날짜/);
  assert.throws(() => prepareDataFromCsv(project, { ...files, budget: "name,budget\n재료비,100" }), /필수 열/);
});
