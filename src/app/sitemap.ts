import type { MetadataRoute } from 'next';
import { publicData } from '@/server/public-data';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { if (!process.env.APP_ORIGIN) return []; const { catalogue: c } = await publicData(); return ['','/services','/packages','/about','/gallery','/contact','/faq',...c.services.map(s => `/services/${s.slug}`)].map(path => ({ url: process.env.APP_ORIGIN + path, changeFrequency: 'weekly', priority: path ? .7 : 1 })); }
