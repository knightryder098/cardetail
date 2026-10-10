import type { PlanCode } from './types';
export const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
export const dateLabel = (iso: string, short = false) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: short ? 'short' : 'long', year: short ? undefined : 'numeric' }).format(new Date(iso));
export const timeLabel = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
export const localDay = (date: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function addDays(day: string, days: number) { const d = new Date(day + 'T12:00:00+05:30'); d.setUTCDate(d.getUTCDate() + days); return localDay(d); }
export const duration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
export const planLabel: Record<PlanCode, string> = { one_time: 'One time', monthly: 'Monthly pack', annual: 'Annual pack' };
export const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
