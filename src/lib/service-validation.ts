import type { Catalogue } from './types';
import { serviceSchema } from './schema';
import { publicationIssues, type CatalogueIssue } from './catalogue-validation';
import { z } from 'zod';

// Validate this page against the live dependencies, not other pages' private drafts.
export function serviceSaveIssues(draft: Catalogue, dependencies: Catalogue = draft): CatalogueIssue[] {
  const parsed = z.array(serviceSchema).max(50).safeParse(draft.services);
  if (!parsed.success) return parsed.error.issues.map(issue => {
    const service = draft.services[Number(issue.path[0])];
    const tier = issue.path[1] === 'tiers' ? service?.tiers[Number(issue.path[2])] : undefined;
    const field = issue.path.slice(tier ? 3 : 1).join(' / ');
    return { section: 'services', serviceId: service?.id, tierCode: tier?.code,
      message: `${service?.name || 'Service'}${tier ? ` ${tier.name}` : ''} — ${field || 'Services'}: ${issue.message}` };
  });
  const candidate = { ...dependencies, services: parsed.data, bookingEnabled: false };
  const issues = publicationIssues(candidate).filter(issue => issue.section === 'services' || !!issue.serviceId)
    .map(issue => ({ ...issue, section: 'services' as const }));
  for (const service of candidate.services.filter(s => s.enabled)) {
    for (const tier of service.tiers.filter(t => t.enabled)) {
      for (const plan of candidate.plans.filter(p => p.enabled)) {
        for (const cls of ['standard', 'premium', 'luxury'] as const) {
          if (tier.prices[cls][plan.code] === null) issues.push({ section: 'services', serviceId: service.id,
            tierCode: tier.code, planCode: plan.code, pricingClass: cls,
            message: `${service.name} ${tier.name}: missing ${cls} ${plan.name} price.` });
        }
      }
    }
  }
  return issues;
}
