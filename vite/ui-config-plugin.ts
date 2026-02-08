// Vite plugin to serve and save UI config
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.resolve(__dirname, '../config/ui-config.json');

export function uiConfigPlugin(): Plugin {
  return {
    name: 'ui-config',
    configureServer(server) {
      // GET /api/config - Read config
      server.middlewares.use('/api/config', (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const config = fs.readFileSync(CONFIG_FILE, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(config);
          } catch (err) {
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
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
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
