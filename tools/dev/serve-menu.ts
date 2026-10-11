// Serves the built menu view (after `npm run build:mod`) for previewing in a browser.
// Outside the game there is no OSF UI bridge, so the page shows sample progress.
//
//   npm run preview:menu   ->   http://localhost:5173/

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../build/mod/SFSE/Plugins/OSF/UI/views/completionist/menu/", import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

if (!existsSync(root)) {
  console.error("Menu not built yet. Run: npm run build:mod");
  process.exit(1);
}

createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
}).listen(port, () => console.log(`Menu preview: http://localhost:${port}/`));
