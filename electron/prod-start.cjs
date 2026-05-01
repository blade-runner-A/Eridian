const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const electronBin = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'electron.cmd')
  : path.join(root, 'node_modules', '.bin', 'electron')

function spawnCommand(command, args, options) {
  if (process.platform !== 'win32') {
    return spawn(command, args, options)
  }

  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command, ...args], options)
}

const electronEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'production',
}

delete electronEnv.ELECTRON_RUN_AS_NODE
delete electronEnv.ERIDIAN_START_URL
delete electronEnv.SPECTRALBOARD_START_URL

const electron = spawnCommand(electronBin, ['.'], {
  cwd: root,
  env: electronEnv,
  shell: false,
  stdio: 'inherit',
})

electron.on('exit', (code) => {
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  electron.kill()
})
