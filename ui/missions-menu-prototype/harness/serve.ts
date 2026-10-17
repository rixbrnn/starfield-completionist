// PROTOTYPE (wayfinder ticket #5): serves build/missions-proto/harness/ for the Ruffle smoke test.
//   node ui/missions-menu-prototype/harness/serve.ts   ->   http://localhost:5174/

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../build/missions-proto/harness/", import.meta.url));
const port = Number(process.env.PORT ?? 5174);
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".swf": "application/x-shockwave-flash" };

createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  response.end(readFileSync(file));
}).listen(port, () => console.log(`Harness: http://localhost:${port}/`));
