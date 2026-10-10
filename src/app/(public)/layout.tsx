import { publicData } from '@/server/public-data';
import { PublicHeader, PublicFooter } from '@/components/public/Shell';
export const dynamic = 'force-dynamic';
export default async function PublicLayout({ children }: { children: React.ReactNode }) { const data = await publicData(); return <div className={`public-surface palette-${data.catalogue.site.accent}`}><PublicHeader demo={data.demo} site={data.catalogue.site}/>{children}<PublicFooter site={data.catalogue.site} demo={data.demo}/></div>; }
