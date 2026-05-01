const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const url = process.env.ERIDIAN_START_URL || process.env.SPECTRALBOARD_START_URL || 'http://127.0.0.1:3000'
const electronBin = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'electron.cmd')
  : path.join(root, 'node_modules', '.bin', 'electron')

function waitForNext(deadline = Date.now() + 30000) {
  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve()
      })

      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`))
          return
        }

        setTimeout(tryRequest, 500)
      })
    }

    tryRequest()
  })
}

function spawnCommand(command, args, options) {
  if (process.platform !== 'win32') {
    return spawn(command, args, options)
  }

  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command, ...args], options)
}

const next = spawnCommand('pnpm', ['run', 'dev'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'development', FORCE_COLOR: '1' },
  shell: false,
  stdio: 'inherit',
})

let electron

waitForNext()
  .then(() => {
    const electronEnv = {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      NODE_ENV: 'development',
      FORCE_COLOR: '1',
      ERIDIAN_START_URL: url,
      SPECTRALBOARD_START_URL: url,
    }

    delete electronEnv.ELECTRON_RUN_AS_NODE

    electron = spawnCommand(electronBin, ['.'], {
      cwd: root,
      env: electronEnv,
      shell: false,
      stdio: 'inherit',
    })

    electron.on('exit', (code) => {
      next.kill()
      process.exit(code ?? 0)
    })
  })
  .catch((error) => {
    console.error(error)
    next.kill()
    process.exit(1)
  })

process.on('SIGINT', () => {
  electron?.kill()
  next.kill()
})
