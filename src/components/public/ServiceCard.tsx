import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import type { Service } from '@/lib/types';
import { money, duration } from '@/lib/format';
import { ServiceArt } from './ServiceArt';
export function ServiceCard({ service, index = 0, taxMode = 'inclusive', taxBps = 0 }: { service: Service; index?: number; taxMode?: 'inclusive' | 'exclusive'; taxBps?: number }) {
  const tier = service.tiers.find(t => t.enabled); const price = tier?.prices.standard.one_time;
  return <article className="service-card"><Link href={`/services/${service.slug}`} className="service-card-image"><ServiceArt type={service.image}/><span className="card-arrow"><ArrowUpRight size={20}/></span></Link><div className="service-card-body"><div className="service-card-meta"><span>0{index + 1} / {service.category.toUpperCase()}</span><span><Clock3 size={12}/>{tier ? duration(tier.minutes) : 'By consultation'}</span></div><Link href={`/services/${service.slug}`}><h3>{service.name}</h3></Link><p>{service.description}</p><div className="service-card-bottom"><span>{price ? <>From <strong>{money(taxMode==='exclusive'?price+Math.round(price*taxBps/10000):price)}</strong></> : 'Request a quote'}</span><Link href={`/services/${service.slug}`}>Explore treatment <ArrowUpRight size={14}/></Link></div></div></article>;
}
