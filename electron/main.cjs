const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { createServer } = require('node:http')
let DatabaseSync
let sqliteLoadError = null
try {
  ({ DatabaseSync } = require('node:sqlite'))
} catch (error) {
  sqliteLoadError = error
}

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'
const appName = 'Eridian'
const appRoot = path.resolve(__dirname, '..')
const startUrl = process.env.ERIDIAN_START_URL || process.env.SPECTRALBOARD_START_URL || 'http://127.0.0.1:3000'
const SERVER_START_TIMEOUT_MS = 120000
const FALLBACK_STORE_FILE = 'eridian.json'

/**
 * Convert a virtual app.asar path to the real app.asar.unpacked path on disk.
 * child_process.spawn cannot execute scripts from inside an ASAR archive,
 * so unpacked files must be referenced through their real filesystem path.
 */
function toUnpackedPath(filePath) {
  return filePath
    .replace(/([/\\])app\.asar([/\\])/, '$1app.asar.unpacked$2')
    .replace(/([/\\])app\.asar$/, '$1app.asar.unpacked')
}
const LEGACY_THEME_REPAIR_CUTOFF = 1777373420000

let db
let productionServerProcess = null
let productionServerStartPromise = null
let productionServerUrl = null
let logFilePath = null
let fallbackStore = null
let mcpServer = null
let mainWindow = null

app.setName(appName)
nativeTheme.themeSource = 'light'

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || error.message
  }

  return String(error)
}

function writeLog(message, error) {
  const detail = error ? `\n${formatError(error)}` : ''
  const line = `[${new Date().toISOString()}] ${message}${detail}`

  console.log(line)

  if (!logFilePath) {
    return
  }

  try {
    fs.appendFileSync(logFilePath, `${line}\n`)
  } catch {
    // Ignore log write failures.
  }
}

function initLogging() {
  try {
    logFilePath = path.join(app.getPath('userData'), 'eridian.log')
    writeLog('Eridian starting.')
  } catch (error) {
    console.error(error)
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getSplashUrl(status = 'Starting Eridian...') {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <title>Eridian</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #f4f1e8;
        color: #111111;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .wrap { text-align: center; }
      .title { font-size: 22px; font-weight: 600; letter-spacing: 0.3px; }
      .status { margin-top: 12px; font-size: 13px; opacity: 0.7; }
      .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #11111133;
        border-top-color: #111111;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-color-scheme: dark) {
        body { background: #101010; color: #f4f1e8; }
        .spinner { border-color: #f4f1e833; border-top-color: #f4f1e8; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="spinner"></div>
      <div class="title">Eridian</div>
      <div class="status">${escapeHtml(status)}</div>
    </div>
  </body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function getErrorUrl(message, detail) {
  const detailText = [detail, logFilePath ? `Log file: ${logFilePath}` : null].filter(Boolean).join('\n')
  const detailBlock = detailText ? `<pre>${escapeHtml(detailText)}</pre>` : ''
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <title>Eridian</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #f4f1e8;
        color: #111111;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        padding: 24px;
        box-sizing: border-box;
      }
      .card { max-width: 560px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { margin: 0 0 16px; opacity: 0.8; }
      pre {
        margin: 0;
        padding: 12px;
        background: #ffffff;
        border: 1px solid #1111111a;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #101010; color: #f4f1e8; }
        pre { background: #1a1a1a; border-color: #f4f1e81a; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Eridian failed to start</h1>
      <p>${escapeHtml(message)}</p>
      ${detailBlock}
    </div>
  </body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function waitForServer(url, serverProcess, deadline = Date.now() + SERVER_START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
        reject(new Error(`Production server exited with code ${serverProcess.exitCode}`))
        return
      }

      if (serverProcess?.signalCode) {
        reject(new Error(`Production server exited with signal ${serverProcess.signalCode}`))
        return
      }

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

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a local port')))
        return
      }

      server.close(() => resolve(address.port))
    })
  })
}

async function startProductionServer() {
  const serverScript =
    [
      path.join(appRoot, '.next', 'standalone-electron', 'server.js'),
      path.join(appRoot, '.next', 'standalone', 'server.js'),
    ].find((candidate) => fs.existsSync(candidate)) || null

  if (!serverScript) {
    throw new Error(`Missing production server build in ${path.join(appRoot, '.next')}. Run "pnpm build" first.`)
  }

  writeLog('Starting production server.')

  const port = await getAvailablePort()
  const url = `http://127.0.0.1:${port}`
  const serverEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    PORT: String(port),
  }

  productionServerProcess = spawn(process.execPath, [toUnpackedPath(serverScript)], {
    cwd: toUnpackedPath(appRoot),
    env: serverEnv,
    shell: false,
    stdio: 'pipe',
  })

  productionServerProcess.once('error', (error) => {
    writeLog('Production server failed to spawn.', error)
  })

  productionServerProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk)
  })

  productionServerProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk)
  })

  productionServerProcess.once('exit', (code, signal) => {
    productionServerProcess = null

    if (code !== 0) {
      writeLog(`Eridian production server exited with code ${code ?? 'unknown'}${signal ? ` (signal ${signal})` : ''}.`)
    }
  })

  await waitForServer(url, productionServerProcess)
  writeLog(`Production server ready at ${url}.`)
  return url
}

