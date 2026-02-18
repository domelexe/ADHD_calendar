import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { RichTextEditor, isEmptyHtml } from '../ui/RichTextEditor'
import { Event, ActivityTemplate } from '../../types'
import { eventsApi } from '../../api/events'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendarStore } from '../../store/calendarStore'
import { IconRenderer, formatIconId } from '../ui/IconRenderer'
import { getIconSetConfig } from '../../lib/iconSets'

const COLOR_OPTIONS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#14b8a6', '#10b981', '#22c55e', '#84cc16',
  '#eab308', '#f59e0b', '#f97316', '#ef4444',
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7',
  '#8b5cf6', '#7c3aed', '#64748b', '#1e293b',
]

interface EventModalProps {
  mode: 'create' | 'edit'
  event?: Event
  defaultStart?: string
  defaultTemplateId?: number
  templates: ActivityTemplate[]
  onClose: () => void
  onSave: (data: Partial<Event>) => void
  onDelete?: () => void
  onPin?: (weeksAhead: number) => void
}

function toLocalDatetimeInput(isoStr: string): string {
  const d = new Date(isoStr)
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

function fromLocalDatetimeInput(local: string): string {
  return new Date(local).toISOString()
}

export function EventModal({
  mode,
  event,
  defaultStart,
  defaultTemplateId,
  templates,
  onClose,
  onSave,
  onDelete,
  onPin,
}: EventModalProps) {
  const qc = useQueryClient()
  const iconSet = useCalendarStore((s) => s.iconSet)
  const iconSetConfig = useMemo(() => getIconSetConfig(iconSet), [iconSet])
  const colorInputRef = useRef<HTMLInputElement>(null)

  const defaultStartStr = defaultStart
    ? toLocalDatetimeInput(defaultStart)
    : toLocalDatetimeInput(new Date().toISOString())

  const defaultEnd = defaultStart
    ? (() => {
        const d = new Date(defaultStart)
        d.setMinutes(d.getMinutes() + 60)
        return toLocalDatetimeInput(d.toISOString())
      })()
    : toLocalDatetimeInput(new Date().toISOString())

  const [title, setTitle] = useState(event?.title ?? '')
  const [startDt, setStartDt] = useState(event ? toLocalDatetimeInput(event.start_datetime) : defaultStartStr)
  const [endDt, setEndDt] = useState(event ? toLocalDatetimeInput(event.end_datetime) : defaultEnd)
  const [templateId] = useState<number | ''>(
    event?.activity_template_id ?? defaultTemplateId ?? '',
  )

  // Kolor, ikona, opis — z szablonu jeśli nie nadpisane per-event
  const selectedTplForInit = templates.find((t) => t.id === (event?.activity_template_id ?? defaultTemplateId))

  const [description, setDescription] = useState(event?.description ?? selectedTplForInit?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [isBackground, setIsBackground] = useState(event?.is_background ?? false)
  const [color, setColor] = useState<string>(event?.color ?? selectedTplForInit?.color ?? '#6366f1')
  const [icon, setIcon] = useState<string>(event?.icon ?? selectedTplForInit?.icon ?? '')
  const [iconSearch, setIconSearch] = useState('')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const filteredIcons = useMemo(() => {
    const q = iconSearch.toLowerCase()
    if (!q) return iconSetConfig.icons.slice(0, 48)
    return iconSetConfig.icons.filter(ic => ic.toLowerCase().includes(q)).slice(0, 48)
  }, [iconSetConfig, iconSearch])

  // Zaawansowane (daty + czas trwania)
  const [advOpen, setAdvOpen] = useState(false)

  // Czas trwania w minutach — synchronizowany z startDt/endDt
  const calcDuration = () => {
    const s = new Date(startDt)
    const e = new Date(endDt)
    return Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000))
  }
  const [durationMin, setDurationMin] = useState<number>(calcDuration)

  const handleStartChange = (val: string) => {
    setStartDt(val)
    // Przesuń koniec zachowując czas trwania
    const newEnd = new Date(new Date(val).getTime() + durationMin * 60000)
    setEndDt(format(newEnd, "yyyy-MM-dd'T'HH:mm"))
  }

  const handleEndChange = (val: string) => {
    setEndDt(val)
    // Przelicz czas trwania
    const dur = Math.max(15, Math.round((new Date(val).getTime() - new Date(startDt).getTime()) / 60000))
    setDurationMin(dur)
  }

  const handleDurationChange = (mins: number) => {
    const clamped = Math.max(15, mins)
    setDurationMin(clamped)
    // Przesuń koniec
    const newEnd = new Date(new Date(startDt).getTime() + clamped * 60000)
    setEndDt(format(newEnd, "yyyy-MM-dd'T'HH:mm"))
  }

  const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180]

  // ── Pin ────────────────────────────────────────────────────────────────────
  const [pinOpen, setPinOpen] = useState(false)
  const [pinCustomWeeks, setPinCustomWeeks] = useState<string>('')
  const [pinShowCustom, setPinShowCustom] = useState(false)
  // Przy trybie create: zapamiętaj wybrane tygodnie do zastosowania po zapisie
  const [pinWeeksOnCreate, setPinWeeksOnCreate] = useState<number | null>(null)
  const pinPanelRef = useRef<HTMLDivElement>(null)

  // Zamknij Pin panel klikając poza nim
  useEffect(() => {
    if (!pinOpen) return
    const handler = (e: MouseEvent) => {
      if (pinPanelRef.current && !pinPanelRef.current.contains(e.target as Node)) {
        setPinOpen(false)
        setPinShowCustom(false)
        setPinCustomWeeks('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pinOpen])

  // Escape zamyka modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePinSelect = (weeks: number) => {
    if (mode === 'edit') {
      onPin?.(weeks)
      setPinOpen(false)
      onClose()
    } else {
      // tryb create: zapamiętaj ile tygodni, pin wykona się po zapisaniu eventu
      setPinWeeksOnCreate(weeks)
      setPinOpen(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !startDt || !endDt) return
    const data = {
      title: title.trim(),
      start_datetime: fromLocalDatetimeInput(startDt),
      end_datetime: fromLocalDatetimeInput(endDt),
      activity_template_id: templateId !== '' ? templateId : undefined,
      description: description || undefined,
      location: location || undefined,
      is_background: isBackground,
      color,
      icon: icon || undefined,
    }

    if (mode === 'create' && pinWeeksOnCreate !== null) {
      // Stwórz event + pin (duplikaty na kolejne tygodnie)
      const created = await eventsApi.create(data as Parameters<typeof eventsApi.create>[0])
      const durationMs = new Date(created.end_datetime).getTime() - new Date(created.start_datetime).getTime()
      const start = new Date(created.start_datetime)
      const promises = Array.from({ length: pinWeeksOnCreate }, (_, i) => {
        const newStart = new Date(start.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000)
        const newEnd = new Date(newStart.getTime() + durationMs)
        return eventsApi.create({
          title: created.title,
          start_datetime: newStart.toISOString(),
          end_datetime: newEnd.toISOString(),
          activity_template_id: created.activity_template_id,
          description: created.description,
          location: created.location,
        } as Parameters<typeof eventsApi.create>[0])
      })
      await Promise.all(promises)
      qc.invalidateQueries({ queryKey: ['events'] })
      onClose()
    } else {
      onSave(data)
    }
  }

  const accentColor = color

  const PIN_PRESETS = [
    { w: 1, label: 'Następny tydzień' },
    { w: 2, label: '2 tygodnie do przodu' },
    { w: 3, label: '3 tygodnie do przodu' },
    { w: 4, label: '4 tygodnie do przodu' },
    { w: 8, label: '8 tygodni do przodu' },
    { w: 12, label: '12 tygodni do przodu' },
  ]

  const modalRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header — biały z kolorowym paskiem po lewej */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accentColor }} />
            <h2 className="font-bold text-gray-900 text-base">
              {mode === 'create' ? 'Nowe wydarzenie' : 'Edytuj wydarzenie'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none"
          >×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Tytuł */}
          <input
            autoFocus
            placeholder="Tytuł wydarzenia"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            className="w-full text-lg font-bold bg-transparent border-0 border-b-2 border-gray-200 py-1 focus:outline-none placeholder:font-normal placeholder:text-gray-300 text-gray-900 transition-colors"
            style={{ '--tw-border-opacity': '1' } as React.CSSProperties}
            onFocus={e => e.currentTarget.style.borderBottomColor = accentColor}
            onBlur={e => e.currentTarget.style.borderBottomColor = ''}
          />

          {/* Lokalizacja */}
          <div className="relative">
            <label className="absolute top-2 left-3 text-xs font-medium text-gray-400 pointer-events-none">Lokalizacja</label>
            <input
              placeholder="Sala, adres..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 pt-6 pb-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition-all"
              onFocus={e => e.currentTarget.style.borderColor = accentColor}
              onBlur={e => e.currentTarget.style.borderColor = ''}
            />
          </div>

          {/* Opis — klikalne pole otwierające duży edytor */}
          <DescriptionField
            value={description}
            onChange={setDescription}
            accentColor={accentColor}
            modalRef={modalRef}
          />

          {/* ── Ikona + Kolor w jednym wierszu ── */}
          <div className="flex gap-3 items-start">
            {/* Ikona */}
            <div className="shrink-0">
              <label className="text-xs text-gray-500 block mb-1">Ikona</label>
              <button
                type="button"
                onClick={() => setIconPickerOpen(v => !v)}
                className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-gray-200 hover:border-indigo-400 transition-colors"
                style={{ backgroundColor: color + '22', borderColor: iconPickerOpen ? color : undefined, color }}
              >
                {icon ? <IconRenderer icon={icon} size={20} iconSet={iconSet} /> : <span className="text-gray-400 text-lg">?</span>}
              </button>
            </div>

            {/* Kolor */}
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Kolor</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      color === c ? 'border-gray-800 scale-125 shadow' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                {/* Custom */}
                <button
                  type="button"
                  title="Własny kolor"
                  onClick={() => colorInputRef.current?.click()}
                  className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center text-xs font-bold ${
                    !COLOR_OPTIONS.includes(color)
                      ? 'border-gray-800 scale-125 shadow'
                      : 'border-dashed border-gray-400 hover:scale-110 text-gray-400'
                  }`}
                  style={!COLOR_OPTIONS.includes(color) ? { backgroundColor: color } : {}}
                >
                  {COLOR_OPTIONS.includes(color) && '+'}
                </button>
                <input ref={colorInputRef} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
              </div>
            </div>
          </div>

          {/* Picker ikon — rozwija się pod wierszem ikona+kolor */}
          {iconPickerOpen && (
            <div className="border border-gray-200 rounded-xl p-2 space-y-2">
              <input
                type="text"
                placeholder={`Szukaj w ${iconSetConfig.name}...`}
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoFocus
              />
              <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                {filteredIcons.map((iconName) => {
                  const iconId = formatIconId(iconSet, iconName)
                  const isSelected = icon === iconId
                  return (
                    <button
                      key={iconName}
                      type="button"
                      title={iconName}
                      onClick={() => { setIcon(iconId); setIconPickerOpen(false) }}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                        isSelected ? 'ring-2 scale-110' : 'hover:bg-gray-100'
                      }`}
                      style={isSelected ? { backgroundColor: color + '22', color, outline: `2px solid ${color}` } : {}}
                    >
                      <IconRenderer icon={iconId} size={16} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Czas trwania ── */}
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">Czas trwania</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleDurationChange(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    durationMin === m
                      ? 'text-white border-transparent'
                      : 'border-gray-200 text-gray-500 hover:border-indigo-400'
                  }`}
                  style={durationMin === m ? { backgroundColor: color } : {}}
                >
                  {m >= 60 ? `${m / 60}h` : `${m}m`}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={15}
                  max={1440}
                  step={15}
                  value={durationMin}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value) || 15)}
                  className="w-14 border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
            </div>
          </div>

          {/* ── Pin — wysuwany panel (oba tryby) ── */}
          <div className="border border-gray-100 rounded-xl overflow-hidden" ref={pinPanelRef}>
            <button
              type="button"
              onClick={() => { setPinOpen((v) => !v); setPinShowCustom(false); setPinCustomWeeks('') }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-indigo-50 transition-colors"
            >
              <span className="font-medium text-indigo-600 flex items-center gap-1.5">
                <IconRenderer icon="📌" iconSet={iconSet} size={14} /> Pin — duplikuj wydarzenie
                {mode === 'create' && pinWeeksOnCreate !== null && (
                  <span className="text-indigo-400 font-normal">· {pinWeeksOnCreate === 52 ? 'na zawsze' : `${pinWeeksOnCreate} tydz.`}</span>
                )}
              </span>
              <span className={`text-gray-400 transition-transform duration-200 ${pinOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {pinOpen && (
              <div className="border-t border-gray-100 px-3 py-3 space-y-1">
                {PIN_PRESETS.map(({ w, label }) => (
                  <button
                    key={w}
                    onClick={() => handlePinSelect(w)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                  >
                    {label}
                  </button>
                ))}
                {/* Na zawsze */}
                <button
                  onClick={() => handlePinSelect(52)}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors border-t border-gray-100 pt-2 mt-1"
                >
                   <span className="inline-flex items-center gap-1"><IconRenderer icon="♾️" iconSet={iconSet} size={13} /> Na zawsze</span>
                </button>
                {/* Custom */}
                {!pinShowCustom ? (
                  <button
                    onClick={() => setPinShowCustom(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                     <span className="inline-flex items-center gap-1"><IconRenderer icon="✏️" iconSet={iconSet} size={13} /> Custom...</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={520}
                      autoFocus
                      placeholder="ile tyg."
                      value={pinCustomWeeks}
                      onChange={(e) => setPinCustomWeeks(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const w = parseInt(pinCustomWeeks)
                          if (w > 0) handlePinSelect(w)
                        }
                      }}
                      className="w-20 border border-indigo-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-gray-500">tygodni</span>
                    <button
                      onClick={() => {
                        const w = parseInt(pinCustomWeeks)
                        if (w > 0) handlePinSelect(w)
                      }}
                      disabled={!pinCustomWeeks || parseInt(pinCustomWeeks) < 1}
                      className="text-xs text-white rounded-lg px-3 py-1 disabled:opacity-40 transition-colors"
                      style={{ backgroundColor: accentColor }}
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zaawansowane — daty, czas trwania, proces w tle */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-600 flex items-center gap-1.5">
                Zaawansowane
                {isBackground && <span className="text-indigo-500 font-normal">· Proces w tle</span>}
              </span>
              <span className={`transition-transform duration-200 ${advOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {advOpen && (
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-3">

                {/* Początek + Koniec */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="absolute top-1.5 left-3 text-xs font-medium text-gray-400 pointer-events-none">Początek</label>
                    <input
                      type="datetime-local"
                      value={startDt}
                      onChange={(e) => handleStartChange(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 pt-5 pb-1.5 text-xs text-gray-900 focus:outline-none transition-all"
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = ''}
                    />
                  </div>
                  <div className="relative">
                    <label className="absolute top-1.5 left-3 text-xs font-medium text-gray-400 pointer-events-none">Koniec</label>
                    <input
                      type="datetime-local"
                      value={endDt}
                      onChange={(e) => handleEndChange(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 pt-5 pb-1.5 text-xs text-gray-900 focus:outline-none transition-all"
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = ''}
                    />
                  </div>
                </div>

                {/* Proces w tle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={isBackground}
                      onChange={(e) => setIsBackground(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${isBackground ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isBackground ? 'translate-x-4' : ''}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Proces w tle</p>
                    <p className="text-xs text-gray-400">Wyświetlany przezroczyście, nie blokuje czasu</p>
                  </div>
                </label>

              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 flex-wrap">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Usuń
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
            >
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 text-xs text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
              style={{ backgroundColor: accentColor }}
            >
              {mode === 'create'
                ? (pinWeeksOnCreate !== null
                    ? <span className="inline-flex items-center gap-1"><IconRenderer icon="📌" iconSet={iconSet} size={12} />Utwórz + pin</span>
                    : 'Utwórz')
                : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DescriptionField — klikalne pole otwierające edytor WYSIWYG ──────────────

const DESC_PANEL_WIDTH = 380
const DESC_PANEL_GAP = 12

function DescriptionField({
  value,
  onChange,
  accentColor,
  modalRef,
}: {
  value: string
  onChange: (v: string) => void
  accentColor: string
  modalRef: React.RefObject<HTMLDivElement>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
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
    setDraft(value)
    setOpen(true)
  }

  function confirm() {
    onChange(draft)
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Podgląd w polu — strip HTML tagów
  const previewText = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const hasContent = !isEmptyHtml(value)

  // Policz checkboxy z HTML
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
        className="relative w-full border border-gray-200 rounded-xl px-3 pt-6 pb-2 text-sm text-gray-900 cursor-pointer hover:border-gray-300 transition-colors min-h-[72px]"
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
            <div className="truncate text-sm text-gray-700 line-clamp-3">{previewText}</div>
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
                onChange={setDraft}
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
