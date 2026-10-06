import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("tmp", "onboarding-qa");
await mkdir(outputDir, { recursive: true });

http
  .createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    const safeName = path.basename(decodeURIComponent(request.url.slice(1)));
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      await writeFile(path.join(outputDir, safeName), Buffer.concat(chunks));
      response.writeHead(204).end();
    });
  })
  .listen(4189, "127.0.0.1");
