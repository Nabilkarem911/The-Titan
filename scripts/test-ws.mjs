import WebSocket from 'ws';

const ACCESS_TOKEN = process.argv[2];
if (!ACCESS_TOKEN) {
  console.error('Usage: node test-ws.mjs <accessToken>');
  process.exit(1);
}

const ws = new WebSocket('ws://127.0.0.1:3000/ws');
let id = 0;

ws.on('open', () => {
  console.log('WS open');
  id++;
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'auth', params: { token: ACCESS_TOKEN } }));
});

ws.on('message', (raw) => {
  const text = raw.toString();
  console.log('RX:', text);
  try {
    const msg = JSON.parse(text);
    if (msg.id === 1) {
      id++; ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'ping' }));
    } else if (msg.id === 2) {
      id++; ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'queue.stats' }));
    } else if (msg.id === 3) {
      id++; ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'queue.stats', params: { queue: 'agent-execute' } }));
    } else if (msg.id === 4) {
      id++; ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'unknown.method' }));
    } else if (msg.id === 5) {
      setTimeout(() => { ws.close(); process.exit(0); }, 200);
    }
  } catch (e) { console.error('parse err', e); }
});

ws.on('close', () => { console.log('WS closed'); });
ws.on('error', (e) => { console.error('WS err', e.message); process.exit(1); });

setTimeout(() => { console.error('timeout'); process.exit(1); }, 8000);
