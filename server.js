// Evil WebPair — pairs WhatsApp bots via the Pterodactyl panel API
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const PANEL = 'victorylordhimselfofficial.seyori.name.ng';
const KEY = process.env.PANEL_KEY || 'ptlc_sjuBFJAMRbkGKc06N1oke52pINoodeY4wkUlf6qbfiZ';
const SERVER = 'acafcfe3-9951-4d58-be8c-50a651aeac7b';
const PORT = process.env.PORT || 3001;

function panel(pathname) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(()=>reject(new Error('timeout')), 15000);
    https.request({ hostname: PANEL, path: pathname, method: 'GET',
      headers: { Authorization: 'Bearer ' + KEY, Accept: 'application/json' } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { clearTimeout(to); resolve({ status: res.statusCode, body: d }); }); })
      .on('error', e=>{clearTimeout(to);reject(e)}).end();
  });
}
function panelPost(pathname, body) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(()=>reject(new Error('timeout')), 15000);
    const data = JSON.stringify(body || {});
    https.request({ hostname: PANEL, path: pathname, method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { clearTimeout(to); resolve({ status: res.statusCode, body: d }); }); })
      .on('error', e=>{clearTimeout(to);reject(e)}).end(data);
  });
}
// tail of .syscache via signed download
async function logTail() {
  try {
    const r = JSON.parse((await panel(`/api/client/servers/${SERVER}/files/download?file=%2F.syscache`)).body);
    const url = r.attributes.url;
    return await new Promise((resolve, reject) => {
      https.get(url, res => {
        const total = Number(res.headers['content-length'] || 0);
        const from = Math.max(0, total - 20000);
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }).on('error', reject);
    });
  } catch { return ''; }
}
function latestCode(log) {
  const m = [...log.matchAll(/[A-Z0-9]{4}-[A-Z0-9]{4}/g)];
  return m.length ? m[m.length - 1][0] : null;
}
function latestStatus(log) {
  if (/Connected/i.test(log.slice(-3000))) return 'connected';
  if (/Pairing failed too many times/i.test(log.slice(-4000))) return 'failed';
  if (/logged out/i.test(log.slice(-4000))) return 'logged-out';
  return 'waiting';
}

const page = fs.readFileSync(new URL('./index.html', import.meta.url));

let CACHE={code:null,status:'waiting',at:0};
async function refresh(){try{const log=await logTail();CACHE={code:latestCode(log),status:latestStatus(log),at:Date.now()}}catch(e){}}
setInterval(refresh,5000);refresh();
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(CACHE));
  }
  if (req.url === '/api/pair' && req.method === 'POST') {
    let num = '';
    req.on('data', c => num += c);
    req.on('end', async () => {
      try {
        const { number } = JSON.parse(num || '{}');
        if (!/^[0-9]{7,15}$/.test(number || '')) { res.writeHead(400); return res.end('{"error":"bad number"}'); }
        // restart server to trigger fresh pairing for this number
        await panelPost(`/api/client/servers/${SERVER}/power`, { signal: 'restart' });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end('{"ok":true}');
      } catch (e) { res.writeHead(500); res.end('{"error":"failed"}'); }
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});
server.listen(PORT, () => console.log('webpair on :' + PORT));
