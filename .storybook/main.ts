import type { StorybookConfig } from '@storybook/react-vite';

// Storybook for the AiKit Prints component library. It reuses the project's
// vite.config.ts (the `@` → src alias and the React plugin are inherited via
// the automatic config merge), so stories can import from `@/...` just like the
// app does.
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  // Serve public/ at the root so the print fonts (staticFile('fonts/…') in
  // <PrintFonts/>) and brand assets resolve inside Storybook just like the app.
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
