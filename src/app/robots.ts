import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/preview', '/my-bookings', '/booking', '/api', '/policies'] }, ...(process.env.APP_ORIGIN ? { sitemap: `${process.env.APP_ORIGIN}/sitemap.xml` } : {}) }; }
