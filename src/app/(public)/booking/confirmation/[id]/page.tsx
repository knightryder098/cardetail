import { Confirmation } from '@/components/booking/Confirmation';
export const metadata = { title: 'Your appointment', robots: { index: false, follow: false } };
export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) { return <Confirmation id={(await params).id}/>; }
