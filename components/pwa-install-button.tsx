'use client'

import React, { useState, useEffect } from 'react'
import { Share, PlusSquare, Download } from 'lucide-react'

export function PwaInstallButton() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true)
      return
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIos && !(window.navigator as any).standalone) {
      setIsInstallable(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstallClick = () => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    
    if (isIos) {
      setShowIosHint(true)
    } else if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setIsInstallable(false)
        }
        setDeferredPrompt(null)
      })
    }
  }

  if (isStandalone || !isInstallable) return null

  return (
    <>
      <button 
        onClick={handleInstallClick}
        className="eridian-pwa-install-btn"
        title="Install Eridian"
      >
        <Download size={16} />
        <span>Install App</span>
      </button>

      {showIosHint && (
        <div className="eridian-pwa-ios-modal" onClick={() => setShowIosHint(false)}>
          <div className="eridian-pwa-ios-content" onClick={e => e.stopPropagation()}>
            <h3>Install Eridian on iPad</h3>
            <p>To install Eridian as a standalone app:</p>
            <ol>
              <li>Tap the <strong>Share</strong> icon <Share size={18} className="inline-icon" /> in Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={18} className="inline-icon" />.</li>
            </ol>
            <button onClick={() => setShowIosHint(false)} className="eridian-pwa-ios-close">Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
