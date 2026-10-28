import { readBody, sendJson } from './regionDevServer.js';
import { saveLocationPosition } from './locationFile.js';

async function handle(req, res, next) {
  const match = req.method === 'PUT' && /^\/([^/]+)$/.exec(new URL(req.url, 'http://localhost').pathname);
  if (!match) return next();
  try {
    const { x, y } = await readBody(req);
    saveLocationPosition(decodeURIComponent(match[1]), x, y);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

export default function locationEditor() {
  return {
    name: 'location-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__locations', handle);
    },
  };
}
