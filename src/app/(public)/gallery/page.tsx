import { ServiceArt } from '@/components/public/ServiceArt';
import type { Service } from '@/lib/types';
export const metadata = { title: 'Gallery' };
export default function Gallery() { return <main id="main" className="section-wrap"><div className="section-kicker">THE STUDIO JOURNAL</div><div className="page-heading"><h1>THE BEAUTY<br/>IS IN THE DETAILS.</h1><p>Original concept illustrations.<br/>The studio’s approved photographs belong here.</p></div><div className="gallery-grid">{(['paint', 'wheel', 'ceramic', 'interior', 'wash', 'ppf'] as Service['image'][]).map((type, i) => <figure key={type}><ServiceArt type={type}/><figcaption>0{i+1} / {type.toUpperCase()} — Original studio concept artwork</figcaption></figure>)}</div></main>; }
