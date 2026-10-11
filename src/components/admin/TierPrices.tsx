'use client';

import { Field } from '@/components/ui';
import { titleCase } from '@/lib/format';
import type { TierCode } from '@/lib/types';
import { useAdmin } from './context';

export function TierPrices({ serviceId, tierCode }: { serviceId: string; tierCode: TierCode }) {
  const { draft, data, edit } = useAdmin();
  const service = draft?.services.find(s => s.id === serviceId);
  const tier = service?.tiers.find(t => t.code === tierCode);
  if (!draft || !service || !tier) return null;
  const offeredPlans = data.published?.plans ?? draft.plans;
  const plans = draft.plans.map(plan => ({ ...plan, enabled: offeredPlans.some(p => p.code === plan.code && p.enabled) }));
  return <div>
    <div className="panel-title"><h3>Treatment prices</h3><span>INR · rupees</span></div>
    <p>These values are shared with Pricing matrix. Saving and publishing this page includes treatment prices.</p>
    {plans.map(plan => <fieldset key={plan.code} className="admin-panel">
      <legend>{plan.name}{plan.enabled ? ' · Offered plan' : ' · Inactive plan'}</legend>
      <div className="form-grid">
        {(['standard', 'premium', 'luxury'] as const).map(cls => {
          const value = tier.prices[cls][plan.code];
          const required = service.enabled && tier.enabled && plan.enabled;
          return <Field key={cls} label={`${titleCase(cls)} ${plan.name} price (₹)`}
            hint={required ? 'Required before saving this offered treatment.' : 'Optional while the service, tier or plan is inactive.'}>
            <input type="number" min={0.01} max={10000000} step={0.01}
              required={required} aria-invalid={required && value === null}
              value={value === null ? '' : value / 100} placeholder="Not configured"
              onChange={event => edit(c => {
                const target = c.services.find(s => s.id === serviceId)!.tiers.find(t => t.code === tierCode)!;
                target.prices[cls][plan.code] = event.target.value === '' ? null : Math.round(Number(event.target.value) * 100);
              })}/>
          </Field>;
        })}
      </div>
    </fieldset>)}
  </div>;
}
