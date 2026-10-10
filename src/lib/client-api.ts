'use client';
export class ApiError extends Error { constructor(message: string, public code: string, public status: number) { super(message); } }
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(`/api/v1/${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await r.json(); if (!r.ok) throw new ApiError(data.error?.message ?? 'Something went wrong. Please try again.', data.error?.code ?? 'ERROR', r.status);
  if (typeof window !== 'undefined' && ['auth/confirm-verification', 'auth/admin-login', 'auth/mfa', 'auth/demo-owner', 'auth/logout'].includes(path)) window.dispatchEvent(new Event('balaji-session-changed'));
  return data;
}
