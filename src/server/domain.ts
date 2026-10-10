import type { Catalogue, Quote, QuoteInput, Slot, State } from '@/lib/types';
import { randomUUID } from 'node:crypto';
import { AppError, requireValue } from './errors';
import { addDays, localDay, timeLabel } from '@/lib/format';
export function publishedCatalogue(state: State): Catalogue {
  return requireValue(state.revisions.find(r => r.id === state.activeRevisionId), 'NO_PUBLISHED_CATALOGUE', 'The studio is preparing its catalogue.').catalogue;
}
function resolveSingleQuote(state: State, input: QuoteInput, now = new Date()): Quote {
  const c = publishedCatalogue(state);
  if (!c.bookingEnabled) throw new AppError('BOOKING_DISABLED', 'Contact the studio for a reviewed quote.', 422);
  const vehicle = c.vehicles.find(v => v.id === input.modelId && v.reviewed);
  if (!vehicle) throw new AppError('NEEDS_MANUAL_QUOTE', 'This model needs a studio-reviewed quote.', 422);
  const service = requireValue(c.services.find(s => s.id === input.serviceId && s.enabled));
  const tier = requireValue(service.tiers.find(t => t.code === input.tierCode && t.enabled));
  const plan = requireValue(c.plans.find(p => p.code === input.planCode && p.enabled));
  const amount = tier.prices[vehicle.pricingClass][plan.code];
  if (!amount || !Number.isSafeInteger(amount) || amount < 1) throw new AppError('NO_PRICE_CONFIGURED', 'A reviewed price is not available for this option.', 422);
  const taxPaise = c.taxMode === 'inclusive' ? Math.round(amount * c.taxBps / (10000 + c.taxBps)) : Math.round(amount * c.taxBps / 10000);
  return { ...input, id: randomUUID(), revisionId: state.activeRevisionId!, at: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60000).toISOString(), subtotalPaise: c.taxMode === 'inclusive' ? amount - taxPaise : amount, taxPaise, totalPaise: c.taxMode === 'inclusive' ? amount : amount + taxPaise, durationMinutes: tier.minutes, visits: plan.visits, validityDays: plan.validityDays,
    snapshot: structuredClone({ service, tier, vehicle, plan, products: c.products.filter(p => tier.productIds.includes(p.id)), policyCutoffHours: c.schedule.cancelCutoffHours }) };
}
export function resolveQuote(state:State,input:QuoteInput,now=new Date()):Quote{
  const ids=input.serviceIds??[input.serviceId];
  if(!ids.length||ids.length>6||new Set(ids).size!==ids.length)throw new AppError('VALIDATION_ERROR','Select between one and six unique services.');
  if(ids[0]!==input.serviceId)throw new AppError('VALIDATION_ERROR','The primary service must match your first selection.');
  const items=ids.map(serviceId=>resolveSingleQuote(state,{modelId:input.modelId,serviceId,tierCode:input.tierCode,planCode:input.planCode},now));
  if(items.length===1)return items[0];
  const durationMinutes=items.reduce((n,q)=>n+q.durationMinutes,0);const c=publishedCatalogue(state);
  if(durationMinutes+c.schedule.bufferMinutes>(c.schedule.closes-c.schedule.opens)*60)throw new AppError('VISIT_TOO_LONG','These services exceed one working day. Select fewer services or contact the studio.',422);
  const first=items[0];
  return {...first,serviceIds:ids,items,durationMinutes,subtotalPaise:items.reduce((n,q)=>n+q.subtotalPaise,0),taxPaise:items.reduce((n,q)=>n+q.taxPaise,0),totalPaise:items.reduce((n,q)=>n+q.totalPaise,0),snapshot:{...first.snapshot,service:{...first.snapshot.service,name:items.map(q=>q.snapshot.service.name).join(' + ')},tier:{...first.snapshot.tier,minutes:durationMinutes},products:[...new Map(items.flatMap(q=>q.snapshot.products).map(p=>[p.id,p])).values()]}};
}
export function resolvePackageQuote(state: State, packageId: string, customerId: string, now=new Date()): Quote {
  const p=requireValue(state.packages.find(p=>p.id===packageId&&p.customerId===customerId));
  if(!publishedCatalogue(state).bookingEnabled)throw new AppError('BOOKING_DISABLED','Contact the studio to arrange your prepaid visit.',422);
  if(p.status!=='active')throw new AppError('PACKAGE_UNPAID','This pack is waiting for payment.',422);
  if(p.expiresAt&&new Date(p.expiresAt)<=now)throw new AppError('PACKAGE_EXPIRED','This pack has expired.',422);
  return {...structuredClone(p.quote),id:randomUUID(),packageId,revisionId:state.activeRevisionId!,at:now.toISOString(),expiresAt:new Date(now.getTime()+10*60000).toISOString(),subtotalPaise:0,taxPaise:0,totalPaise:0};
}
export const occupiesBay = (status: string) => ['held', 'confirmed', 'in_progress'].includes(status);
export function freeBays(state: State, start: number, end: number, now = new Date(), excludeId?: string): number[] {
  const s = publishedCatalogue(state).schedule;
  return Array.from({ length: s.bays }, (_, i) => i + 1).filter(bay => !state.bookings.some(b => b.id !== excludeId && b.bay === bay && occupiesBay(b.status) && !(b.status === 'held' && new Date(b.holdExpiresAt) <= now) && new Date(b.startAt).getTime() < end && new Date(b.blockedUntil).getTime() > start));
}
export function availableSlots(state: State, quote: Quote, day: string, now = new Date(), excludeId?: string): Slot[] {
  const s = publishedCatalogue(state).schedule;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < localDay(now) || day > addDays(localDay(now), s.horizonDays)) return [];
  const midnight = new Date(`${day}T00:00:00+05:30`);
  if (!Number.isFinite(midnight.getTime()) || localDay(midnight) !== day || s.closedWeekdays.includes(new Date(day + 'T12:00:00Z').getUTCDay()) || s.closures.includes(day)) return [];
  const slots: Slot[] = [];
  for (let minute = s.opens * 60; minute + quote.durationMinutes + s.bufferMinutes <= s.closes * 60; minute += 30) {
    const start = midnight.getTime() + minute * 60000;
    if (start < now.getTime() + s.leadMinutes * 60000) continue;
    const bays = freeBays(state, start, start + (quote.durationMinutes + s.bufferMinutes) * 60000, now, excludeId);
    if (bays.length) { const startAt = new Date(start).toISOString(); slots.push({ startAt, label: timeLabel(startAt).toLowerCase(), baysAvailable: bays.length }); }
  }
  return slots;
}
export function validatePublication(c: Catalogue): string[] {
  const errors: string[] = [];
  for (const key of ['services', 'products', 'vehicles'] as const) {
    const ids = c[key].map(item => item.id); if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${key} identifiers.`);
  }
  if (new Set(c.services.map(s => s.slug)).size !== c.services.length) errors.push('Service addresses must be unique.');
  if (new Set(c.plans.map(p => p.code)).size !== c.plans.length) errors.push('Plan terms must be unique.');
  if (c.bookingEnabled && !c.vehicles.some(v => v.reviewed)) errors.push('Review at least one vehicle before enabling booking.');
  for (const p of c.plans.filter(p => p.enabled)) if (p.code !== 'one_time' && (!p.validityDays || !p.visits)) errors.push(`${p.name}: define visits and validity.`);
  for (const s of c.services.filter(s => s.enabled)) {
    if (!s.tiers.some(t => t.enabled)) errors.push(`${s.name}: enable at least one tier.`);
    if (new Set(s.tiers.map(t => t.code)).size !== s.tiers.length) errors.push(`${s.name}: tier codes must be unique.`);
    for (const t of s.tiers.filter(t => t.enabled)) {
      if (t.productIds.some(id => !c.products.some(p => p.id === id))) errors.push(`${s.name} ${t.name}: select existing materials.`);
      if (t.minutes + c.schedule.bufferMinutes > (c.schedule.closes - c.schedule.opens) * 60) errors.push(`${s.name} ${t.name}: duration exceeds the working day.`);
      if (c.bookingEnabled) for (const cls of [...new Set(c.vehicles.filter(v => v.reviewed).map(v => v.pricingClass))]) for (const p of c.plans.filter(p => p.enabled)) if (!t.prices[cls][p.code]) errors.push(`${s.name} ${t.name}: missing ${cls} ${p.name} price.`);
    }
  }
  return errors;
}
