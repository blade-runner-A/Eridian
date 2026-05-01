'use client'

import { useEffect } from 'react'

export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister())
      })

      window.caches?.keys().then((cacheNames) => {
        cacheNames
          .filter((cacheName) => cacheName.startsWith('spectralboard-') || cacheName.startsWith('eridian-'))
          .forEach((cacheName) => window.caches.delete(cacheName))
      })

      return
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Eridian service worker registration failed', error)
    })
  }, [])

  return null
}
