import {store} from './store';
import {expireHolds} from './bookings';
export async function currentBookingState(){
  const s=await store().read();
  if(s.bookings.some(b=>b.status==='held'&&new Date(b.holdExpiresAt)<=new Date()))return store().transaction(s=>{expireHolds(s);return s;});
  return s;
}
