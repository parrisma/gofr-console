// Vite plugin to serve and save UI config
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

// Primary: data/config (runtime location, matches prod volume mount)
// Fallback: config/ (repo default if data/ doesn't exist yet)
const DATA_CONFIG = path.resolve(__dirname, '../data/config/ui-config.json');
const REPO_CONFIG = path.resolve(__dirname, '../config/ui-config.json');
const CONFIG_FILE = fs.existsSync(DATA_CONFIG) ? DATA_CONFIG : REPO_CONFIG;

export function uiConfigPlugin(): Plugin {
  return {
    name: 'ui-config',
    configureServer(server) {
      // GET /api/config - Read config
      server.middlewares.use('/api/config', (req, res, next) => {
        if (req.method === 'GET') {
          try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const config = fs.readFileSync(CONFIG_FILE, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(config);
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to read config' }));
          }
          return;
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              // Validate JSON
              const config = JSON.parse(body);
              // Write to file with pretty formatting
              // eslint-disable-next-line security/detect-non-literal-fs-filename
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