function repairLegacyThemeState(data, updatedAt) {
  if (typeof updatedAt === 'number' && updatedAt > LEGACY_THEME_REPAIR_CUTOFF) {
    return data
  }

  try {
    const scene = JSON.parse(data)
    const appState = scene?.appState

    if (!appState || typeof appState !== 'object') {
      return data
    }

    const legacyCanvasColors = new Set(['#101010', '#1a1a1a', '#000000', '#f4f1e8', '#f7fbff', '#ffffff'])
    const hasLegacyTheme = appState.theme === 'dark' || appState.theme === 'light'
    const hasLegacyCanvas =
      typeof appState.viewBackgroundColor === 'string' &&
      legacyCanvasColors.has(appState.viewBackgroundColor.toLowerCase())

    if (!hasLegacyTheme && !hasLegacyCanvas) {
      return data
    }

    const repairedAppState = { ...appState }

    if (hasLegacyTheme) {
      delete repairedAppState.theme
    }

    if (hasLegacyCanvas) {
      delete repairedAppState.viewBackgroundColor
    }

    return JSON.stringify({
      ...scene,
      appState: repairedAppState,
    })
  } catch {
    return data
  }
}

function disableSqlite(error) {
  if (!DatabaseSync) {
    return
  }

  writeLog('SQLite storage unavailable, using JSON fallback.', error)
  DatabaseSync = null
  db?.close()
  db = null
}

function loadFallbackStore() {
  if (fallbackStore) {
    return fallbackStore
  }

  const filePath = path.join(app.getPath('userData'), FALLBACK_STORE_FILE)

  if (fs.existsSync(filePath)) {
    try {
      fallbackStore = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      writeLog('Failed to read JSON fallback storage.', error)
    }
  }

  if (!fallbackStore || typeof fallbackStore !== 'object') {
    fallbackStore = { scenes: {} }
  }

  if (!fallbackStore.scenes || typeof fallbackStore.scenes !== 'object') {
    fallbackStore.scenes = {}
  }

  return fallbackStore
}

function persistFallbackStore() {
  if (!fallbackStore) {
    return
  }

  const filePath = path.join(app.getPath('userData'), FALLBACK_STORE_FILE)

  try {
    fs.writeFileSync(filePath, JSON.stringify(fallbackStore))
  } catch (error) {
    writeLog('Failed to write JSON fallback storage.', error)
  }
}

function migrateFallbackStore(database) {
  const filePath = path.join(app.getPath('userData'), FALLBACK_STORE_FILE)

  if (!fs.existsSync(filePath)) {
    return
  }

  let parsed = null

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    writeLog('Failed to read JSON fallback storage for migration.', error)
    return
  }

  if (!parsed?.scenes || typeof parsed.scenes !== 'object') {
    return
  }

  const existing = database.prepare('SELECT COUNT(*) as count FROM scenes').get()
  if ((existing?.count ?? 0) > 0) {
    return
  }

  const insert = database.prepare(
    'INSERT INTO scenes (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  )

  for (const [id, scene] of Object.entries(parsed.scenes)) {
    if (typeof scene?.data !== 'string') {
      continue
    }

    const updatedAt = typeof scene.updated_at === 'number' ? scene.updated_at : Date.now()
    insert.run(id, scene.data, updatedAt)
  }
}

