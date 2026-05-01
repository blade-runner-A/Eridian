const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, '.next', 'standalone')
const targetDir = path.join(root, '.next', 'standalone-electron')

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Missing Next standalone output at ${sourceDir}. Run "pnpm build" first.`)
}

fs.rmSync(targetDir, { force: true, recursive: true })
fs.cpSync(sourceDir, targetDir, { dereference: true, recursive: true })

console.log('Cleaning up traced node_modules...')
fs.rmSync(path.join(targetDir, 'node_modules'), { force: true, recursive: true })

console.log('Installing production dependencies for Next.js standalone server...')

const { execSync } = require('node:child_process')
execSync('npm install --omit=dev --no-package-lock', { cwd: targetDir, stdio: 'inherit' })

console.log('Removing package.json to prevent electron-builder from pruning node_modules...')
fs.rmSync(path.join(targetDir, 'package.json'), { force: true })

console.log('Copying static assets and public folder into standalone...')
fs.cpSync(path.join(root, '.next', 'static'), path.join(targetDir, '.next', 'static'), { recursive: true })
if (fs.existsSync(path.join(root, 'public'))) {
  fs.cpSync(path.join(root, 'public'), path.join(targetDir, 'public'), { recursive: true })
}

console.log(`Prepared Electron packaging bundle at ${targetDir}`)
