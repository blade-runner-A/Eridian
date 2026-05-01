'use client'

import dynamic from 'next/dynamic'
import type { BinaryFileData, DataURL, ExcalidrawImperativeAPI, FileId } from '@excalidraw/excalidraw/types'
import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Sparkles } from 'lucide-react'
import { AiBar } from './ai-assistant'
import { PwaInstallButton } from './pwa-install-button'

type SceneElement = Record<string, unknown>
type EmbeddableRenderData = {
  allowSameOrigin?: boolean
  src?: string
  srcDoc?: string
}
type PdfImportProgress = {
  isImporting: boolean
  current: number
  total: number
}

type PdfPageAsset = {
  dataURL: DataURL
  width: number
  height: number
}

function createEmbeddableDocument(body: string) {
  return `<!doctype html><html><body style="margin:0">${body}</body></html>`
}

function getEmbeddableRenderData(link: string, theme: 'light' | 'dark'): EmbeddableRenderData {
  const youtubeMatch = link.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i,
  )

  if (youtubeMatch?.[1]) {
    return {
      allowSameOrigin: true,
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1`,
    }
  }

  const vimeoMatch = link.match(/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i)

  if (vimeoMatch?.[1]) {
    return {
      allowSameOrigin: true,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?api=1`,
    }
  }

  if (/^https:\/\/(?:www\.)?figma\.com\//i.test(link)) {
    return {
      allowSameOrigin: true,
      src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(link)}`,
    }
  }

  const xMatch = link.match(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i)

  if (xMatch?.[1]) {
    return {
      allowSameOrigin: true,
      srcDoc: createEmbeddableDocument(
        `<blockquote class="twitter-tweet" data-dnt="true" data-theme="${theme}"><a href="https://twitter.com/x/status/${xMatch[1]}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"><\/script>`,
      ),
    }
  }

  const redditMatch = link.match(
    /^(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/i,
  )

  if (redditMatch) {
    const [, subreddit, postId, slug] = redditMatch

    return {
      allowSameOrigin: true,
      srcDoc: createEmbeddableDocument(
        `<blockquote class="reddit-embed-bq" data-embed-theme="${theme}"><a href="https://reddit.com/r/${subreddit}/comments/${postId}/${slug}"></a><br></blockquote><script async src="https://embed.reddit.com/widgets.js" charset="UTF-8"><\/script>`,
      ),
    }
  }

  return {
    allowSameOrigin: /^https?:\/\//i.test(link),
    src: link,
  }
}

const ExcalidrawCanvas = dynamic(
  async () => {
    const { Excalidraw, WelcomeScreen, MainMenu } = await import('@excalidraw/excalidraw')

    return function ExcalidrawCanvas(props: any) {
      const { setShowAiPanel, ...rest } = props
      return (
        <Excalidraw
          {...rest}
          renderEmbeddable={(element: SceneElement, appState: { theme?: string }) => {
            const normalizedLink = normalizeEmbeddableLink(typeof element.link === 'string' ? element.link : null)

            if (!normalizedLink) {
              return null
            }

            const embed = getEmbeddableRenderData(normalizedLink, appState.theme === 'dark' ? 'dark' : 'light')
            const sandbox = `${embed.allowSameOrigin ? 'allow-same-origin ' : ''}allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`
            const sharedStyle = {
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
              backgroundColor: 'transparent',
            }

            if (window.eridianDesktop?.platform && window.eridianDesktop.platform !== 'web' && embed.src && !embed.srcDoc) {
              return createElement('webview', {
                src: embed.src,
                className: 'excalidraw__embeddable',
                style: sharedStyle,
                partition: 'persist:eridian-embeds',
                referrerpolicy: 'no-referrer-when-downgrade',
                allowpopups: '',
              } as Record<string, unknown>)
            }

            return (
              <iframe
                className="excalidraw__embeddable"
                style={sharedStyle}
                srcDoc={embed.srcDoc}
                src={embed.src}
                scrolling="no"
                referrerPolicy="no-referrer-when-downgrade"
                title="Eridian Embedded Content"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sandbox={sandbox}
              />
            )
          }}
        >
          <WelcomeScreen>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Logo>
                <div className="spectralboard-welcome-logo" aria-hidden="true">
                  <img src="/icon.svg" alt="" />
                </div>
              </WelcomeScreen.Center.Logo>
              <WelcomeScreen.Center.Heading>
                <span className="spectralboard-welcome-title">Eridian</span>
              </WelcomeScreen.Center.Heading>
              <div className="spectralboard-welcome-copy">
                <p>Local-first sketching with a sharper little edge.</p>
                <div className="spectralboard-welcome-features">
                  <span>Auto-saves locally</span>
                  <span>Installable PWA</span>
                  <span>Brutalist tool skin</span>
                </div>
              </div>
            </WelcomeScreen.Center>
          </WelcomeScreen>
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.LiveCollaborationTrigger
              isCollaborating={false}
              onSelect={() => {}}
            />
            <MainMenu.DefaultItems.CommandPalette />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.Separator />
            <MainMenu.Item
              icon={<Sparkles size={16} />}
              onSelect={() => setShowAiPanel?.(true)}
            >
              AI Assistant
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Help />
            <MainMenu.Separator />
            <MainMenu.ItemCustom>
              <a
                href="https://github.com/eridian-sketch/eridian"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: 'inherit', textDecoration: 'none', fontSize: '14px' }}
              >
                GitHub
              </a>
            </MainMenu.ItemCustom>
            <MainMenu.DefaultItems.ClearCanvas />
          </MainMenu>
        </Excalidraw>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading canvas...</div>,
  },
)

const APP_NAME = 'Eridian'
const STORAGE_KEY = 'eridian-scene'
const LEGACY_STORAGE_KEY = 'spectralboard-scene'
const SCENE_ID = 'default'
const PDF_MAX_TARGET_WIDTH = 1200
const PDF_MIN_TARGET_WIDTH = 720
const PDF_PAGE_GAP_RATIO = 0.08
const PDF_MIN_PAGE_GAP = 48
const PDF_RENDER_SCALE_LIMIT = 2
const PDF_DEVICE_SCALE_LIMIT = 2

type EridianTheme = 'light' | 'dark'

function cleanAppState(appState: Record<string, unknown>) {
  const { collaborators, ...serializableAppState } = appState

  return serializableAppState
}

function normalizeEmbeddableLink(link: string | null | undefined) {
  if (typeof link !== 'string') {
    return null
  }

  const trimmedLink = link.trim()

  if (!trimmedLink || trimmedLink.startsWith('/')) {
    return trimmedLink || null
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedLink)) {
    return trimmedLink
  }

  if (trimmedLink.startsWith('//')) {
    return `https:${trimmedLink}`
  }

  if (/\s/.test(trimmedLink)) {
    return trimmedLink
  }

  try {
    return new URL(`https://${trimmedLink}`).toString()
  } catch {
    return trimmedLink
  }
}

