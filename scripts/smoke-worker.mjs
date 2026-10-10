import { spawn } from 'node:child_process';
import net from 'node:net';

const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn('./node_modules/.bin/wrangler', ['dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--var', `APP_ORIGIN:${origin}`, '--log-level', 'error'], {
 detached: true, env: process.env, stdio: ['ignore', 'ignore', 'ignore'],
});
let spawnError;
child.on('error', error => { spawnError = error; });
try {
 let ready = false;
 for (let attempt = 0; attempt < 100; attempt++) {
  if (spawnError) throw spawnError;
  try {
   const response = await fetch(`${origin}/api/v1/session`, { signal: AbortSignal.timeout(1000) });
   if (response.status !== 200) throw new Error(`Compiled Worker returned HTTP ${response.status}.`);
   const data = await response.json();
   if (data.demo !== false || data.actor !== null) throw new Error('Compiled Worker has an unexpected runtime mode.');
   ready = true;
   break;
  } catch (error) {
   if (error.message.startsWith('Compiled Worker')) throw error;
   await new Promise(resolve => setTimeout(resolve, 250));
  }
 }
 if (!ready) throw new Error('Compiled Worker did not start within the smoke-test timeout.');
 const rejected = await fetch(`${origin}/api/v1/auth/demo-owner`, { method: 'POST', headers: { origin: 'https://unapproved.example' } });
 if (rejected.status !== 403 || (await rejected.json()).error?.code !== 'INVALID_ORIGIN') throw new Error('Compiled Worker did not reject a cross-origin mutation.');
 console.log('Compiled Worker starts in live mode and rejects cross-origin mutations.');
} finally {
 try { process.kill(-child.pid, 'SIGTERM'); } catch {}
}
