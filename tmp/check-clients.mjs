import fs from 'fs/promises';

const configPath = new URL('../config/ui-config.json', import.meta.url);
const configRaw = await fs.readFile(configPath, 'utf-8');
const config = JSON.parse(configRaw);

const token = config?.tokens?.[0]?.token;
if (!token) {
  console.error('No token found in config');
  process.exit(1);
}

const baseUrl = 'http://gofr-iq-mcp:8080/mcp';

const initReq = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'gofr-console-check', version: '0.0.1' },
  },
};

const initRes = await fetch(baseUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify(initReq),
});

const sessionId = initRes.headers.get('mcp-session-id');
if (!sessionId) {
  console.error('No mcp-session-id returned');
  process.exit(1);
}

const listReq = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'list_clients',
    arguments: {
      auth_tokens: [token],
    },
  },
};

const listRes = await fetch(baseUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Mcp-Session-Id': sessionId,
  },
  body: JSON.stringify(listReq),
});

const text = await listRes.text();
const line = text.split('\n').find((l) => l.startsWith('data: '));
if (!line) {
  console.error('No data in response');
  process.exit(1);
}

const payload = JSON.parse(line.slice(6));
const contentText = payload?.result?.content?.find((c) => c.type === 'text')?.text;
if (!contentText) {
  console.error('No text content in response');
  process.exit(1);
}

const parsed = JSON.parse(contentText);
const data = parsed?.data || parsed;
const clients = Array.isArray(data?.clients) ? data.clients : [];

console.log(`clients_count=${clients.length}`);
