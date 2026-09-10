import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img src="/logo/light.svg" alt="Cloak" className="logo-light h-5 w-auto" />
          <img src="/logo/dark.svg" alt="Cloak" className="logo-dark h-5 w-auto" />
        </>
      ),
      url: '/guide/what-is-cloak',
    },
    githubUrl: 'https://github.com/cloak-ag/sdk',
    links: [
      { text: 'App', url: 'https://cloak.ag', external: true },
      { text: 'NPM', url: 'https://www.npmjs.com/package/@cloak.dev/sdk', external: true },
      { text: 'Discord', url: 'https://discord.gg/hdkrhrgfER', external: true },
    ],
  };
}
