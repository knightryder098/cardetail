import { expect, it } from 'vitest';
import { assertEnvironment } from '@/server/auth';
it('accepts an explicitly approved workers.dev origin during a domain transition',()=>{
 process.env.APP_MODE='live';process.env.APP_ORIGIN='https://studio.example';process.env.APP_ALLOWED_ORIGINS='https://balaji-studio.account.workers.dev';
 const r=new Request('https://balaji-studio.account.workers.dev/api/v1/quotes',{method:'POST',headers:{origin:'https://balaji-studio.account.workers.dev'}});
 expect(()=>assertEnvironment(r)).not.toThrow();delete process.env.APP_ALLOWED_ORIGINS;
});
it('rejects cross-host mutations even when both origins are approved',()=>{
 process.env.APP_MODE='live';process.env.APP_ORIGIN='https://studio.example';process.env.APP_ALLOWED_ORIGINS='https://balaji-studio.account.workers.dev';
 const r=new Request('https://studio.example/api/v1/quotes',{method:'POST',headers:{origin:'https://balaji-studio.account.workers.dev'}});
 expect(()=>assertEnvironment(r)).toThrow();delete process.env.APP_ALLOWED_ORIGINS;
});
it('rejects arbitrary workers.dev hosts',()=>{
 process.env.APP_MODE='live';process.env.APP_ORIGIN='https://studio.example';process.env.APP_ALLOWED_ORIGINS='https://balaji-studio.account.workers.dev';
 expect(()=>assertEnvironment(new Request('https://attacker.workers.dev/api/v1/session'))).toThrow();delete process.env.APP_ALLOWED_ORIGINS;
});
it('accepts the loopback Host origin when Next reconstructs an internal localhost URL',()=>{process.env.APP_MODE='demo'; const r=new Request('http://localhost:3001/api/v1/quotes',{method:'POST',headers:{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001'}});expect(()=>assertEnvironment(r)).not.toThrow();});
it('rejects a non-loopback Host even when the reconstructed URL is localhost',()=>{process.env.APP_MODE='demo';const r=new Request('http://localhost:3001/api/v1/quotes',{method:'POST',headers:{host:'evil.example',origin:'http://evil.example'}});expect(()=>assertEnvironment(r)).toThrow();});
it('allows a trusted expiry job without browser Origin but rejects an invalid job secret',()=>{process.env.APP_MODE='demo';process.env.CRON_SECRET='test-secret';const good=new Request('http://localhost:3001/api/v1/system/expire',{method:'POST',headers:{authorization:'Bearer test-secret'}});const bad=new Request(good.url,{method:'POST',headers:{authorization:'Bearer wrong'}});expect(()=>assertEnvironment(good)).not.toThrow();expect(()=>assertEnvironment(bad)).toThrow();});
