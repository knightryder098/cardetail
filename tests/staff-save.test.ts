import { beforeEach, expect, it, vi } from 'vitest';
import type { Session, Staff, State } from '@/lib/types';
const m = vi.hoisted(() => ({ read: vi.fn(), transaction: vi.fn(), resolveAuthUser: vi.fn() }));
vi.mock('@/server/store', () => ({ isDemo: () => false, store: () => m }));
import { handleAdmin } from '@/server/admin-api';

const ownerId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
let state: State;
let actor: Session;
const request = () => new Request('https://studio.example/api/v1/admin/staff', { method: 'PUT' });
const newMember = (): Staff => ({ id: 'staff-new', name: 'New Member', email: 'new@example.com', role: 'manager', active: true, userId: null });
beforeEach(() => {
  vi.resetAllMocks();
  actor = { id: 'owner-session', customerId: 'staff-owner', name: 'Owner', email: 'owner@example.com', role: 'owner', mfa: true, expiresAt: '2030-01-01T00:00:00Z' };
  state = { staff: [{ id: 'staff-owner', name: 'Owner', email: 'owner@example.com', role: 'owner', active: true, userId: ownerId }], sessions: [actor], bookings: [], audit: [] } as unknown as State;
  m.read.mockResolvedValue(state);
  m.transaction.mockImplementation(async (fn: (s: State) => unknown) => fn(state));
  m.resolveAuthUser.mockImplementation(async (email: string) => email === 'owner@example.com' ? ownerId : staffId);
});

it('populates the saved user ID with the account returned by the server', async () => {
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, newMember()] });
  expect(response?.status).toBe(200);
  expect((await response!.json()).staff[1].userId).toBe(staffId);
  expect(m.resolveAuthUser).toHaveBeenCalledWith('new@example.com', 'New Member');
  expect(state.staff[1].userId).toBe(staffId);
});

it('ignores a user ID supplied by the browser when creating a member', async () => {
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, { ...newMember(), userId: ownerId }] });
  expect((await response!.json()).staff[1].userId).toBe(staffId);
});

it('does not save team changes when an active account cannot be provisioned', async () => {
  m.resolveAuthUser.mockResolvedValue(null);
  await expect(handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, newMember()] })).rejects.toMatchObject({ code: 'STAFF_ACCOUNT_CREATION_FAILED' });
  expect(state.staff).toHaveLength(1);
  expect(m.transaction).not.toHaveBeenCalled();
});

it('validates duplicate emails before creating any accounts', async () => {
  await expect(handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, { ...newMember(), email: 'owner@example.com' }] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it.each(['manager', 'staff'] as const)('does not allow a %s to create accounts', async role => {
  await expect(handleAdmin(request(), 'admin/staff', { ...actor, role }, { staff: [...state.staff, newMember()] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it('requires owner MFA before any provisioning', async () => {
  await expect(handleAdmin(request(), 'admin/staff', { ...actor, mfa: false }, { staff: [...state.staff, newMember()] })).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it('checks that the owner is still active before creating any login accounts', async () => {
  state.staff[0].active = false;
  await expect(handleAdmin(request(), 'admin/staff', actor, { staff: [{ ...state.staff[0], active: true }, newMember()] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it('preserves the server mapping for an existing member despite a forged browser ID', async () => {
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [{ ...state.staff[0], userId: staffId }] });
  expect((await response!.json()).staff[0].userId).toBe(ownerId);
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it('resolves a changed email to its own account instead of keeping the previous mapping', async () => {
  state.staff.push({ ...newMember(), email: 'old@example.com', userId: '33333333-3333-4333-8333-333333333333' });
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [state.staff[0], { ...state.staff[1], email: 'new@example.com' }] });
  expect((await response!.json()).staff[1].userId).toBe(staffId);
});

it('does not provision inactive members', async () => {
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, { ...newMember(), active: false }] });
  expect((await response!.json()).staff[1].userId).toBeNull();
  expect(m.resolveAuthUser).not.toHaveBeenCalled();
});

it('lets the form omit the server-owned user ID', async () => {
  const { userId: _id, ...member } = newMember();
  const response = await handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, member] });
  expect((await response!.json()).staff[1].userId).toBe(staffId);
});

it('rejects a stale save instead of overwriting another owner’s team changes', async () => {
  m.transaction.mockImplementation(async (fn: (s: State) => unknown) => {
    state.staff[0].name = 'Changed by another owner';
    return fn(state);
  });
  await expect(handleAdmin(request(), 'admin/staff', actor, { staff: [...state.staff, newMember()] })).rejects.toMatchObject({ code: 'TEAM_CONFLICT', status: 409 });
  expect(state.staff).toHaveLength(1);
});