function loadSceneFromFallback(id) {
  const store = loadFallbackStore()
  const row = store.scenes[id]

  if (!row?.data) {
    return null
  }

  const repairedData = repairLegacyThemeState(row.data, row.updated_at)

  if (repairedData !== row.data) {
    row.data = repairedData
    row.updated_at = Date.now()
    persistFallbackStore()
  }

  return repairedData
}

function saveSceneToFallback(id, data) {
  const store = loadFallbackStore()

  store.scenes[id] = {
    data,
    updated_at: Date.now(),
  }

  persistFallbackStore()
  return true
}

function getDb() {
  if (!DatabaseSync) {
    return null
  }

  if (db) {
    return db
  }

  const dbPath = path.join(app.getPath('userData'), 'eridian.sqlite')
  const legacyDbPath = path.join(app.getPath('userData'), 'spectralboard.sqlite')

  if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
    fs.copyFileSync(legacyDbPath, dbPath)
  }

  try {
    db = new DatabaseSync(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    migrateFallbackStore(db)
  } catch (error) {
    disableSqlite(error)
    return null
  }

  return db
}

function registerStorageHandlers() {
  const loadScene = (id) => {
    if (DatabaseSync) {
      try {
        const database = getDb()

        if (database) {
          const row = database
            .prepare('SELECT data, updated_at FROM scenes WHERE id = ?')
            .get(id)

          if (!row?.data) {
            return null
          }

          const repairedData = repairLegacyThemeState(row.data, row.updated_at)

          if (repairedData !== row.data) {
            database
              .prepare('UPDATE scenes SET data = ?, updated_at = ? WHERE id = ?')
              .run(repairedData, Date.now(), id)
          }

          return repairedData
        }
      } catch (error) {
        disableSqlite(error)
      }
    }

    return loadSceneFromFallback(id)
  }

  const saveScene = (id, data) => {
    if (typeof data !== 'string') {
      throw new TypeError('Scene data must be serialized JSON')
    }

    if (DatabaseSync) {
      try {
        const database = getDb()

        if (database) {
          database
            .prepare(
              'INSERT INTO scenes (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
            )
            .run(id, data, Date.now())

          return true
        }
      } catch (error) {
        disableSqlite(error)
      }
    }

    return saveSceneToFallback(id, data)
  }

  const handleLoadScene = (_event, id = 'default') => {
    return loadScene(id)
  }

  const handleSaveScene = (_event, id = 'default', data) => {
    return saveScene(id, data)
  }

  ipcMain.handle('eridian:scene:get', handleLoadScene)
  ipcMain.handle('eridian:scene:save', handleSaveScene)
  ipcMain.handle('spectralboard:scene:get', handleLoadScene)
  ipcMain.handle('spectralboard:scene:save', handleSaveScene)

  ipcMain.handle('eridian:ai:chat', async (_event, messages) => {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          messages,
          stream: false,
          format: 'json',
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      writeLog('Ollama request failed.', error)
      throw error
    }
  })

  // MCP / External Tool Handlers
  ipcMain.on('eridian:ext:tool-result', (_event, callId, result) => {
    const callback = externalToolCallbacks.get(callId)
    if (callback) {
      callback(result)
      externalToolCallbacks.delete(callId)
    }
  })
}

const externalToolCallbacks = new Map()
let nextCallId = 1

function callRendererTool(method, params) {
  return new Promise((resolve, reject) => {
    if (!mainWindow) return reject(new Error('No active window'))
    
    const callId = nextCallId++
    externalToolCallbacks.set(callId, resolve)
    
    mainWindow.webContents.send('eridian:ext:tool-call', { id: callId, method, params })
    
    // Timeout after 10s
    setTimeout(() => {
      if (externalToolCallbacks.has(callId)) {
        externalToolCallbacks.delete(callId)
        reject(new Error('Tool call timed out'))
      }
    }, 10000)
  })
}

function startMcpServer() {
  const port = 3333
  const sessions = new Map()

  mcpServer = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    // 1. SSE Connection Endpoint (MCP Standard)
    if (url.pathname === '/sse' && req.method === 'GET') {
      const sessionId = Math.random().toString(36).substring(7)
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })

      // Inform the client about the message endpoint
      res.write(`event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`)
      
      const session = { res, id: sessionId }
      sessions.set(sessionId, session)

      req.on('close', () => {
        sessions.delete(sessionId)
      })
      return
    }

    // 2. Message Endpoint (JSON-RPC)
    if (url.pathname === '/message' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId || !sessions.has(sessionId)) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }

      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const request = JSON.parse(body)
          const response = await handleMcpRequest(request)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(response))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: error.message } }))
        }
      })
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: 'Not Found' }))
  })

  mcpServer.listen(port, '127.0.0.1', () => {
    writeLog(`[MCP] Standard SSE Server active on http://127.0.0.1:${port}/sse`)
  })
}

