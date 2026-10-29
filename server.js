import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/env.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__ACHIEVERS_ENV__=${JSON.stringify({
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  })};`);
});

const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  for (const file of fs.readdirSync(apiDir)) {
    if (!file.endsWith('.js')) continue;
    const name = file.replace(/\.js$/, '');
    try {
      const mod = await import(`./api/${file}`);
      if (mod.default) {
        app.use(`/api/${name}`, mod.default);
      }
    } catch (e) { console.error(`[api] failed to load ${file}`, e); }
  }
}

app.get('/', (req, res) => res.redirect('/login'));

// Notice 'admin' is gone. It is now 'manage'
const pages = ['login', 'signup', 'browse', 'my-courses', 'manage'];
for (const page of pages) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, 'public', `${page}.html`)));
}

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.listen(PORT, () => console.log(`achievers tutorials → http://localhost:${PORT}`));