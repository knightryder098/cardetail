import { publicData } from '@/server/public-data';
import { Catalogue } from '@/components/public/Catalogue';
export const metadata = { title: 'Treatments' };
export default async function Services() { const { catalogue: c } = await publicData(); return <main id="main" className="section-wrap catalogue-page"><div className="section-kicker">THE TREATMENT MENU / 01 — 06</div><div className="page-heading"><h1>GOOD CARE.<br/>GREAT FEELING.</h1><p>For the everyday journeys and the special ones.<br/>Find the right care for your drive.</p></div><Catalogue services={c.services} taxMode={c.taxMode} taxBps={c.taxBps}/></main>; }
