'use client';
import { createContext, useContext } from 'react';
import type { AuditEvent, Booking, Catalogue, OutboxEvent, PackagePurchase, Staff } from '@/lib/types';
export type AdminData = { draft: Catalogue | null; draftVersion:number; activeRevisionId: string | null; draftBaseRevisionId: string | null; revisions: { id: string; number: number; at: string; author: string }[]; bookings: Booking[]; packages: (PackagePurchase & { balance: number })[]; staff: Staff[]; audit: AuditEvent[]; outbox: OutboxEvent[] };
export type AdminContextValue = { data: AdminData; draft: Catalogue | null; demo: boolean; role: string; busy: boolean; edit: (fn: (c: Catalogue) => void) => void; run: (task: () => Promise<unknown>, message: string, refresh?: boolean) => Promise<boolean>; reload: () => Promise<void> };
export const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdmin() { const value = useContext(AdminContext); if(!value)throw new Error('Missing admin context'); return value; }
