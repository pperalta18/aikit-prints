import { Config } from '@remotion/cli/config';
import path from 'node:path';

/**
 * Remotion uses its own webpack bundler (not Vite), so we re-declare the `@`
 * alias here so the neumorphic components load unchanged. CSS imports (and the
 * Universal Sans fonts in src/index.css → /fonts/* served from public/) work
 * out of the box.
 */
Config.setVideoImageFormat('png');
Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...(current.resolve?.alias ?? {}),
      '@': path.join(process.cwd(), 'src'),
    },
  },
  module: {
    ...current.module,
    rules: [
      ...(current.module?.rules ?? []),
      // Vite resolves `./foo.riv?url` to an emitted URL out of the box; webpack
      // doesn't, so emit Rive binaries as assets and hand back their URL.
      { test: /\.riv$/, type: 'asset/resource' },
    ],
  },
}));
