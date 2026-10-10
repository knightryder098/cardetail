import { publicData } from '@/server/public-data';
import { BookingWizard } from '@/components/booking/BookingWizard';
export const metadata = { title: 'Book a treatment', robots: { index: false, follow: false } };
export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string; tier?: string; plan?: string; pack?: string }> }) { const data = await publicData(); return <BookingWizard catalogue={data.catalogue} demo={data.demo} initial={await searchParams}/>; }
