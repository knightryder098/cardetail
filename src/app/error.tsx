'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="section-wrap empty-state"><h1 style={{fontSize:40}}>A LITTLE PAUSE.</h1><p>We could not load this page. Your confirmed appointments remain saved.</p><button className="btn btn-primary" onClick={reset}>Try again</button></main>; }
