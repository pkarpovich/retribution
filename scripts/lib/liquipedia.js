import https from 'https';
import zlib from 'zlib';

const API = 'https://liquipedia.net/mobilelegends/api.php';
const USER_AGENT = process.env.LIQUIPEDIA_USER_AGENT
  || 'retribution/0.1 (https://github.com/pkarpovich/retribution)';

const BATCH_SIZE = 50;
const QUERY_DELAY_MS = 30000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
      },
    }, res => {
      const chunks = [];
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`bad JSON: ${body.slice(0, 200)}`));
        }
      });
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}

async function fetchBatch(titles) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: titles.join('|'),
    format: 'json',
    formatversion: '2',
    redirects: '1',
  });

  const data = await request(`${API}?${params}`);
  const query = data.query || {};
  const pages = new Map();

  for (const page of query.pages || []) {
    pages.set(page.title, page.missing ? null : page.revisions?.[0]?.slots?.main?.content ?? null);
  }

  for (const { from, to } of [...(query.normalized || []), ...(query.redirects || [])]) {
    if (pages.has(to)) pages.set(from, pages.get(to));
  }

  return pages;
}

export async function fetchPages(titles, onProgress) {
  const result = new Map();

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    const pages = await fetchBatch(batch);
    for (const title of batch) result.set(title, pages.get(title) ?? null);
    onProgress?.(Math.min(i + BATCH_SIZE, titles.length), titles.length);
    if (i + BATCH_SIZE < titles.length) await wait(QUERY_DELAY_MS);
  }

  return result;
}
