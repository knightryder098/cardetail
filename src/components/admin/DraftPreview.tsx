"use client";
import { useEffect, useState } from "react";
import type { Catalogue } from "@/lib/types";
import { api } from "@/lib/client-api";
import { Button, Notice } from "@/components/ui";
import { HomeScene } from "@/components/immersive/HomeScene";
import { ServiceCard } from "@/components/public/ServiceCard";
import { PublicHeader, PublicFooter } from "@/components/public/Shell";
export function DraftPreview() {
  const [c, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ catalogue: Catalogue }>("admin/preview")
      .then((d) => setCatalogue(d.catalogue))
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <main className="section-wrap">
        <Notice error>{error}</Notice>
        <Button href="/admin">Open studio dashboard</Button>
      </main>
    );
  if (!c)
    return (
      <main className="section-wrap">
        <p className="loading-label">Loading your private draft…</p>
      </main>
    );
  return (
    <div className={`public-surface palette-${c.site.accent}`}>
      <div className="draft-preview-banner">
        <strong>PRIVATE DRAFT PREVIEW</strong>
        <span>
          Showing your last saved draft. Treatment links open the current live
          catalogue.
        </span>
        <Button href="/admin/site" variant="ghost">
          Back to editor
        </Button>
      </div>
      <PublicHeader site={c.site} demo={false} />
      <main id="main">
        <HomeScene site={{ ...c.site, intro: false }} />
        <section className="section-wrap">
          <div className="section-kicker">DRAFT TREATMENT MENU</div>
          <div className="section-heading">
            <h2>
              GOOD CARE.
              <br />
              GREAT FEELING.
            </h2>
            <p>
              Disabled treatments are hidden. This preview creates no quotes or
              reservations.
            </p>
          </div>
          <div className="service-grid">
            {c.services
              .filter((s) => s.enabled)
              .map((s, i) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  index={i}
                  taxMode={c.taxMode}
                  taxBps={c.taxBps}
                />
              ))}
          </div>
        </section>
        <section className="section-wrap">
          <h2>YOUR CARE PLANS</h2>
          <div className="care-principles">
            {c.plans
              .filter((p) => p.enabled)
              .map((p) => (
                <div key={p.code}>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <p>
                    {p.visits} visits ·{" "}
                    {p.validityDays
                      ? `${p.validityDays} days`
                      : "Single appointment"}{" "}
                    · No automatic renewal
                  </p>
                </div>
              ))}
          </div>
        </section>
      </main>
      <PublicFooter site={c.site} demo={false} />
    </div>
  );
}
