'use client';

import { Badge, Button, Notice } from '@/components/ui';
import { validatePublication } from '@/lib/catalogue-validation';
import { useAdmin } from './context';

export function BookingSettings() {
  const { draft, edit, busy, data } = useAdmin();
  if (!draft) return null;

  // Check this page against live offers, not unrelated saved drafts.
  // Enabling booking requires the dependent pages to be published first.
  const baseline = data.published ?? { ...draft, services: [], products: [], vehicles: [], plans: [] };
  const issues = validatePublication({ ...baseline, schedule: draft.schedule, bookingEnabled: true });
  const missingPrices = issues.filter(issue => /: missing .* price\.$/.test(issue)).length;

  return (
    <section className="admin-panel settings-panel booking-settings">
      <div className="panel-title">
        <h2>Online booking</h2>
        <Badge>{draft.bookingEnabled ? 'DRAFT · ENABLED' : 'DRAFT · PAUSED'}</Badge>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={draft.bookingEnabled}
          disabled={busy}
          onChange={event => edit(c => { c.bookingEnabled = event.target.checked; })}
        />
        Enable online booking
      </label>
      <p className="muted-copy">
        Enabled: customers can choose their car, treatments, care level, appointment,
        verify their details, and confirm their booking. Paused: customers see
        “GOOD CARE IS ON ITS WAY.” and can contact the studio for a consultation.
      </p>
      <Notice>
        Save draft keeps this setting private. The owner must publish changes to
        apply it to the website. Existing appointments keep their booking details.
      </Notice>
      {issues.length === 0 ? (
        <Notice>Ready to enable online booking.</Notice>
      ) : (
        <>
          <Notice error={draft.bookingEnabled}>
            Finish setup before publishing booking as enabled.
            {missingPrices > 0 && ` ${missingPrices} offered price combinations need a reviewed price.`}
          </Notice>
          <details>
            <summary>View {issues.length} setup {issues.length === 1 ? 'issue' : 'issues'}</summary>
            <ul className="booking-readiness-issues">
              {issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
            </ul>
          </details>
          <p className="muted-copy">
            Fill in prices for every offered treatment, tier, reviewed vehicle class
            and plan. Disable any offers you are not ready to sell.
          </p>
          <div className="booking-setup-links">
            <Button href="/admin/prices" variant="ghost">Pricing matrix</Button>
            <Button href="/admin/services" variant="ghost">Services & tiers</Button>
            <Button href="/admin/packages" variant="ghost">Care plans</Button>
            <Button href="/admin/vehicles" variant="ghost">Vehicle catalogue</Button>
          </div>
        </>
      )}
    </section>
  );
}
