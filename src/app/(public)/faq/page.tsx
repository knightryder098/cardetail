import { publicData } from '@/server/public-data';
export const metadata = { title: 'Questions & answers' };
export default async function FAQ() { const { catalogue: c } = await publicData(); return <main id="main" className="section-wrap"><div className="section-kicker">A LITTLE CLARITY</div><div className="page-heading"><h1>GOOD QUESTIONS.<br/>CLEAR ANSWERS.</h1><p>Everything you need to know<br/>before your next good drive.</p></div><div className="faq-list">{c.site.faq.map((f,i) => <details key={i}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</div></main>; }