async function handleMcpRequest(request) {
  const { method, params, id } = request

  // Handle MCP Handshake
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false }
        },
        serverInfo: { name: 'eridian-mcp', version: '1.0.0' }
      }
    }
  }

  // List available tools
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'add_elements',
            description: 'Add Excalidraw elements (rectangles, circles, text, etc.) to the Eridian canvas.',
            inputSchema: {
              type: 'object',
              properties: {
                elements: { 
                  type: 'array', 
                  items: { type: 'object' },
                  description: 'Array of Excalidraw element objects'
                }
              },
              required: ['elements']
            }
          },
          {
            name: 'clear_canvas',
            description: 'Clear all drawings from the Eridian canvas.',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      }
    }
  }

  // Execute tools
  if (method === 'tools/call') {
    const { name, arguments: args } = params
    try {
      let result
      if (name === 'add_elements') {
        result = await callRendererTool('add_elements', args)
      } else if (name === 'clear_canvas') {
        result = await callRendererTool('clear_canvas', args)
      } else {
        throw new Error(`Unknown tool: ${name}`)
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: error.message }
      }
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: 'Method not found' }
  }
}

function createWindow(initialUrl) {
  const isMac = process.platform === 'darwin'

  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: appName,
    backgroundColor: '#ffffff',
    show: false,
    autoHideMenuBar: true,
    icon: toUnpackedPath(path.join(__dirname, '..', 'public', 'icon-1024.png')),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#111111',
      height: 36,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: true,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  if (initialUrl) {
    window.loadURL(initialUrl)
  }

  if (isDev) {
    window.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow = window
  return window
}

function shouldUseExternalUrl() {
  return isDev || process.env.ERIDIAN_START_URL || process.env.SPECTRALBOARD_START_URL
}

async function ensureProductionServer() {
  if (productionServerUrl) {
    return productionServerUrl
  }

  if (!productionServerStartPromise) {
    productionServerStartPromise = startProductionServer()
      .then((url) => {
        productionServerUrl = url
        return url
      })
      .catch((error) => {
        productionServerStartPromise = null
        throw error
      })
  }

  return productionServerStartPromise
}

function showStartupError(error) {
  const logHint = logFilePath ? `\n\nLog file: ${logFilePath}` : ''
  const message = `${formatError(error)}${logHint}`

  try {
    dialog.showErrorBox('Eridian failed to start', message)
  } catch {
    // Ignore dialog failures.
  }
}

async function loadWindowContent(window) {
  if (!window || window.isDestroyed()) {
    return
  }

  if (shouldUseExternalUrl()) {
    try {
      await window.loadURL(startUrl)
    } catch (error) {
      writeLog('Failed to load development URL.', error)
    }

    return
  }

  try {
    const url = await ensureProductionServer()
    if (!window.isDestroyed()) {
      await window.loadURL(url)
    }
  } catch (error) {
    writeLog('Failed to start production server.', error)
    showStartupError(error)
    if (!window.isDestroyed()) {
      await window.loadURL(getErrorUrl('The local server did not start.', formatError(error)))
    }
  }
}

app.whenReady().then(async () => {
  initLogging()
  process.on('uncaughtException', (error) => {
    writeLog('Uncaught exception in main process.', error)
  })
  process.on('unhandledRejection', (reason) => {
    writeLog('Unhandled rejection in main process.', reason)
  })

  if (sqliteLoadError) {
    writeLog('SQLite module unavailable, using JSON fallback storage.', sqliteLoadError)
  }

  registerStorageHandlers()

  const window = createWindow(getSplashUrl('Starting Eridian...'))
  await loadWindowContent(window)
  
  startMcpServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createWindow(getSplashUrl('Starting Eridian...'))
      loadWindowContent(nextWindow)
    }
  })
}).catch((error) => {
  writeLog('Fatal startup error.', error)
  showStartupError(error)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  productionServerProcess?.kill()
  db?.close()
})
