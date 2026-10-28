// Node module hooks: map Zepp OS and ZML imports to the fakes in this folder,
// and resolve the extensionless relative imports Zeus allows.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const FAKES = {
  '@zos/ui': 'zos-ui.mjs',
  '@zos/utils': 'zos-utils.mjs',
  '@zos/sensor': 'zos-sensor.mjs',
  '@zos/ble': 'zos-ble.mjs',
  '@zos/storage': 'zos-storage.mjs',
  '@zos/router': 'zos-router.mjs',
  '@zeppos/zml/base-page': 'zml.mjs',
  '@zeppos/zml/base-side': 'zml.mjs'
}

export async function resolve(specifier, context, next) {
  if (FAKES[specifier]) {
    return { url: new URL(FAKES[specifier], import.meta.url).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?js$/.test(specifier) && context.parentURL) {
    const candidate = new URL(specifier + '.js', context.parentURL)
    if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true, format: 'module' }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  // Project files use ESM syntax in a package without "type": "module".
  if (url.startsWith('file:') && url.endsWith('.js') && !url.includes('node_modules')) {
    return next(url, { ...context, format: 'module' })
  }
  return next(url, context)
}
