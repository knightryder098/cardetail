'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Menu, X, UserRound } from 'lucide-react';
import { Brand, Button } from '@/components/ui';
import type { Site } from '@/lib/types';
import { useSession } from '@/lib/use-session';
export function PublicHeader({ demo, site }: { demo: boolean;site:Site }) {
  const path = usePathname(); const [open, setOpen] = useState(false); const home = path === '/';
  const { actor } = useSession();
  return <><a className="skip-link" href="#main">Skip to content</a><header className={`public-header ${home ? 'header-dark' : ''}`}><Brand name={site.name}/><nav className={open ? 'nav-open' : ''} aria-label="Main navigation">{[['Services', '/services'], ['Care packages', '/packages'], ['The studio', '/about'], ['Gallery', '/gallery']].map(([name, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href ? 'nav-active' : ''}>{name}</Link>)}<Link href="/contact" className="mobile-contact" onClick={() => setOpen(false)}>Contact</Link></nav><div className="header-actions">{demo && <span className="demo-indicator"><i/>LOCAL DEMO</span>}<Link href="/my-bookings" className="account-link" aria-label={actor ? `My bookings — ${actor.name}` : 'My bookings'} title={actor?.name}><UserRound size={18}/>{actor && <span className="account-name">{actor.name}</span>}</Link><Button href="/booking" variant={home ? 'secondary' : 'primary'}>Book a treatment <ArrowUpRight size={16}/></Button><button className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}>{open ? <X/> : <Menu/>}</button></div></header></>;
}
export function PublicFooter({ site, demo }: { site: Site; demo: boolean }) {
  return <footer className="public-footer"><div className="footer-main"><div><Brand name={site.name}/><p>{site.tagline}</p></div><div className="footer-links"><Link href="/services">Treatments</Link><Link href="/packages">Care packages</Link><Link href="/faq">Questions & answers</Link><Link href="/contact">Get in touch</Link></div><div className="footer-cta"><span>YOUR NEXT GOOD DRIVE</span><Link href="/booking">STARTS HERE <ArrowUpRight size={24}/></Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {site.name} · Built by <a href="https://github.com/knightryder098" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Gobinda Lugun</a></span><div><Link href="/policies/privacy">Privacy</Link><Link href="/policies/terms">Terms</Link><Link href="/policies/cancellation">Cancellation</Link><Link href="/admin">Studio dashboard <ArrowUpRight size={12}/></Link></div></div>{demo && <p className="demo-footer">Local demonstration · Illustrative services, prices, vehicle mappings and studio details. No real payments or messages.</p>}</footer>;
}
