'use client';
import Link from 'next/link';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
export function Button({ children, href, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string }) {
  const classes = clsx('btn', `btn-${variant}`, className); if (href) return <Link href={href} className={classes}>{children}</Link>; return <button className={classes} {...props}>{children}</button>;
}
export function Brand({ small = false, name = 'Balaji Studio' }: { small?: boolean; name?: string }) {const parts=name.trim().split(/\s+/);const first=parts.length>1?parts.slice(0,-1).join(' '):parts[0];return <Link href="/" className={clsx('brand', small && 'brand-small')} aria-label={`${name} home`}><span className="brand-symbol"><i /><i /></span><span>{first}{parts.length>1&&<span className="brand-drive">{parts.at(-1)}</span>}</span></Link>; }
export function ArrowLink({ children, href }: { children: React.ReactNode; href: string }) { return <Link href={href} className="arrow-link">{children}<ArrowUpRight size={18} /></Link>; }
export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className={clsx('badge', tone && `badge-${tone}`)}>{children}</span>; }
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div role={error ? 'alert' : 'status'} className={clsx('notice', error && 'notice-error')}>{children}</div>; }
export function CheckItem({ children }: { children: React.ReactNode }) { return <li className="check-item"><Check size={16} aria-hidden />{children}</li>; }
export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); const d = ref.current; return () => d?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="modal-title"><div className="modal-inner"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</div></dialog>;
}
