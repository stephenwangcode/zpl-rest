const assert = require('assert');
const http = require('http');
const { createApp } = require('../server');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function get(port) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: '/' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  const upstream = await listen(http.createServer((request, response) => {
    const collections = {
      '/rest/printer': [{ _id: 'printer-1', name: 'ZT610' }],
      '/rest/label': [{ _id: 'label-1', name: 'Shipping Label' }]
    };
    const body = JSON.stringify(collections[request.url] || []);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(body);
  }));
  const upstreamPort = upstream.address().port;
  const portal = await listen(http.createServer(createApp({ apiUrl: `http://127.0.0.1:${upstreamPort}` })));

  try {
    const response = await get(portal.address().port);
    assert.strictEqual(response.status, 200);
    assert.match(response.body, /VIRA Label Printing/);
    assert.match(response.body, /ZT610/);
    assert.match(response.body, /Shipping Label/);
    assert.match(response.body, /name="partNo"/);
    assert.match(response.body, /name="copies"/);
  } finally {
    await close(portal);
    await close(upstream);
  }

  const unavailable = await listen(http.createServer(createApp({ apiUrl: 'http://127.0.0.1:1' })));
  try {
    const response = await get(unavailable.address().port);
    assert.strictEqual(response.status, 503);
    assert.match(response.body, /Unable to load printers and label templates/);
  } finally {
    await close(unavailable);
  }

  console.log('employee portal tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