function normalizeSceneEmbeddables<T extends SceneElement>(elements: readonly T[]) {
  let didChange = false

  const normalizedElements = elements.map((element) => {
    if (element.type !== 'embeddable' || typeof element.link !== 'string') {
      return element
    }

    const normalizedLink = normalizeEmbeddableLink(element.link)

    if (!normalizedLink || normalizedLink === element.link) {
      return element
    }

    didChange = true
    return {
      ...element,
      link: normalizedLink,
    }
  })

  return {
    didChange,
    elements: normalizedElements,
  }
}

function createPdfFileId(pageNumber: number): FileId {
  const randomSeed = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(16).slice(2)
  return `pdf-${Date.now()}-${pageNumber}-${randomSeed}` as FileId
}

function getPdfTargetWidth() {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : PDF_MAX_TARGET_WIDTH
  const viewportScale = viewportWidth < 900 ? 0.9 : 0.7
  const preferred = Math.round(viewportWidth * viewportScale)
  return Math.min(PDF_MAX_TARGET_WIDTH, Math.max(PDF_MIN_TARGET_WIDTH, preferred))
}

function getPdfPageGap(targetWidth: number) {
  return Math.max(PDF_MIN_PAGE_GAP, Math.round(targetWidth * PDF_PAGE_GAP_RATIO))
}

function getStorageBridge() {
  return window.eridianStorage ?? window.spectralboardStorage
}

