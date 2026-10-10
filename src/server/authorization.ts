import type { Session, State } from '@/lib/types';
import { AppError } from './errors';
const permissions: Record<string, string[]> = {
  'admin.read': ['owner', 'manager', 'staff'], 'bookings.write': ['owner', 'manager', 'staff'],
  'catalog.write': ['owner', 'manager'], 'catalog.publish': ['owner'], 'reports.export': ['owner'],
  'payments.collect': ['owner'], 'staff.manage': ['owner'], 'audit.read': ['owner']
};
export function authorize(_s: State, actor: Session | null, action: string): Session {
  if (!actor) throw new AppError('VERIFICATION_REQUIRED', 'Please sign in to continue.', 401);
  if (!permissions[action]?.includes(actor.role)) throw new AppError('FORBIDDEN', 'You do not have permission for this action.', 403);
  if (!actor.mfa) throw new AppError('MFA_REQUIRED', 'Complete two-factor verification before using the dashboard.', 403);
  return actor;
}
