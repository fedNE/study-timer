const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const root = path.resolve(__dirname, "..", "app");
const port = Number(process.env.PORT || 1420);
const host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

http
  .createServer(async (req, res) => {
    let pathname;

    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    } catch {
      send(res, 400, "Bad request");
      return;
    }

    const requested = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.resolve(root, `.${requested}`);

    if (!filePath.startsWith(`${root}${path.sep}`)) {
      send(res, 403, "Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      send(res, 200, body, types[path.extname(filePath)] || "application/octet-stream");
    } catch {
      send(res, 404, "Not found");
    }
  })
  .listen(port, host, () => {
    console.log(`Serving app/ at http://${host}:${port}`);
  });
