import { CarSvg } from '@/components/immersive/CarSvg';
import type { Service } from '@/lib/types';
import { Sparkles, Layers, CircleDot, ShieldCheck, Droplets, Armchair } from 'lucide-react';
export function ServiceArt({ type, large = false }: { type: Service['image']; large?: boolean }) {
  const Icons = { wash: Droplets, ceramic: ShieldCheck, interior: Armchair, paint: Sparkles, ppf: Layers, wheel: CircleDot }; const Icon = Icons[type];
  return <div className={`service-art art-${type} ${large ? 'art-large' : ''}`} role="img" aria-label={`Original ${type} treatment illustration`}><div className="art-grid"/><div className="art-glow"/>{type === 'wheel' ? <div className="wheel-illustration"><div/><span/></div> : type === 'interior' ? <div className="art-seat"><i/><span/></div> : <CarSvg className="art-car"/>}<span className="art-label"><Icon size={16}/> {({ wash: 'THE CLEAN EDIT', ceramic: 'SURFACE / PROTECTION', interior: 'INSIDE / OUT', paint: 'DEPTH / RESTORED', ppf: 'AN EXTRA LAYER', wheel: 'THE FINAL DETAIL' })[type]}</span><span className="art-index">BS / STUDIO SERIES</span></div>;
}