async function loadStoredScene() {
  const storage = getStorageBridge()

  if (storage) {
    return storage.loadScene(SCENE_ID)
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
}

async function saveStoredScene(data: string) {
  const storage = getStorageBridge()

  if (storage) {
    await storage.saveScene(SCENE_ID, data)
    return
  }

  window.localStorage.setItem(STORAGE_KEY, data)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function Sketchboard() {
  const shellRef = useRef<HTMLDivElement>(null)
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const pdfImportIdRef = useRef(0)
  const skipSaveRef = useRef(false)
  const progressStampRef = useRef(0)
  const [theme, setTheme] = useState<EridianTheme>('light')
  const [platform, setPlatform] = useState('web')
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null)
  const [pdfImport, setPdfImport] = useState<{ isImporting: boolean; current: number; total: number }>({
    isImporting: false,
    current: 0,
    total: 0,
  })
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showCover, setShowCover] = useState(true)

  useEffect(() => {
    setPlatform(window.eridianDesktop?.platform ?? 'web')
  }, [])

  useEffect(() => {
    const shell = shellRef.current

    if (!shell) {
      return
    }

    const updateTheme = () => {
      const excalidraw = shell.querySelector('.excalidraw')

      if (!excalidraw) {
        return
      }

      setTheme(excalidraw.classList.contains('theme--dark') ? 'dark' : 'light')
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(shell, { attributes: true, attributeFilter: ['class'], subtree: true })

    return () => observer.disconnect()
  }, [])

  const findToolbar = useCallback(() => {
    const shell = shellRef.current
    if (!shell) return null
    return (
      shell.querySelector<HTMLElement>('.excalidraw .App-toolbar .Stack') ||
      shell.querySelector<HTMLElement>('.excalidraw .App-toolbar-content') ||
      shell.querySelector<HTMLElement>('.excalidraw .App-toolbar')
    )
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const check = () => {
      const toolbar = findToolbar()
      if (toolbar && toolbar !== toolbarHost) {
        setToolbarHost(toolbar)
      }
    }

    check()
    const observer = new MutationObserver(check)
    observer.observe(shell, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [findToolbar, toolbarHost])

  const persistScene = useCallback((
    elements: readonly Record<string, unknown>[],
    appState: Record<string, unknown>,
    files: Record<string, unknown>,
  ) => {
    void saveStoredScene(
      JSON.stringify({
        elements,
        appState: cleanAppState(appState),
        files,
        type: 'excalidraw',
        version: 2,
      }),
    )
  }, [])

  const persistSceneFromApi = useCallback((api: ExcalidrawImperativeAPI) => {
    const appState = api.getAppState()
    const elements = api.getSceneElements()
    const files = api.getFiles()
    persistScene(elements, appState, files)
  }, [persistScene])

  const updatePdfProgress = useCallback((current: number, total: number, force = false) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

    if (!force && now - progressStampRef.current < 140) {
      return
    }

    progressStampRef.current = now
    setPdfImport({ isImporting: true, current, total })
  }, [])

  const triggerPdfPicker = useCallback(() => {
    if (!pdfInputRef.current || pdfImport.isImporting) {
      return
    }

    pdfInputRef.current.click()
  }, [pdfImport.isImporting])

  const importPdfAllPages = useCallback(async (file: File) => {
    const api = excalidrawApiRef.current

    if (!api) {
      return
    }

    const jobId = pdfImportIdRef.current + 1
    pdfImportIdRef.current = jobId
    skipSaveRef.current = true
    setPdfImport({ isImporting: true, current: 0, total: 0 })

    let loadingTask: { destroy?: () => Promise<void> | void } | null = null

    try {
      const yieldToBrowser = async () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
      }

      const { CaptureUpdateAction, convertToExcalidrawElements, MIME_TYPES, viewportCoordsToSceneCoords } =
        await import('@excalidraw/excalidraw')
      const data = await file.arrayBuffer()
      loadingTask = pdfjs.getDocument({ data })
      const pdf = await loadingTask.promise

      if (jobId !== pdfImportIdRef.current) {
        return
      }

      const totalPages = pdf.numPages

      if (!totalPages) {
        api.setToast({ message: 'This PDF has no pages to import.', duration: 4000 })
        return
      }

      updatePdfProgress(0, totalPages, true)

      const pageAssets: PdfPageAsset[] = []

      const targetWidth = getPdfTargetWidth()
      const pageGap = getPdfPageGap(targetWidth)

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (jobId !== pdfImportIdRef.current) {
          return
        }

        const page = await pdf.getPage(pageNumber)
        const baseViewport = page.getViewport({ scale: 1 })
        const targetScale = Math.min(PDF_RENDER_SCALE_LIMIT, targetWidth / baseViewport.width)
        const scale = Number.isFinite(targetScale) && targetScale > 0 ? targetScale : 1
        const renderScale = Math.min(PDF_DEVICE_SCALE_LIMIT, Math.max(1, window.devicePixelRatio || 1))
        const renderViewport = page.getViewport({ scale: scale * renderScale })
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Unable to render PDF page.')
        }

        canvas.width = Math.ceil(renderViewport.width)
        canvas.height = Math.ceil(renderViewport.height)

        const renderTask = page.render({ canvasContext: context, viewport: renderViewport })
        await renderTask.promise

        const dataURL = canvas.toDataURL(MIME_TYPES.png) as DataURL

        page.cleanup?.()

        pageAssets.push({
          dataURL,
          width: viewport.width,
          height: viewport.height,
        })

        if (jobId !== pdfImportIdRef.current) {
          return
        }

        updatePdfProgress(pageNumber, totalPages, pageNumber === totalPages)
        if (pageNumber % 2 === 0) {
          await yieldToBrowser()
        }
      }

      if (jobId !== pdfImportIdRef.current) {
        return
      }

      const appState = api.getAppState()
      const center = viewportCoordsToSceneCoords(
        { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 },
        {
          zoom: appState.zoom,
          offsetLeft: appState.offsetLeft,
          offsetTop: appState.offsetTop,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        },
      )
      const totalWidth =
        pageAssets.reduce((sum, page) => sum + page.width, 0) + pageGap * Math.max(0, pageAssets.length - 1)
      const maxHeight = pageAssets.reduce((max, page) => Math.max(max, page.height), 0)
      let currentX = center.x - totalWidth / 2
      const startY = center.y - maxHeight / 2

      const files: BinaryFileData[] = []
      const skeletons = pageAssets.map((page, index) => {
        const fileId = createPdfFileId(index + 1)
        files.push({
          id: fileId,
          dataURL: page.dataURL,
          mimeType: MIME_TYPES.png,
          created: Date.now(),
        })

        const element = {
          type: 'image',
          x: currentX,
          y: startY,
          width: page.width,
          height: page.height,
          fileId,
          status: 'saved',
          scale: [1, 1] as [number, number],
        }

        currentX += page.width + pageGap
        return element
      })

      const newElements = convertToExcalidrawElements(skeletons, { regenerateIds: true })
      api.addFiles(files)
      api.updateScene({
        elements: [...api.getSceneElements(), ...newElements],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
      persistSceneFromApi(api)
      api.scrollToContent(newElements, { fitToContent: true, animate: true })
      api.setToast({
        message: `Imported ${totalPages} PDF page${totalPages === 1 ? '' : 's'}.`,
        duration: 4000,
      })
    } catch (error) {
      console.error('PDF import failed', error)
      excalidrawApiRef.current?.setToast({
        message: 'PDF import failed. Please try another file.',
        duration: 6000,
      })
    } finally {
      skipSaveRef.current = false
      if (pdfImportIdRef.current === jobId) {
        setPdfImport({ isImporting: false, current: 0, total: 0 })
      }

      if (loadingTask?.destroy) {
        await loadingTask.destroy()
      }
    }
  }, [])

  const handlePdfInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file) {
        return
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      if (!isPdf) {
        excalidrawApiRef.current?.setToast({
          message: 'Please select a PDF file to import.',
          duration: 4000,
        })
        return
      }

      await importPdfAllPages(file)
    },
    [importPdfAllPages],
  )
  
  const handleAddAiElements = useCallback(async (skeletons: any[]) => {
    const api = excalidrawApiRef.current
    if (!api) return

    const { convertToExcalidrawElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    
    const newElements = convertToExcalidrawElements(skeletons, { regenerateIds: true })
    api.updateScene({
      elements: [...api.getSceneElements(), ...newElements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
    persistSceneFromApi(api)
    api.scrollToContent(newElements, { fitToContent: true, animate: true })
  }, [persistSceneFromApi])

  useEffect(() => {
    const ext = (window as any).eridianExternal
    if (!ext) return

    ext.onToolCall(async ({ id, method, params }: { id: number; method: string; params: any }) => {
      try {
        if (method === 'add_elements') {
          await handleAddAiElements(params.elements)
          ext.sendToolResult(id, { success: true })
        } else if (method === 'clear_canvas') {
          const api = excalidrawApiRef.current
          if (api) {
            api.updateScene({ elements: [] })
            persistSceneFromApi(api)
          }
          ext.sendToolResult(id, { success: true })
        } else {
          ext.sendToolResult(id, { error: 'Unknown method' })
        }
      } catch (err) {
        ext.sendToolResult(id, { error: String(err) })
      }
    })
  }, [handleAddAiElements, persistSceneFromApi])


  const toolbarButton = toolbarHost
    ? createPortal(
        <div className="eridian-pdf-toolbar-slot">
          <div className="App-toolbar__divider" />
          <button
            type="button"
            className="eridian-pdf-toolbar-button"
            onClick={triggerPdfPicker}
            disabled={pdfImport.isImporting}
            aria-busy={pdfImport.isImporting}
            title="Import a PDF and lay out all pages side-by-side"
          >
            <FileText size={18} strokeWidth={2.5} />
            {pdfImport.isImporting && (
              <span className="eridian-pdf-toolbar-badge">
                {pdfImport.current}/{pdfImport.total}
              </span>
            )}
          </button>
        </div>,
        toolbarHost,
      )
    : null

  return (
    <div
      ref={shellRef}
      className="eridian-shell spectralboard relative h-dvh w-full overflow-hidden bg-background"
      data-eridian-platform={platform}
      data-eridian-theme={theme}
    >
      {showCover && (
        <div className="eridian-cover">
          <div className="eridian-cover__overlay" />
          <div className="eridian-cover__content">
            <div className="eridian-cover__logo-wrapper">
              <img src="/icon.svg" alt="Eridian" className="eridian-cover__logo" />
              <div className="eridian-cover__glow" />
            </div>
            <h1 className="eridian-cover__title">ERIDIAN</h1>
            <p className="eridian-cover__tagline">Local-first sketching with a sharper little edge.</p>
            <button
              className="eridian-cover__enter"
              onClick={() => setShowCover(false)}
            >
              Enter Eridian
            </button>
          </div>
          <div className="eridian-cover__footer">
            v1.0.0 • Local LLM Enabled
          </div>
        </div>
      )}
      <header className="eridian-titlebar" aria-label="Eridian">
        <div className="eridian-titlebar__brand">
          <img className="eridian-titlebar__logo" src="/icon.svg" alt="" aria-hidden="true" />
          <span>Eridian</span>
        </div>
        <div className="eridian-titlebar__actions">
          <PwaInstallButton />
        </div>
      </header>
      <main className="eridian-canvas">
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={handlePdfInputChange}
        />
        {toolbarButton}
        {showAiPanel && <AiBar onAddElements={handleAddAiElements} onClose={() => setShowAiPanel(false)} />}
        <ExcalidrawCanvas
          setShowAiPanel={setShowAiPanel}
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
            excalidrawApiRef.current = api
            findToolbar()
          }}
          renderTopRightUI={(isMobile) => {
            if (!isMobile && toolbarHost) {
              return null
            }

            return (
              <div className="eridian-pdf-controls">
                <button
                  type="button"
                  className="eridian-pdf-button"
                  onClick={triggerPdfPicker}
                  disabled={pdfImport.isImporting}
                  aria-busy={pdfImport.isImporting}
                  title="Import a PDF and lay out all pages side-by-side"
                >
                  <span className="eridian-pdf-button__label">
                    {pdfImport.isImporting
                      ? `Importing ${pdfImport.current}/${pdfImport.total}`
                      : isMobile
                        ? 'PDF'
                        : 'Import PDF'}
                  </span>
                  {!isMobile && (
                    <span className="eridian-pdf-button__sub">
                      {pdfImport.isImporting ? 'Rendering pages' : 'All pages side-by-side'}
                    </span>
                  )}
                </button>
              </div>
            )
          }}
          UIOptions={{
            welcomeScreen: true,
            canvasActions: {
              toggleCanvasMenu: true,
              toggleCommandPalette: true,
            },
          }}
          validateEmbeddable={true}
          initialData={async () => {
            const savedScene = await loadStoredScene()

            if (!savedScene) {
              return {
                appState: {
                  name: APP_NAME,
                  currentItemBackgroundColor: '#dff7ff',
                  currentItemStrokeColor: '#132235',
                  showWelcomeScreen: true,
                },
              }
            }

            try {
              const parsedScene = JSON.parse(savedScene)
              const storedElements = Array.isArray(parsedScene.elements) ? parsedScene.elements : []
              const normalizedScene = normalizeSceneEmbeddables(storedElements)
              const elements = normalizedScene.elements
              const hasElements = elements.some((element: Record<string, unknown>) => !element.isDeleted)
              const appState = parsedScene.appState ? cleanAppState(parsedScene.appState) : {}

              return {
                ...parsedScene,
                elements,
                appState: {
                  ...appState,
                  showWelcomeScreen: !hasElements,
                },
              }
            } catch {
              window.localStorage.removeItem(STORAGE_KEY)
              window.localStorage.removeItem(LEGACY_STORAGE_KEY)

              return null
            }
          }}
          onChange={(
            elements: readonly Record<string, unknown>[],
            appState: Record<string, unknown>,
            files: Record<string, unknown>,
          ) => {
            const normalizedScene = normalizeSceneEmbeddables(elements)

            if (normalizedScene.didChange) {
              excalidrawApiRef.current?.updateScene({
                elements: normalizedScene.elements,
                captureUpdate: 'EVENTUALLY',
              })
            }

            if (!skipSaveRef.current) {
              persistScene(normalizedScene.elements, appState, files)
            }
          }}
        />
      </main>
    </div>
  )
}
