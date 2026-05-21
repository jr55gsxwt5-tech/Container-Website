import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = import.meta.dirname;
const port = Number(process.env.PORT) || 5500;
const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".bin": "application/octet-stream",
};

http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
        const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
        const file = normalize(join(root, requested));

        if (!file.startsWith(normalize(root))) {
            response.writeHead(403);
            response.end("Forbidden");
            return;
        }

        const data = await readFile(file);
        response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
        response.end(data);
    } catch {
        response.writeHead(404);
        response.end("Not found");
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`ContainerRent Website: http://127.0.0.1:${port}`);
});
