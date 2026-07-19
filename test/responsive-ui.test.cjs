"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "web", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "web", "styles.css"), "utf8");

test("모바일 viewport와 유동 글자 크기를 유지한다", () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(css, /\.hero h1[^}]*font-size:\s*clamp\(/s);
  assert.match(css, /\.hero-copy[^}]*font-size:\s*clamp\(/s);
  assert.match(css, /\.section-heading h2[^}]*font-size:\s*clamp\(/s);
  assert.match(css, /\.metrics strong[^}]*font-size:\s*clamp\(/s);
});

test("한국어와 긴 식별자가 좁은 화면에서 넘치지 않는다", () => {
  assert.match(css, /word-break:\s*keep-all/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /button[^}]*white-space:\s*normal/s);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("데스크톱·태블릿·모바일·초소형 화면 분기점을 제공한다", () => {
  for (const width of [900, 640, 420, 340]) {
    assert.match(css, new RegExp(`@media \\(max-width: ${width}px\\)`));
  }
});
