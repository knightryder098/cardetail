'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react';
import type { Site } from '@/lib/types';
import { CarSvg } from './CarSvg';
export function HomeScene({ site }: { site: Site }) {
  const ref = useRef<HTMLElement>(null); const [intro, setIntro] = useState(false); const [paused, setPaused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { if (site.intro && !sessionStorage.getItem('crystal-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches) { setIntro(true); sessionStorage.setItem('crystal-intro', 'seen'); timer = setTimeout(() => setIntro(false), 1150); } } catch { /* Content remains visible if session storage is unavailable. */ }
    const observer = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting || document.hidden), { threshold: .1 }); if (ref.current) observer.observe(ref.current);
    const visibility = () => setPaused(document.hidden); document.addEventListener('visibilitychange', visibility);
    return () => { if (timer) clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [site.intro]);
  return <section ref={ref} className={`hero-scene ${site.theme === 'frost-day' ? 'hero-frost' : ''}`}>
    {intro && <div className="intro-overlay"><span className="intro-brand">{site.name}<span>{site.tagline}</span></span><div className="intro-road"/><button onClick={() => setIntro(false)} className="intro-skip">Skip intro <ArrowUpRight size={14}/></button></div>}
    <div className="crystal-facet facet-one"/><div className="crystal-facet facet-two"/><div className="crystal-facet facet-three"/><div className="hero-grain"/>
    <div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> DETAILING · PROTECTION · RESTORATION</div><h1>{site.heroTitle.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h1><p>{site.heroSubtitle.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p><Link href="/services" className="hero-text-link">Explore services <ArrowUpRight size={18}/></Link></div>
    <div className="hero-shop"><span className="orbit-caption">GOOD CARE STARTS HERE</span><Link href="/services" className="shop-circle" aria-label="Enter shop and browse detailing services"><ArrowUpRight size={34}/><span>SHOP</span><small>FOR YOUR DRIVE</small></Link><span className="shop-number">01 — ENTER THE STUDIO</span></div>
    <div className="car-lane" aria-hidden="true"><div className={`driving-car ${site.motion === 'off' ? 'car-static' : ''}`} style={{ animationPlayState: paused ? 'paused' : 'running', animationDuration: site.motion === 'calm' ? '24s' : '16s' }}><CarSvg/></div><div className="road-line"/><span className="track-caption">CRAFTED FOR THE CAR YOU LOVE</span></div>
    <div className="hero-bottom"><span><Plus size={14}/> {site.tagline}</span><a href="#care" className="scroll-link">SCROLL TO DISCOVER <ArrowDown size={16}/></a><span className="hero-coordinate">ASIA / KOLKATA <span>{site.name}</span></span></div>
  </section>;
}
