const http = require('http');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Mustache = require('mustache');

function upstream(apiUrl, endpoint, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
    const body = data === undefined ? null : JSON.stringify(data);
    const request = (url.protocol === 'https:' ? https : http).request(url, { method, headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {} }, (response) => {
      let responseBody = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`upstream returned ${response.statusCode}`));
        try { resolve(JSON.parse(responseBody)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(5000, () => request.destroy(new Error('upstream request timed out')));
    request.on('error', reject); if (body) request.write(body); request.end();
  });
}
function fetchCollection(apiUrl, endpoint) { return upstream(apiUrl, endpoint).then((value) => { if (!Array.isArray(value)) throw new Error('upstream did not return an array'); return value; }); }
function getCookie(request, name) { const value = (request.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`)); try { return value ? decodeURIComponent(value.slice(name.length + 1)) : null; } catch (error) { return null; } }
function browserId(request, response) { const id = getCookie(request, 'employee_browser_id') || crypto.randomUUID(); if (!getCookie(request, 'employee_browser_id')) response.cookie('employee_browser_id', id, { maxAge: 31536000000, httpOnly: true, sameSite: 'lax', path: '/' }); return id; }
function fields(zpl) { const result = new Set(); const regex = /\$\{([^}]+)\}|{{\s*([a-zA-Z0-9_.-]+)\s*}}/g; let match; while ((match = regex.exec(zpl))) { const key = (match[1] || match[2]).trim(); if (/^[a-zA-Z0-9_.-]+$/.test(key)) result.add(key); } return [...result]; }
function dataFor(label, submitted) { const allowed = new Set(fields(label.zpl)); const data = {}; for (const [key, value] of Object.entries(submitted || {})) { if (!allowed.has(key) || typeof value !== 'string' || value.length > 500) throw new Error('Invalid label data.'); data[key] = value; } return data; }
function renderZpl(zpl, data) { for (const [key, value] of Object.entries(data)) zpl = zpl.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), value); return Mustache.render(zpl, data); }

function createApp({ apiUrl = process.env.ZPL_API_URL || 'http://10.1.1.246:8110' } = {}) {
  const app = express(); app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, 'views')); app.use(express.json()); app.use(express.static(path.join(__dirname, 'public')));
  async function catalog() { const [printers, labels] = await Promise.all([fetchCollection(apiUrl, '/rest/printer'), fetchCollection(apiUrl, '/rest/label')]); return { printers, labels }; }
  async function selected(body) { const { printers, labels } = await catalog(); const printer = printers.find((item) => item._id === body.printer); const label = labels.find((item) => item._id === body.label); if (!printer || !label) throw new Error('Selected printer or label is not available.'); return { label, data: dataFor(label, body.data) }; }
  app.get('/', async (request, response) => { try { const { printers, labels } = await catalog(); const savedPrinter = getCookie(request, 'employee_printer'); const savedLabel = getCookie(request, 'employee_label'); browserId(request, response); response.render('index', { printers, labels, selectedPrinterId: printers.some((item) => item._id === savedPrinter) ? savedPrinter : null, selectedLabelId: labels.some((item) => item._id === savedLabel) ? savedLabel : null, errorMessage: null }); } catch (error) { console.error(error.message); response.status(503).render('index', { printers: [], labels: [], selectedPrinterId: null, selectedLabelId: null, errorMessage: 'Unable to load printers and label templates. Please try again later.' }); } });
  app.post('/preferences/printer', async (request, response) => { try { const printers = await fetchCollection(apiUrl, '/rest/printer'); if (typeof request.body.printer !== 'string' || !printers.some((item) => item._id === request.body.printer)) return response.status(400).json({ error: 'The selected printer is not available.' }); response.cookie('employee_printer', request.body.printer, { maxAge: 31536000000, httpOnly: true, sameSite: 'lax', path: '/' }).status(204).end(); } catch (error) { response.status(503).json({ error: 'Unable to save printer preference.' }); } });
  app.post('/preferences/label', async (request, response) => { try { const labels = await fetchCollection(apiUrl, '/rest/label'); if (typeof request.body.label !== 'string' || !labels.some((item) => item._id === request.body.label)) return response.status(400).json({ error: 'The selected label is not available.' }); response.cookie('employee_label', request.body.label, { maxAge: 31536000000, httpOnly: true, sameSite: 'lax', path: '/' }).status(204).end(); } catch (error) { response.status(503).json({ error: 'Unable to save label preference.' }); } });
  app.get('/form-fields/:labelId', async (request, response) => { try { const labels = await fetchCollection(apiUrl, '/rest/label'); const label = labels.find((item) => item._id === request.params.labelId); if (!label) return response.status(404).json({ error: 'Label not found.' }); response.json({ fields: fields(label.zpl) }); } catch (error) { response.status(503).json({ error: 'Unable to load label fields.' }); } });
  app.post('/preview', async (request, response) => { try { const { label, data } = await selected(request.body); const preview = await upstream(apiUrl, '/rest/preview', 'POST', { printer: request.body.printer, label: request.body.label, zpl: renderZpl(label.zpl, data) }); response.json({ img: preview.img }); } catch (error) { response.status(400).json({ error: error.message }); } });
  app.post('/print', async (request, response) => { try { const { data } = await selected(request.body); const copies = Number(request.body.copies); if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new Error('Copies must be between 1 and 100.'); const identity = browserId(request, response); const jobs = []; for (let i = 0; i < copies; i++) jobs.push(await upstream(apiUrl, '/rest/print', 'POST', { printer: request.body.printer, label: request.body.label, data: { ...data, _employeeBrowserId: identity } })); response.json({ jobs }); } catch (error) { response.status(400).json({ error: error.message }); } });
  app.get('/history', async (request, response) => { try { const identity = browserId(request, response); const jobs = await fetchCollection(apiUrl, '/rest/jobs'); response.json(jobs.filter((job) => job.data && job.data._employeeBrowserId === identity).map((job) => ({ _id: job._id, date: job.date, printer_id: job.printer_id, printer_name: job.printer_name, label_id: job.label_id, label_name: job.label_name, failed: job.failed, error: job.error, data: Object.fromEntries(Object.entries(job.data).filter(([key]) => key !== '_employeeBrowserId')) }))); } catch (error) { response.status(503).json({ error: 'Unable to load print history.' }); } });
  return app;
}
if (require.main === module) createApp().listen(Number(process.env.PORT) || 8100, () => console.log(`Employee portal is listening on port ${Number(process.env.PORT) || 8100}`));
module.exports = { createApp, fetchCollection, fields };
