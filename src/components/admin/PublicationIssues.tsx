'use client';
import Link from 'next/link';
import { Notice } from '@/components/ui';
import { publicationIssues, type CatalogueIssue } from '@/lib/catalogue-validation';
import type { Catalogue, PlanCode } from '@/lib/types';

const labels = { prices: 'Pricing matrix', packages: 'Care packages', services: 'Services & tiers', products: 'Treatment materials', vehicles: 'Vehicle library', schedule: 'Studio schedule', site: 'Site editor' };

export function PublicationIssues({ issues }: { issues: CatalogueIssue[] }) {
  if (!issues.length) return null;
  return <Notice error><div>
    <strong>Required before this page can be published</strong>
    <p>Your draft is saved. Publish the required setup on the pages below, then try again.</p>
    {Object.entries(labels).map(([section, label]) => {
      const entries = issues.filter(issue => issue.section === section);
      if (!entries.length) return null;
      return <div key={section}>
        <Link href={`/admin/${section}`}>{label} — {entries.length} {entries.length === 1 ? 'issue' : 'issues'}</Link>
        <ul>{entries.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
      </div>;
    })}
  </div></Notice>;
}

export function PlanReadiness({ catalogue, code }: { catalogue: Catalogue; code: PlanCode }) {
  const issues = publicationIssues(catalogue).filter(issue => issue.planCode === code);
  if (!issues.length) return null;
  return <details className="plan-readiness">
    <summary>{issues.length} required {issues.length === 1 ? 'change' : 'changes'} before offering this plan</summary>
    <ul>{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
    <Link href="/admin/prices">Review and publish the required prices</Link>
  </details>;
}
