'use client';

import { Accordion as FumaAccordion, Accordions } from 'fumadocs-ui/components/accordion';
import { createContext, useContext, type ReactNode } from 'react';

const InGroup = createContext(false);

/** Mintlify-style `<AccordionGroup>`: a bordered list of accordions. */
export function AccordionGroup({ children }: { children?: ReactNode }) {
  return (
    <InGroup.Provider value={true}>
      <Accordions>{children}</Accordions>
    </InGroup.Provider>
  );
}

/** Mintlify-style `<Accordion title="...">`. Works standalone or inside `<AccordionGroup>`. */
export function Accordion({ title, children }: { title: string; children?: ReactNode }) {
  const inGroup = useContext(InGroup);
  const item = <FumaAccordion title={title}>{children}</FumaAccordion>;
  return inGroup ? item : <Accordions>{item}</Accordions>;
}
