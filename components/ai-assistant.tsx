'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Loader2, Send, Wand2 } from 'lucide-react'

interface AiBarProps {
  onAddElements: (elements: any[]) => void
  onClose: () => void
}

export function AiBar({ onAddElements, onClose }: AiBarProps) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const PRESETS = [
    { label: 'Flowchart', icon: <Wand2 size={12} />, prompt: 'Create a clean flowchart for a basic user authentication flow.' },
    { label: 'Mind Map', icon: <Wand2 size={12} />, prompt: 'Generate a mind map for a product launch strategy.' },
    { label: 'Sequence', icon: <Wand2 size={12} />, prompt: 'Draw a sequence diagram for a client-server API request.' },
    { label: 'Dashboard', icon: <Wand2 size={12} />, prompt: 'Design a simple dashboard layout with a header, sidebar, and 4 cards.' },
  ]

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    try {
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant for Eridian, a brutalist sketching tool built on Excalidraw.
Your goal is to help users create diagrams, notes, and layouts.
You must return a JSON object with a list of Excalidraw elements to be added to the scene.

Excalidraw Element Schema:
- type: "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "text"
- x, y: numbers (coordinates)
- width, height: numbers
- strokeColor: string (default "#111111")
- backgroundColor: string (default "transparent")
- strokeWidth: number (default 2)
- strokeStyle: "solid" | "dashed" | "dotted"
- roughness: number (0-2, default 1)
- opacity: number (0-100, default 100)

Text Element specific:
- text: string
- fontSize: number (default 20)
- fontFamily: 1 (Virgil), 2 (Helvetica), 3 (Cascadia)
- textAlign: "left" | "center" | "right"

Context: The user wants to create something based on their prompt. Provide a coherent set of elements.
Coordinates should be centered around (0,0) or reasonable offsets.

Example Output:
{
  "elements": [
    {
      "type": "rectangle",
      "x": 0,
      "y": 0,
      "width": 200,
      "height": 100,
      "backgroundColor": "#d8ff35"
    }
  ]
}

Always respond in ONLY valid JSON format.`
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const result = await (window as any).eridianAI.chat(messages)
      
      let elements = []
      try {
        const content = result.message.content
        const parsed = typeof content === 'string' ? JSON.parse(content) : content
        elements = parsed.elements || []
      } catch (parseError) {
        console.error('Failed to parse AI response', parseError)
      }

      if (elements.length > 0) {
        onAddElements(elements)
        setPrompt('')
      }
    } catch (error) {
      console.error('AI request failed', error)
    } finally {
      setIsLoading(false)
    }
  }, [prompt, isLoading, onAddElements])

  if (!mounted) return null

  return createPortal(
    <div className="eridian-ai-assistant-root">
      <div className="eridian-ai-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="eridian-ai-sidebar__container">
          <div className="eridian-ai-sidebar__header">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent-alt" />
              <span>AI ASSISTANT</span>
            </div>
            <button onClick={onClose} className="eridian-ai-sidebar__close" aria-label="Close">
              &times;
            </button>
          </div>
          
          <div className="eridian-ai-sidebar__content">
            <p className="eridian-ai-sidebar__hint">
              Describe what you want to draw. The AI will generate Excalidraw elements for you.
            </p>

            <div className="eridian-ai-sidebar__presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="eridian-ai-sidebar__preset-btn"
                  onClick={() => setPrompt(preset.prompt)}
                  disabled={isLoading}
                >
                  {preset.icon}
                  {preset.label}
                </button>
              ))}
            </div>
            
            <form onSubmit={handleSubmit} className="eridian-ai-sidebar__form">
              <div className="eridian-ai-sidebar__input-wrapper">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="e.g. Draw a flowchart for a coffee machine..."
                  className="eridian-ai-sidebar__input"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="eridian-ai-sidebar__submit"
                disabled={!prompt.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="mr-2" size={18} />
                    Generate
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="eridian-ai-sidebar__footer">
            Powered by Ollama & MCP
          </div>
        </div>
      </div>
      <div className="eridian-ai-sidebar__overlay" onClick={onClose} />
    </div>,
    document.body
  )
}
