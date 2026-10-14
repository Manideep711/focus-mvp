import { readdirSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const specs = join(root, 'tests', 'e2e')
const entries = readdirSync(specs, { withFileTypes: true }).filter((e) =>
  e.name.endsWith('.spec.ts'),
)
// Windows OneDrive marks hydrated files as reparse points. Playwright skips those Dirents.
// Materialize only the test sources into a fresh ignored directory; leave originals untouched.
let runDir
const env = { ...process.env }
if (entries.some((e) => e.isSymbolicLink())) {
  const staging = join(root, '.playwright-specs')
  mkdirSync(staging, { recursive: true })
  runDir = mkdtempSync(join(staging, 'run-'))
  for (const entry of entries)
    writeFileSync(join(runDir, entry.name), readFileSync(join(specs, entry.name)))
  env.FOCUS_BROWSER_TEST_DIR = runDir
  console.log(`Materialized ${entries.length} browser test files for OneDrive-safe discovery.`)
}
const result = spawnSync(
  process.execPath,
  [join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)],
  { cwd: root, env, stdio: 'inherit' },
)
if (result.error) console.error(result.error.message)
if (runDir && result.status === 0) {
  const safeRoot = resolve(root, '.playwright-specs')
  const absolute = resolve(runDir)
  if (!absolute.startsWith(safeRoot + sep))
    throw new Error('Refusing to remove a directory outside the test staging root.')
  rmSync(absolute, { recursive: true, force: true })
}
process.exitCode = result.status ?? 1
