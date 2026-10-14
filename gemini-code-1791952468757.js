// proxy.mjs — run with: node proxy.mjs
import http from 'node:http';

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-URL');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const target = req.headers['x-target-url'];
  if (!target) { res.writeHead(400); return res.end('Missing X-Target-URL header'); }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Authorization': req.headers['authorization'] || ''
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
  });

  res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}).listen(8787, () => console.log('Proxy listening on http://localhost:8787'));