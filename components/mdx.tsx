import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card as FumaCard, Cards } from 'fumadocs-ui/components/card';
import { icons } from 'lucide-react';
import type { MDXComponents } from 'mdx/types';
import { createElement, type ImgHTMLAttributes, type ReactNode } from 'react';
import { Accordion, AccordionGroup } from './accordion';

/** Resolve a lucide icon by its PascalCase name (used by `icon="..."` props and frontmatter). */
export function iconFor(name?: string) {
  if (!name) return undefined;
  const Icon = icons[name as keyof typeof icons];
  return Icon ? createElement(Icon) : undefined;
}

// --- Mintlify-compatible components -------------------------------------------------------
// The MDX pages were written against Mintlify's component set. These shims map that surface
// onto Fumadocs UI so the content did not have to be rewritten.

function Card({
  icon,
  children,
  ...props
}: {
  title: ReactNode;
  href?: string;
  icon?: string;
  children?: ReactNode;
}) {
  return (
    <FumaCard {...props} icon={iconFor(icon)}>
      {children}
    </FumaCard>
  );
}

function CardGroup({ cols, children }: { cols?: number; children?: ReactNode }) {
  const className = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'md:grid-cols-3' : cols === 4 ? 'md:grid-cols-4' : undefined;
  return <Cards className={className}>{children}</Cards>;
}

function Note({ children }: { children?: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

function Tip({ children }: { children?: ReactNode }) {
  return <Callout type="idea">{children}</Callout>;
}

function Warning({ children }: { children?: ReactNode }) {
  return <Callout type="warn">{children}</Callout>;
}

/** Plain <img>: the diagrams are SVGs served from /public, no need for next/image. */
function Img(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: Img,
    Card,
    CardGroup,
    Note,
    Tip,
    Warning,
    Accordion,
    AccordionGroup,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
