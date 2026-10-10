import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getWorkerDatabase(): { connectionString: string } | null {
  let env: CloudflareEnv;
  try { env = getCloudflareContext().env; }
  catch { return null; }
  if (!env.HYPERDRIVE?.connectionString) throw new Error('CLOUDFLARE_HYPERDRIVE_NOT_CONFIGURED');
  return { connectionString: env.HYPERDRIVE.connectionString };
}
