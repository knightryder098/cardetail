'use client';
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Service } from '@/lib/types';
import { ServiceCard } from './ServiceCard';
export function Catalogue({ services,taxMode,taxBps }: { services: Service[];taxMode:'inclusive'|'exclusive';taxBps:number }) {
  const [filter, setFilter] = useState('all'); const [search, setSearch] = useState(''); const filtered = services.filter(s => (filter === 'all' || s.category === filter) && `${s.name} ${s.description}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="catalogue-toolbar"><div className="filter-tabs" aria-label="Filter treatments">{[['all', 'All treatments'], ['cleaning', 'Cleaning'], ['protection', 'Protection'], ['correction', 'Correction']].map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={filter === id ? 'active' : ''} aria-pressed={filter === id}>{label}</button>)}</div><label className="search-field"><Search size={17}/><input aria-label="Search treatments" placeholder="Find your treatment" value={search} onChange={e => setSearch(e.target.value)}/></label></div><div className="results-line"><span>{filtered.length} treatments, thoughtfully selected</span><SlidersHorizontal size={15}/></div><div className="service-grid">{filtered.map((s, i) => <ServiceCard key={s.id} service={s} index={i} taxMode={taxMode} taxBps={taxBps}/>)}</div>{!filtered.length && <div className="empty-state"><h3>No treatments found.</h3><p>Try another search or contact the studio for a consultation.</p></div>}</>;
}
