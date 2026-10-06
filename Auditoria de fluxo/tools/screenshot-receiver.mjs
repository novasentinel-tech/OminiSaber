import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../evidencias");
fs.mkdirSync(root, { recursive: true });

const server = http.createServer((request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405).end("method not allowed");
    return;
  }
  const name = decodeURIComponent(request.url.slice(1));
  if (!/^[a-zA-Z0-9._-]+\.png$/.test(name)) {
    response.writeHead(400).end("invalid name");
    return;
  }
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    fs.writeFileSync(path.join(root, name), Buffer.concat(chunks));
    response.writeHead(201).end("saved");
  });
});

server.listen(4189, "127.0.0.1", () => console.log("screenshot receiver ready"));
