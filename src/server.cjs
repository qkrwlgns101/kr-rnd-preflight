"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { prepareDataFromCsv, validateData } = require("./validator.cjs");

const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const token = crypto.randomBytes(24).toString("hex");
const isSea = (() => {
  try {
    return require("node:sea").isSea();
  } catch {
    return false;
  }
})();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function getAsset(name) {
  if (isSea) return require("node:sea").getAsset(name, "utf8");
  const root = path.resolve(__dirname, "..");
  return fs.readFileSync(path.join(root, name), "utf8");
}

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  };
}

function respond(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, securityHeaders(contentType));
  response.end(body);
}

function respondJson(response, status, value) {
  respond(response, status, JSON.stringify(value), "application/json; charset=utf-8");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("입력 파일 합계가 25MB를 초과했습니다."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("요청 데이터를 읽을 수 없습니다."));
      }
    });
    request.on("error", reject);
  });
}

let idleTimer;
function refreshIdleTimer(server) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log("30분 동안 사용하지 않아 검증기를 종료합니다.");
    server.close(() => process.exit(0));
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref();
}

function start() {
  const server = http.createServer(async (request, response) => {
    refreshIdleTimer(server);
    const url = new URL(request.url, `http://${HOST}`);
    const prefix = `/${token}`;
    if (!url.pathname.startsWith(prefix)) {
      respond(response, 404, "Not found");
      return;
    }
    const route = url.pathname.slice(prefix.length) || "/";

    if (request.method === "GET" && route === "/") {
      respond(response, 200, getAsset("web/index.html"), contentTypes[".html"]);
      return;
    }
    if (request.method === "GET" && ["/app.js", "/styles.css"].includes(route)) {
      respond(response, 200, getAsset(`web${route}`), contentTypes[path.extname(route)]);
      return;
    }
    if (request.method === "GET" && route.startsWith("/examples/")) {
      const file = path.basename(route);
      const allowed = new Set(["budget.csv", "participants.csv", "evidence.csv", "transactions.csv"]);
      if (!allowed.has(file)) {
        respond(response, 404, "Not found");
        return;
      }
      respond(response, 200, getAsset(`examples/${file}`), contentTypes[".csv"]);
      return;
    }
    if (request.method === "GET" && route === "/licenses") {
      respond(response, 200, getAsset("THIRD_PARTY_LICENSES.txt"), "text/plain; charset=utf-8");
      return;
    }
    if (request.method === "POST" && route === "/validate") {
      try {
        const body = await readJsonBody(request);
        const data = prepareDataFromCsv(body.project ?? {}, body.files ?? {});
        respondJson(response, 200, { ok: true, result: validateData(data) });
      } catch (error) {
        respondJson(response, 400, { ok: false, error: error.message });
      }
      return;
    }
    if (request.method === "POST" && route === "/shutdown") {
      respondJson(response, 200, { ok: true });
      setTimeout(() => server.close(() => process.exit(0)), 100).unref();
      return;
    }
    respond(response, 404, "Not found");
  });

  server.on("error", (error) => {
    console.error(`검증기를 시작하지 못했습니다: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(0, HOST, () => {
    refreshIdleTimer(server);
    const port = server.address().port;
    const url = `http://${HOST}:${port}/${token}/`;
    console.log("연구비 프리플라이트가 로컬에서 실행 중입니다.");
    console.log(`브라우저가 열리지 않으면 다음 주소를 여세요: ${url}`);
    try {
      const shouldOpenBrowser = !process.argv.includes("--no-browser") && process.env.PREFLIGHT_NO_BROWSER !== "1";
      if (!shouldOpenBrowser) return;
      const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      child.unref();
    } catch (error) {
      console.error(`브라우저를 자동으로 열지 못했습니다: ${error.message}`);
    }
  });

  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (require.main === module || isSea) start();

module.exports = { start };
