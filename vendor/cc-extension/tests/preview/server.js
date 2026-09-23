// Serves the repo so tests/preview/reviews.html can load the real modules and
// the popup stylesheet - a static render of the Pending Reviews queue with
// sample data, for checking layout without reloading the extension.
//   node tests/preview/server.js   ->  http://localhost:8765/tests/preview/reviews.html
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
http.createServer((request, response) => {
  const file = path.join(ROOT, decodeURIComponent(request.url.split("?")[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404); response.end("not found"); return;
  }
  response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
}).listen(8765, () => console.log("preview at http://localhost:8765/tests/preview/reviews.html"));
