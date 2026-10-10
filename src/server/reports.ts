import type { Booking } from '@/lib/types';
import ExcelJS from 'exceljs';
import { dateLabel, timeLabel } from '@/lib/format';
export async function exportWorkbook(bookings: Booking[], filters: Record<string, string>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Balaji Studio'; wb.created = new Date();
  const sheet = wb.addWorksheet('Bookings');
  sheet.columns = ['Reference', 'Scheduled IST', 'Status', 'Customer', 'Email', 'Phone', 'Vehicle', 'Body type', 'Pricing class', 'Service', 'Tier', 'Plan', 'Materials', 'Minutes', 'Amount INR', 'Tax INR', 'Payment', 'Bay', 'Source'].map(header => ({ header, width: header === 'Email' || header === 'Materials' ? 35 : 22 }));
  for (const b of bookings) sheet.addRow([b.reference, `${dateLabel(b.startAt)} ${timeLabel(b.startAt)} IST`, b.status, b.customerName, b.email, b.phone, `${b.quote.snapshot.vehicle.make} ${b.quote.snapshot.vehicle.model}`, b.quote.snapshot.vehicle.body, b.quote.snapshot.vehicle.pricingClass, b.quote.snapshot.service.name, b.quote.snapshot.tier.name, b.quote.planCode, b.quote.snapshot.products.map(p => p.name).join(', '), b.quote.durationMinutes, b.quote.totalPaise / 100, b.quote.taxPaise / 100, b.paymentStatus, b.bay, b.source]);
  const summary = wb.addWorksheet('Summary'); summary.columns = [{ header: 'Metric', width: 30 }, { header: 'Value', width: 30 }];
  summary.addRows([['Booking count', bookings.length], ['Booked value INR', bookings.reduce((n, b) => n + b.quote.totalPaise, 0) / 100], ['Collected INR', bookings.filter(b => b.paymentStatus === 'captured').reduce((n, b) => n + b.quote.totalPaise, 0) / 100]]);
  const payment = wb.addWorksheet('Payments'); payment.columns = [{ header: 'Reference', width: 25 }, { header: 'Amount INR', width: 22 }, { header: 'State', width: 22 }, { header: 'Mode', width: 24 }];
  for (const b of bookings) payment.addRow([b.reference, b.quote.totalPaise / 100, b.paymentStatus, b.paymentMode]);
  const meta = wb.addWorksheet('Filters'); meta.columns = [{ header: 'Filter', width: 30 }, { header: 'Value', width: 40 }]; for (const [k, v] of Object.entries(filters)) meta.addRow([k, v]); meta.addRow(['Generated at UTC', new Date().toISOString()]); meta.addRow(['Timezone', 'Asia/Kolkata']);
  for (const s of wb.worksheets) { s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12202A' } }; s.views = [{ state: 'frozen', ySplit: 1 }]; s.autoFilter = { from: 'A1', to: { row: 1, column: s.columnCount } }; }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
