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

function request(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: payload ? { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : headers
    }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody, headers: response.headers }));
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
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
    const firstPage = await request(portal.address().port, 'GET', '/');
    assert.strictEqual(firstPage.status, 200);
    assert.match(firstPage.body, /VIRA Label Printing/);
    assert.match(firstPage.body, /ZT610/);
    assert.match(firstPage.body, /Shipping Label/);
    assert.match(firstPage.body, /name="partNo"/);
    assert.match(firstPage.body, /name="copies"/);

    const preference = await request(portal.address().port, 'POST', '/preferences/printer', { printer: 'printer-1' });
    assert.strictEqual(preference.status, 204);
    assert.match(preference.headers['set-cookie'][0], /^employee_printer=printer-1;/);

    const selectedPage = await request(portal.address().port, 'GET', '/', null, { Cookie: preference.headers['set-cookie'][0] });
    assert.match(selectedPage.body, /<option value="printer-1" selected>ZT610<\/option>/);

    const invalidPreference = await request(portal.address().port, 'POST', '/preferences/printer', { printer: 'unknown' });
    assert.strictEqual(invalidPreference.status, 400);
  } finally {
    await close(portal);
    await close(upstream);
  }

  const unavailable = await listen(http.createServer(createApp({ apiUrl: 'http://127.0.0.1:1' })));
  try {
    const response = await request(unavailable.address().port, 'GET', '/');
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
