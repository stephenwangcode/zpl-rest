const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');

function fetchCollection(apiUrl, endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`upstream returned ${response.statusCode}`));
          return;
        }
        try {
          const collection = JSON.parse(body);
          if (!Array.isArray(collection)) throw new Error('upstream did not return an array');
          resolve(collection);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(5000, () => request.destroy(new Error('upstream request timed out')));
    request.on('error', reject);
  });
}

function createApp({ apiUrl = process.env.ZPL_API_URL || 'http://10.1.1.246:8110' } = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/', async (request, response) => {
    try {
      const [printers, labels] = await Promise.all([
        fetchCollection(apiUrl, '/rest/printer'),
        fetchCollection(apiUrl, '/rest/label')
      ]);
      response.render('index', { printers, labels, errorMessage: null });
    } catch (error) {
      console.error(`Unable to load employee portal data: ${error.message}`);
      response.status(503).render('index', { printers: [], labels: [], errorMessage: 'Unable to load printers and label templates. Please try again later.' });
    }
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8100;
  createApp().listen(port, () => console.log(`Employee portal is listening on port ${port}`));
}

module.exports = { createApp, fetchCollection };
