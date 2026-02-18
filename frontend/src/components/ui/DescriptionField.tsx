import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RichTextEditor } from './RichTextEditor'

export function isEmptyHtml(html: string): boolean {
  return !html || html === '<p></p>' || html.trim() === ''
}

const DESC_PANEL_WIDTH = 380
const DESC_PANEL_GAP = 12

interface DescriptionFieldProps {
  value: string
  onChange: (v: string) => void
  accentColor: string
  /** Ref do kontenera modalu — do obliczania pozycji panelu */
  modalRef: React.RefObject<HTMLDivElement>
}

export function DescriptionField({
  value,
  onChange,
  accentColor,
  modalRef,
}: DescriptionFieldProps) {
  const [open, setOpen] = useState(false)
  // draft + ref — setState jest async, confirm() czyta z ref żeby zawsze mieć świeże dane
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const computePosition = useCallback(() => {
    const modal = modalRef.current
    if (!modal) return
    const rect = modal.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const panelH = Math.min(520, vh - 32)
    const top = Math.max(16, Math.min(rect.top, vh - panelH - 16))
    const spaceRight = vw - rect.right - DESC_PANEL_GAP
    const spaceLeft = rect.left - DESC_PANEL_GAP
    let left: number
    if (spaceRight >= DESC_PANEL_WIDTH) {
      left = rect.right + DESC_PANEL_GAP
    } else if (spaceLeft >= DESC_PANEL_WIDTH) {
      left = rect.left - DESC_PANEL_GAP - DESC_PANEL_WIDTH
    } else {
      left = Math.max(16, (vw - DESC_PANEL_WIDTH) / 2)
    }
    setPanelStyle({ position: 'fixed', top, left, width: DESC_PANEL_WIDTH, height: panelH, zIndex: 200 })
  }, [modalRef])

  function openEditor() {
    draftRef.current = value
    setDraft(value)
    setOpen(true)
  }

  function confirm() {
    onChange(draftRef.current)
    setOpen(false)
  }

  function cancel() {
    setOpen(false)
  }

  useEffect(() => {
    if (open) computePosition()
  }, [open, computePosition])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Podgląd — strip HTML tagów
  const previewText = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const hasContent = !isEmptyHtml(value)

  // Policz checkboxy
  const totalTasks = (value.match(/data-type="taskItem"/g) ?? []).length
  const doneTasks = (value.match(/data-checked="true"/g) ?? []).length

  return (
    <>
      {/* Podgląd — klikalne pole */}
      <div
        role="button"
        tabIndex={0}
        onClick={openEditor}
        onKeyDown={e => e.key === 'Enter' && openEditor()}
        className="relative w-full border border-gray-200 rounded-xl px-3 pt-6 pb-2 text-sm cursor-pointer hover:border-gray-300 transition-colors min-h-[72px]"
        style={{ borderColor: open ? accentColor : '' }}
      >
        <span className="absolute top-2 left-3 text-xs font-medium text-gray-400">Opis</span>
        {!hasContent ? (
          <span className="text-gray-300 text-sm">Notatki, wskazówki…</span>
        ) : (
          <div className="space-y-0.5">
            {totalTasks > 0 && (
              <div className="text-xs text-gray-500">☑ {doneTasks}/{totalTasks} zadań</div>
            )}
            <div className="text-sm text-gray-700 line-clamp-3">{previewText}</div>
          </div>
        )}
        <span className="absolute bottom-2 right-3 text-xs text-gray-300">kliknij aby edytować</span>
      </div>

      {/* Popup WYSIWYG — pozycjonowany dynamicznie obok modalu */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[199]" onClick={cancel} />
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[200]"
            style={panelStyle}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <span className="text-sm font-semibold text-gray-700">Opis</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">Ctrl+Enter · Esc</span>
                <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
            </div>

            {/* Edytor WYSIWYG */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <RichTextEditor
                value={draft}
                onChange={(html) => { draftRef.current = html; setDraft(html) }}
                accentColor={accentColor}
                onCtrlEnter={confirm}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 shrink-0">
              <button
                onClick={cancel}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirm}
                className="px-3 py-1.5 text-sm text-white rounded-xl font-semibold transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
