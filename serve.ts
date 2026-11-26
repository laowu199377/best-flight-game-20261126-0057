// A tiny static server for playing the game locally: `bun serve.ts` or
// `deno run --allow-read --allow-net serve.ts`, then open
// http://localhost:8080/ in a desktop browser. No build step, no network.
const dir = new URL('./game/', import.meta.url).pathname;
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  const file = await Bun.file(dir + path.slice(1)).arrayBuffer().catch(() => null);
  if (file === null) return new Response('not found', { status: 404 });
  const ext = path.slice(path.lastIndexOf('.'));
  return new Response(file, { headers: { 'content-type': types[ext] || 'application/octet-stream' } });
}

Bun.serve({ port: 8080, fetch: handle });
console.log('Golden Hour at http://localhost:8080/');
