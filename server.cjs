const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 8000);
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/FONT-LICENSE.txt': ['FONT-LICENSE.txt', 'text/plain; charset=utf-8'] };
http.createServer((req, res) => {
  const entry = files[new URL(req.url, 'http://localhost').pathname];
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, entry[0]), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to read page'); return; }
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(port, '0.0.0.0', () => console.log(`Birthday server listening on port ${port}`));
