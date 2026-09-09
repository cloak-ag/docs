import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import config from '../../docs.json';
import * as Components from '../components';

type Page = { title?: string; description?: string; pages: string[] };
const root = process.cwd();
const groups = (config.navigation.tabs as Array<{ tab:string; groups:Array<{ group:string; pages:string[] }> }>).flatMap(tab => tab.groups.map(group => ({ ...group, tab:tab.tab })));
const pagePaths = groups.flatMap(group => group.pages);
function readPage(slug: string) { const file = path.join(root, `${slug}.mdx`); const source = fs.readFileSync(file, 'utf8'); return matter(source); }
export function generateStaticParams() { return pagePaths.map(slug => ({ slug: slug.split('/') })); }
export async function generateMetadata({ params }: { params: Promise<{ slug:string[] }> }) { const { data } = readPage((await params).slug.join('/')); return { title:data.title, description:data.description }; }
export default async function DocsPage({ params }: { params: Promise<{ slug:string[] }> }) {
  const slug = (await params).slug.join('/'); const { data, content } = readPage(slug); const index = pagePaths.indexOf(slug);
  const previous = index > 0 ? pagePaths[index - 1] : undefined; const next = index >= 0 && index < pagePaths.length - 1 ? pagePaths[index + 1] : undefined;
  return <div className="shell"><Sidebar active={slug} /><main className="main"><header className="topbar"><Link href="https://cloak.ag">App</Link><a href="https://github.com/cloak-ag/docs">GitHub</a></header><article className="content"><div className="eyebrow">CLOAK DOCUMENTATION</div><h1>{data.title ?? slug}</h1>{data.description && <p>{data.description}</p>}<MDXRemote source={content} options={{ mdxOptions:{ remarkPlugins:[remarkGfm] } }} components={Components} /><nav style={{display:'flex',justifyContent:'space-between',gap:20,borderTop:'1px solid var(--line)',marginTop:64,paddingTop:24}}>{previous ? <Link href={`/${previous}`}>← Previous</Link> : <span/>}{next && <Link href={`/${next}`}>Next →</Link>}</nav></article></main></div>;
}
function Sidebar({ active }: { active:string }) { return <aside className="sidebar"><Link href="/guide/what-is-cloak" className="brand"><img src="/logo/light.svg" alt="" />Cloak docs</Link>{groups.map((group, i) => <div className="group" key={`${group.tab}-${group.group}`}>{(i === 0 || groups[i-1].tab !== group.tab) && <div className="tab">{group.tab}</div>}<div className="group-title">{group.group}</div>{group.pages.map(slug => <Link key={slug} className={`nav-link ${active === slug ? 'active' : ''}`} href={`/${slug}`}>{readPage(slug).data.title ?? slug}</Link>)}</div>)}</aside>; }
