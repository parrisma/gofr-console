// Vite plugin to serve and save UI config and users
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

// SSOT: data/config/ui-config.json (tracked in git, volume-mounted at runtime)
const CONFIG_FILE = path.resolve(__dirname, '../data/config/ui-config.json');

const USERS_FILE = path.resolve(__dirname, '../data/config/users.json');

export function uiConfigPlugin(): Plugin {
  return {
    name: 'ui-config',
    configureServer(server) {
      // GET/PUT /api/users - Read/write users + tokens
      server.middlewares.use('/api/users', (req, res, next) => {
        if (req.method === 'GET') {
          try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const data = fs.readFileSync(USERS_FILE, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to read users' }));
          }
          return;
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: string) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              // eslint-disable-next-line security/detect-non-literal-fs-filename
              fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2) + '\n');
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
