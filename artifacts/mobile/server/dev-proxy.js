/**
 * Development reverse proxy for Expo web + API server.
 *
 * Routes:
 *   /api/*  → http://localhost:8000  (Express API server)
 *   /*      → http://localhost:METRO_PORT  (Expo Metro bundler)
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const http = require("http");

const PROXY_PORT = parseInt(process.env.PORT || "5000");
const METRO_PORT = parseInt(process.env.METRO_PORT || "5001");
const API_PORT = 8000;

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`Upstream error (port ${targetPort}): ${err.message}`);
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/") || req.url === "/api") {
    proxyRequest(req, res, API_PORT);
  } else {
    proxyRequest(req, res, METRO_PORT);
  }
});

server.on("upgrade", (req, socket, head) => {
  const targetPort = req.url.startsWith("/api") ? API_PORT : METRO_PORT;
  const proxySocket = require("net").connect(targetPort, "127.0.0.1", () => {
    proxySocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    proxySocket.write(head);
    socket.pipe(proxySocket);
    proxySocket.pipe(socket);
  });
  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[dev-proxy] Listening on port ${PROXY_PORT}`);
  console.log(`[dev-proxy]   /api/* → localhost:${API_PORT}`);
  console.log(`[dev-proxy]   /*     → localhost:${METRO_PORT}`);
});
