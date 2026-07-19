"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const version = process.versions.node;
const url = `https://raw.githubusercontent.com/nodejs/node/v${version}/LICENSE`;
const output = path.resolve(__dirname, "..", "build", "THIRD_PARTY_LICENSES.txt");

https.get(url, { headers: { "User-Agent": "kr-rnd-preflight-build" } }, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Node.js 라이선스를 받지 못했습니다: HTTP ${response.statusCode}`);
    process.exitCode = 1;
    response.resume();
    return;
  }
  let license = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { license += chunk; });
  response.on("end", () => {
    const heading = `THIRD-PARTY LICENSES\n\nThe Windows executable embeds Node.js v${version}.\nSource: https://github.com/nodejs/node/tree/v${version}\n\n`;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, heading + license, "utf8");
  });
}).on("error", (error) => {
  console.error(`Node.js 라이선스를 받지 못했습니다: ${error.message}`);
  process.exitCode = 1;
});
