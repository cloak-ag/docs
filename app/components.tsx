import Link from 'next/link';

export function Card({ title, href, children }: { title?: string; href?: string; children?: React.ReactNode }) {
  const body = <><h3>{title}</h3><p>{children}</p></>;
  return href ? <Link className="card" href={href}>{body}</Link> : <div className="card">{body}</div>;
}
export function CardGroup({ children }: { children?: React.ReactNode }) { return <div className="cards">{children}</div>; }
function Callout({ type, title, children }: { type:string; title:string; children?:React.ReactNode }) { return <aside className={`callout ${type}`}><div className="callout-title">{title}</div>{children}</aside>; }
export function Note({ children }: { children?: React.ReactNode }) { return <Callout type="note" title="Note">{children}</Callout>; }
export function Tip({ children }: { children?: React.ReactNode }) { return <Callout type="note" title="Tip">{children}</Callout>; }
export function Warning({ children }: { children?: React.ReactNode }) { return <Callout type="warning" title="Warning">{children}</Callout>; }
export function Accordion({ title, children }: { title?:string; children?:React.ReactNode }) { return <details className="callout"><summary className="callout-title">{title}</summary>{children}</details>; }
export function AccordionGroup({ children }: { children?:React.ReactNode }) { return <div>{children}</div>; }
export function CodeGroup({ children }: { children?:React.ReactNode }) { return <div>{children}</div>; }
