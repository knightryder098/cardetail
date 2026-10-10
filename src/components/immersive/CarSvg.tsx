import { useId } from 'react';
export function CarSvg({ className = '' }: { className?: string }) {
  const id = useId().replaceAll(':', '');
  return <svg className={className} viewBox="0 0 960 320" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x1="430" y1="115" x2="452" y2="267" gradientUnits="userSpaceOnUse"><stop stopColor="#f2fbff"/><stop offset=".25" stopColor="#a7c6d4"/><stop offset=".47" stopColor="#e5f4f8"/><stop offset=".55" stopColor="#7896a5"/><stop offset="1" stopColor="#1f3743"/></linearGradient>
      <linearGradient id={`${id}-glass`} x1="386" y1="90" x2="514" y2="191" gradientUnits="userSpaceOnUse"><stop stopColor="#72adc1"/><stop offset=".4" stopColor="#203e4c"/><stop offset="1" stopColor="#0a1821"/></linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#cedbe1"/><stop offset=".45" stopColor="#547480"/><stop offset="1" stopColor="#f2fafc"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#67d5e8" stopOpacity=".45"/><stop offset="1" stopColor="#67d5e8" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="487" cy="286" rx="400" ry="24" fill={`url(#${id}-glow)`}/><ellipse cx="483" cy="276" rx="382" ry="13" fill="#000" opacity=".65"/>
    <path d="M76 228l16-55 54-19 118-20 84-53c26-16 75-25 128-19l124 14 96 71 121 24c24 4 42 19 44 39l2 32-38 12H104l-28-26z" fill={`url(#${id}-body)`} stroke="#99c6d6" strokeWidth="1.5"/>
    <path d="M283 133l76-45c20-13 62-18 103-13l123 13 68 49-370-4z" fill={`url(#${id}-glass)`} stroke="#aacbd5"/>
    <path d="M469 75l9 60m99-49l48 50" stroke="#688993" strokeWidth="5"/>
    <path d="M122 164l148-18 406 3 130 30" stroke="#f0fbff" strokeWidth="2" opacity=".65"/>
    <path d="M277 150l12 96h299l51-98M117 218l78-17M734 207l89 15" stroke="#567884" strokeWidth="1.5"/>
    <path d="M322 241h274l42-71" stroke="#122e3c" strokeWidth="2"/>
    <path d="M679 155l102 18 37 14-103-5-36-27z" fill="#d8f7ff"/><path d="M91 178l45-8-10 18-38 6" fill="#b3d5dc"/>
    <path d="M829 216h24l-4 19-31 6 11-25z" fill="#0b1d29"/>
    <path d="M662 144l-17-11 20-4 18 12-21 3z" fill="#143140" stroke="#b9d6df"/>
    <path d="M339 158h35m153 0h29" stroke="#284652" strokeWidth="3" strokeLinecap="round"/>
    <path d="M153 248c-3-29 1-70 56-72 51-1 64 34 62 72M652 249c-2-39 12-70 61-70 49 0 64 34 61 70" fill="#07121a"/>
    {[212,713].map(x => <g key={x}><circle cx={x} cy="238" r="48" fill="#060c13" stroke="#142a36" strokeWidth="5"/><circle cx={x} cy="238" r="36" fill="#0b1720" stroke={`url(#${id}-rim)`} strokeWidth="3"/>{[0,60,120,180,240,300].map(a => <path key={a} d={`M${x-4} 233l-4-26 10-3 3 29`} fill={`url(#${id}-rim)`} transform={`rotate(${a} ${x} 238)`}/>)}<circle cx={x} cy="238" r="10" fill="#8caab7"/><circle cx={x} cy="238" r="5" fill="#213e4b"/></g>)}
    <path d="M289 255h338" stroke="#87d8e5" strokeWidth="2" opacity=".7"/><path d="M344 86c43-19 96-17 144-11" stroke="#fff" strokeWidth="1.5" opacity=".75"/>
  </svg>;
}
