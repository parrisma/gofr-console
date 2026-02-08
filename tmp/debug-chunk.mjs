import http from 'http';

function mcpPost(body, sessionId) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const req = http.request({ hostname: 'gofr-dig-mcp', port: 8070, path: '/mcp', method: 'POST', headers }, res => {
      const sid = res.headers['mcp-session-id'];
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ sid, raw: data, status: res.statusCode }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

async function main() {
  // Init
  const init = await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'debug', version: '0.0.1' } } });
  console.log('Init status:', init.status, 'sid:', init.sid);

  let sid = init.sid;
  if (!sid) {
    for (const l of init.raw.split('\n')) {
      if (l.startsWith('data:')) {
        try { const j = JSON.parse(l.slice(5).trim()); console.log('Init keys:', Object.keys(j)); } catch {}
      }
    }
    console.log('Init raw (first 300):', init.raw.substring(0, 300));
    console.log('No session ID in header, trying without...');
  }

  // List sessions
  const list = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'list_sessions', arguments: {} } }, sid);
  sid = list.sid || sid;
  console.log('\nList status:', list.status, 'sid:', list.sid);

  let sessions = [];
  for (const line of list.raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      const j = JSON.parse(line.slice(5).trim());
      const text = j?.result?.content?.[0]?.text;
      if (!text) continue;
      let parsed = text;
      for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
        try { parsed = JSON.parse(parsed); } catch { break; }
      }
      if (parsed?.sessions) sessions = parsed.sessions;
    } catch {}
  }

  console.log('Found', sessions.length, 'sessions');
  if (sessions.length === 0) { console.log('No sessions — cannot test chunk.'); return; }

  const s = sessions[0];
  console.log('Using session:', s.session_id, 'chunks:', s.total_chunks);

  // Get chunk 0
  const chunk = await mcpPost({ jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'get_session_chunk', arguments: { session_id: s.session_id, chunk_index: 0 } } }, sid);
  console.log('\nChunk status:', chunk.status);
  console.log('\n=== CHUNK RAW (first 1500) ===');
  console.log(chunk.raw.substring(0, 1500));

  // Deep parse
  for (const cl of chunk.raw.split('\n')) {
    if (!cl.startsWith('data:')) continue;
    try {
      const cj = JSON.parse(cl.slice(5).trim());
      const rawText = cj?.result?.content?.[0]?.text;
      if (!rawText) { console.log('No text in content[0]'); continue; }
      console.log('\n=== rawText type:', typeof rawText, 'length:', rawText.length);
      console.log('=== rawText first 400:', rawText.substring(0, 400));

      // Simulate what parseToolText does
      let parsed = JSON.parse(rawText);
      console.log('\nAfter 1st JSON.parse — type:', typeof parsed);
      if (typeof parsed === 'string') {
        console.log('  Is string, len:', parsed.length, 'first 200:', parsed.substring(0, 200));
        try {
          parsed = JSON.parse(parsed);
          console.log('After 2nd JSON.parse — type:', typeof parsed);
        } catch (e) { console.log('  2nd parse failed:', e.message.substring(0, 100)); }
      }

      // parseToolText returns parsed.data || parsed
      const result = parsed.data || parsed;
      console.log('\nparseToolText result type:', typeof result);
      if (typeof result === 'object' && result !== null) {
        console.log('  keys:', Object.keys(result));
        for (const k of Object.keys(result)) {
          const v = result[k];
          console.log(`  ${k}: type=${typeof v}`, typeof v === 'string' ? `len=${v.length} first50="${v.substring(0, 50)}"` : v);
        }
      } else {
        console.log('  value (first 200):', String(result).substring(0, 200));
      }

      // Now simulate what the UI chunkData does with 'result' (which is sessionChunk)
      console.log('\n--- Simulating UI chunkData logic ---');
      let data = result;
      for (let i = 0; i < 3 && typeof data === 'string'; i++) {
        console.log(`  Unwrap layer ${i}: string len=${data.length}`);
        try { data = JSON.parse(data); } catch { console.log('  Parse failed'); break; }
      }
      if (typeof data === 'object' && data !== null) {
        console.log('  chunkData: object with keys:', Object.keys(data));
        const json = JSON.stringify(data, null, 2);
        console.log('  chunkJson length:', json.length, 'first 300:', json.substring(0, 300));
      } else {
        console.log('  chunkData: null (not an object, type:', typeof data, ')');
      }
    } catch (e) { console.log('Parse err:', e.message); }
  }
}

main().catch(console.error);
