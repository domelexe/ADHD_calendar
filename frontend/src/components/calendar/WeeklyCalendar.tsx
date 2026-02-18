import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format, addDays, isSameDay, parseISO, isYesterday, isToday as isTodayFn } from 'date-fns'
import { pl } from 'date-fns/locale'
import { eventsApi } from '../../api/events'
import { contactsApi } from '../../api/contacts'
import { useCalendarStore, DragGhost } from '../../store/calendarStore'
import { templatesApi } from '../../api/templates'
import { Event, Contact, EisenhowerTask, Quadrant, getQuadrant } from '../../types'
import { tasksApi } from '../../api/tasks'
import { EventModal } from './EventModal'
import { IconRenderer } from '../ui/IconRenderer'
import { SettingsOverlay } from '../ui/SettingsOverlay'
import { BestiaryOverlay } from '../bestiary/Bestiary'

const HOUR_HEIGHT = 60  // px na godzinę

// ── Hook: aktualna minuta (odświeżana co 60s) ────────────────────────────────
function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Linia "teraz" ─────────────────────────────────────────────────────────────
function NowLine({ now, hourStart, hourEnd }: { now: Date; hourStart: number; hourEnd: number }) {
  const h = now.getHours() + now.getMinutes() / 60
  if (h < hourStart || h > hourEnd) return null
  const top = (h - hourStart) * HOUR_HEIGHT
  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative" style={{ height: '2px' }}>
        {/* linia */}
        <div className="absolute inset-0" style={{ backgroundColor: '#ff2d55' }} />
        {/* trójkąt — left:0, wierzchołek (prawy koniec) na x=8, nakłada się na linię tym samym kolorem */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '8px solid #ff2d55',
        }} />
      </div>
    </div>
  )
}

// ── Ghost — podgląd w tle podczas przeciągania ──────────────────────────────
function GhostBlock({ ghost, hourStart, iconSet }: { ghost: DragGhost; hourStart: number; iconSet?: import('../../lib/iconSets').IconSetId }) {
  const top = ((ghost.startHour - hourStart) / 1) * HOUR_HEIGHT
  const height = Math.max((ghost.durationMin / 60) * HOUR_HEIGHT, 24)

  return (
    <div
      className="absolute left-1 right-1 rounded-md pointer-events-none z-20 flex flex-col justify-start px-1.5 py-0.5"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: ghost.color + '55',
        borderLeft: `3px solid ${ghost.color}`,
        border: `2px dashed ${ghost.color}99`,
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid',
        borderLeftColor: ghost.color,
      }}
    >
      <div className="text-xs font-semibold truncate flex items-center gap-1" style={{ color: ghost.color }}>
        <IconRenderer icon={ghost.icon} size={11} iconSet={iconSet} />
        {ghost.title}
      </div>
      {height > 32 && (
        <div className="text-xs opacity-60" style={{ color: ghost.color }}>
          {String(Math.floor(ghost.startHour)).padStart(2, '0')}:
          {String(Math.round((ghost.startHour % 1) * 60)).padStart(2, '0')}
          {' '}–{' '}
          {String(Math.floor(ghost.startHour + ghost.durationMin / 60)).padStart(2, '0')}:
          {String(Math.round(((ghost.startHour + ghost.durationMin / 60) % 1) * 60)).padStart(2, '0')}
        </div>
      )}
    </div>
  )
}

const BG_STRIP_WIDTH = 10  // px — szerokość paska tła

// ── Pasek "Proces w tle" — wąski strip po prawej stronie kolumny ──────────────
function BgStrip({
  event,
  hourStart,
  onRightClick,
  iconSet,
}: {
  event: Event
  hourStart: number
  onRightClick: (e: Event) => void
  iconSet?: import('../../lib/iconSets').IconSetId
}) {
  const startDt = parseISO(event.start_datetime)
  const endDt = parseISO(event.end_datetime)
  const durationMin = (endDt.getTime() - startDt.getTime()) / 60000
  const grabOffsetMinRef = useRef(0)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-event-${event.id}`,
    data: {
      type: 'calendar_event',
      event,
      durationMin,
      get grabOffsetMin() { return grabOffsetMinRef.current },
    },
  })

  const combinedListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      const blockRect = (e.currentTarget as HTMLElement).closest('[data-bg-block]')?.getBoundingClientRect()
        ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetPx = e.clientY - blockRect.top
      grabOffsetMinRef.current = Math.max(0, (offsetPx / HOUR_HEIGHT) * 60)
      listeners.onPointerDown?.(e)
    },
  }

  const startMin = (startDt.getHours() - hourStart) * 60 + startDt.getMinutes()
  const top = (startMin / 60) * HOUR_HEIGHT
  const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 24)
  const color = event.activity_template?.color ?? '#6366f1'
  const icon = event.activity_template?.icon ?? '📅'

  return (
    <>
      {/* Gradient glow — pod kafelkami, intensywny */}
      <div
        className="absolute pointer-events-none z-[8]"
        style={{
          top: `${top}px`,
          right: '2px',
          width: '40px',
          height: `${height}px`,
          background: `linear-gradient(to left, ${color}ff, ${color}00)`,
          borderRadius: '4px',
        }}
      />
      {/* Wąski pasek klikalny — drag, right-click */}
      <div
        ref={setNodeRef}
        {...combinedListeners}
        {...attributes}
        data-bg-block
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onRightClick(event) }}
        className="absolute z-[13] cursor-grab select-none overflow-hidden"
        style={{
          top: `${top}px`,
          right: '2px',
          width: `${BG_STRIP_WIDTH}px`,
          height: `${height}px`,
          opacity: isDragging ? 0.4 : 1,
          backgroundColor: color,
          borderRadius: '4px',
        }}
        title={event.title}
      >
        {height > 40 && (
          <div className="flex items-center justify-center h-full pointer-events-none">
            <IconRenderer icon={icon} size={8} iconSet={iconSet} className="opacity-80" />
          </div>
        )}
      </div>
    </>
  )
}

// ── Tooltip eventu kalendarza — portal do body ───────────────────────────────
function EventTooltip({
  x, y, event, durationMin,
}: {
  x: number; y: number; event: Event; durationMin: number
}) {
  const TIP_W = 260
  const TIP_H = 80
  const OFFSET_X = 14
  const OFFSET_Y = 18

  const left = x + OFFSET_X + TIP_W > window.innerWidth ? x - TIP_W - OFFSET_X : x + OFFSET_X
  const top = y + OFFSET_Y + TIP_H > window.innerHeight ? y - TIP_H - 6 : y + OFFSET_Y

  const startDt = parseISO(event.start_datetime)
  const endDt = parseISO(event.end_datetime)
  const hours = Math.floor(durationMin / 60)
  const mins = Math.round(durationMin % 60)
  const durationStr = hours > 0 && mins > 0
    ? `${hours}h ${mins}min`
    : hours > 0
    ? `${hours}h`
    : `${mins}min`

  const color = event.activity_template?.color ?? '#6366f1'
  const desc = event.description?.trim() || event.activity_template?.description?.trim()

  return createPortal(
    <div className="fixed z-[200] pointer-events-none" style={{ left, top, maxWidth: TIP_W }}>
      <div
        className="rounded-xl px-3 py-2.5 shadow-2xl border space-y-1"
        style={{
          backgroundColor: 'rgba(12,12,22,0.97)',
          borderColor: color + '50',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Godziny + czas trwania */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: '#ffffffdd' }}>
            {format(startDt, 'HH:mm')} – {format(endDt, 'HH:mm')}
          </span>
          <span className="text-xs" style={{ color: color + 'cc' }}>
            {durationStr}
          </span>
        </div>

        {/* Opis */}
        {desc && (
          <div
            className="text-xs leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-line' }}
          >
            {desc.length > 300 ? desc.slice(0, 300) + '…' : desc}
          </div>
        )}

        {/* Lokalizacja */}
        {event.location && (
          <div className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span>📍</span> {event.location}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── Blok eventu — lewy drag, prawy = modal, dolna krawędź = resize ───────────
function EventBlock({
  event,
  columnRef,
  hourStart,
  onRightClick,
  onResizeEnd,
  iconSet,
  rightOffset = 4,
}: {
  event: Event
  columnRef: React.RefObject<HTMLDivElement>
  hourStart: number
  onRightClick: (e: Event) => void
  onResizeEnd: (event: Event, newDurationMin: number) => void
  iconSet?: import('../../lib/iconSets').IconSetId
  rightOffset?: number
}) {
  const startDt = parseISO(event.start_datetime)
  const endDt = parseISO(event.end_datetime)
  const startMinutes = (startDt.getHours() - hourStart) * 60 + startDt.getMinutes()
  const durationMin = (endDt.getTime() - startDt.getTime()) / 60000
  const top = (startMinutes / 60) * HOUR_HEIGHT

  const [resizeDur, setResizeDur] = useState<number | null>(null)
  const displayDur = resizeDur ?? durationMin
  const height = Math.max((displayDur / 60) * HOUR_HEIGHT, 24)

  const color = event.activity_template?.color ?? '#6366f1'
  const icon = event.activity_template?.icon ?? '📅'

  const grabOffsetMinRef = useRef(0)

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    // Timer startuje w handleMouseMove
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    const mx = e.clientX
    const my = e.clientY
    tooltipTimerRef.current = setTimeout(() => setTooltip({ x: mx, y: my }), 400)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null }
    setTooltip(null)
  }, [])

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-event-${event.id}`,
    data: {
      type: 'calendar_event',
      event,
      durationMin,
      get grabOffsetMin() { return grabOffsetMinRef.current },
    },
  })

  // Ukryj tooltip gdy zaczyna się drag
  useEffect(() => {
    if (isDragging) {
      setTooltip(null)
      if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null }
    }
  }, [isDragging])

  // Łączymy nasz onPointerDown z listenerem dnd-kit
  const combinedListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      // Ukryj tooltip przy kliknięciu
      setTooltip(null)
      if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null }
      // Zapisz offset przed oddaniem kontroli do dnd-kit
      const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetPx = e.clientY - blockRect.top
      grabOffsetMinRef.current = Math.max(0, (offsetPx / HOUR_HEIGHT) * 60)
      // Wywołaj oryginalny listener dnd-kit
      listeners?.onPointerDown?.(e)
    },
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTooltip(null)
    onRightClick(event)
  }

  // ── Resize handle ─────────────────────────────────────────────────────────
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startClientY = e.clientY
    const startDur = durationMin

    const onMove = (me: PointerEvent) => {
      const colRect = columnRef.current?.getBoundingClientRect()
      if (!colRect) return
      const deltaY = me.clientY - startClientY
      const deltaMins = (deltaY / HOUR_HEIGHT) * 60
      const rawMins = startDur + deltaMins
      const snapped = Math.round(rawMins / 15) * 15
      setResizeDur(Math.max(15, snapped))
    }

    const onUp = (me: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const deltaY = me.clientY - startClientY
      const deltaMins = (deltaY / HOUR_HEIGHT) * 60
      const rawMins = startDur + deltaMins
      const snapped = Math.round(rawMins / 15) * 15
      const finalDur = Math.max(15, snapped)
      setResizeDur(null)
      onResizeEnd(event, finalDur)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const displayEnd = new Date(startDt.getTime() + displayDur * 60000)

  return (
    <>
      <div
        ref={setNodeRef}
        {...combinedListeners}
        {...attributes}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute left-1 rounded-md overflow-hidden select-none z-10 transition-opacity"
        style={{
          top: `${top}px`,
          right: `${rightOffset}px`,
          height: `${height}px`,
          opacity: isDragging ? 0.35 : 1,
          backgroundColor: color + 'dd',
          borderLeft: `3px solid ${color}`,
          cursor: 'grab',
        }}
      >
        <div className="px-1.5 py-0.5 h-full flex flex-col justify-start pointer-events-none">
          <div className="text-white text-xs font-semibold leading-snug truncate flex items-center gap-1">
            <IconRenderer icon={icon} size={12} className="shrink-0" iconSet={iconSet} />
            {event.title}
          </div>
          {height > 34 && (
            <div className="text-white/75 text-xs truncate">
              {format(startDt, 'HH:mm')}–{format(displayEnd, 'HH:mm')}
            </div>
          )}
          {event.location && height > 52 && (
            <div className="text-white/60 text-xs truncate flex items-center gap-0.5"><IconRenderer icon="📍" iconSet={iconSet} size={10} className="shrink-0 opacity-75" />{event.location}</div>
          )}
        </div>
        {/* Uchwyt resize */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-center justify-center group/resize"
          style={{ pointerEvents: 'all' }}
          onPointerDown={handleResizePointerDown}
        >
          <div className="w-8 h-0.5 rounded-full bg-white/40 group-hover/resize:bg-white/80 transition-colors" />
        </div>
      </div>
      {/* Tooltip — portal do body */}
      {tooltip && !isDragging && (
        <EventTooltip x={tooltip.x} y={tooltip.y} event={event} durationMin={durationMin} />
      )}
    </>
  )
}

// ── Konfiguracja kolorów kwadrantów ───────────────────────────────────────────
const QUADRANT_COLORS: Record<string, { color: string; label: string }> = {
  do_first: { color: '#ef4444', label: 'Zrób teraz' },
  schedule: { color: '#3b82f6', label: 'Zaplanuj' },
  delegate: { color: '#eab308', label: 'Deleguj' },
  eliminate: { color: '#6b7280', label: 'Eliminuj' },
}

// ── Blok kwadrantu Eisenhowera na kalendarzu ────────────────────────────────
function EisenhowerCalendarBlock({
  event,
  columnRef,
  hourStart,
  onRightClick,
  onResizeEnd,
  iconSet,
  rightOffset = 4,
  tasks,
  onTaskStatusChange,
}: {
  event: Event
  columnRef: React.RefObject<HTMLDivElement>
  hourStart: number
  onRightClick: (e: Event) => void
  onResizeEnd: (event: Event, newDurationMin: number) => void
  iconSet?: import('../../lib/iconSets').IconSetId
  rightOffset?: number
  tasks: EisenhowerTask[]
  onTaskStatusChange: (taskId: number, newStatus: 'todo' | 'in_progress' | 'done') => void
}) {
  const quadrant = event.eisenhower_quadrant as Quadrant
  const qConfig = QUADRANT_COLORS[quadrant] || { color: '#8b5cf6', label: 'Matryca' }
  const quadrantTasks = tasks.filter(
    (t) => getQuadrant(t) === quadrant && t.status !== 'done',
  )
  const doneTasks = tasks.filter(
    (t) => getQuadrant(t) === quadrant && t.status === 'done',
  )

  const startDt = parseISO(event.start_datetime)
  const endDt = parseISO(event.end_datetime)
  const startMinutes = (startDt.getHours() - hourStart) * 60 + startDt.getMinutes()
  const durationMin = (endDt.getTime() - startDt.getTime()) / 60000
  const top = (startMinutes / 60) * HOUR_HEIGHT

  const [resizeDur, setResizeDur] = useState<number | null>(null)
  const displayDur = resizeDur ?? durationMin
  const height = Math.max((displayDur / 60) * HOUR_HEIGHT, 60)

  const grabOffsetMinRef = useRef(0)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-event-${event.id}`,
    data: {
      type: 'calendar_event',
      event,
      durationMin,
      get grabOffsetMin() { return grabOffsetMinRef.current },
    },
  })

  const combinedListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const offsetPx = e.clientY - blockRect.top
      grabOffsetMinRef.current = Math.max(0, (offsetPx / HOUR_HEIGHT) * 60)
      listeners?.onPointerDown?.(e)
    },
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onRightClick(event)
  }

  // Resize handle
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startClientY = e.clientY
    const startDur = durationMin

    const onMove = (me: PointerEvent) => {
      const colRect = columnRef.current?.getBoundingClientRect()
      if (!colRect) return
      const deltaY = me.clientY - startClientY
      const deltaMins = (deltaY / HOUR_HEIGHT) * 60
      const rawMins = startDur + deltaMins
      const snapped = Math.round(rawMins / 15) * 15
      setResizeDur(Math.max(15, snapped))
    }

    const onUp = (me: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const deltaY = me.clientY - startClientY
      const deltaMins = (deltaY / HOUR_HEIGHT) * 60
      const rawMins = startDur + deltaMins
      const snapped = Math.round(rawMins / 15) * 15
      const finalDur = Math.max(15, snapped)
      setResizeDur(null)
      onResizeEnd(event, finalDur)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Cyklicznie status: todo → in_progress → done → todo
  const cycleStatus = (task: EisenhowerTask) => {
    const next = task.status === 'todo' ? 'in_progress'
      : task.status === 'in_progress' ? 'done'
      : 'todo'
    onTaskStatusChange(task.id, next)
  }

  // Ikona statusu
  const StatusIcon = ({ task }: { task: EisenhowerTask }) => {
    const color = qConfig.color
    if (task.status === 'done') {
      return (
        <div
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          <span style={{ color: '#ffffff', fontSize: '8px', lineHeight: '1' }}>✓</span>
        </div>
      )
    }
    if (task.status === 'in_progress') {
      return (
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{
            background: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
            border: `2px solid ${color}`,
          }}
        />
      )
    }
    return (
      <div
        className="w-3.5 h-3.5 rounded-full shrink-0"
        style={{ border: `2px solid ${color}` }}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      {...combinedListeners}
      {...attributes}
      onContextMenu={handleContextMenu}
      className="absolute left-1 rounded-md overflow-hidden select-none z-10 transition-opacity"
      style={{
        top: `${top}px`,
        right: `${rightOffset}px`,
        height: `${height}px`,
        opacity: isDragging ? 0.35 : 1,
        backgroundColor: qConfig.color + '40',
        borderLeft: `3px solid ${qConfig.color}`,
        border: `1px solid ${qConfig.color}66`,
        borderLeftWidth: '3px',
        borderLeftColor: qConfig.color,
        cursor: 'grab',
      }}
    >
      {/* Nagłówek */}
      <div
        className="flex items-center gap-1.5 px-1.5 py-0.5"
        style={{ borderBottom: `1px solid ${qConfig.color}33` }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: qConfig.color }}
        />
        <span
          className="text-xs font-bold truncate"
          style={{ color: qConfig.color }}
        >
          {qConfig.label}
        </span>
        <span
          className="text-xs font-medium ml-auto"
          style={{ color: qConfig.color + '99' }}
        >
          {quadrantTasks.length}
        </span>
      </div>

      {/* Lista zadań — scrollowalna */}
      <div
        className="overflow-y-auto px-1"
        style={{ maxHeight: `${height - 24}px` }}
      >
        {quadrantTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-1.5 py-1 px-1.5 my-0.5 rounded cursor-pointer hover:brightness-125 transition-all"
            style={{
              pointerEvents: 'all',
              backgroundColor: qConfig.color + '28',
              border: `1px solid ${qConfig.color}38`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              cycleStatus(task)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <StatusIcon task={task} />
            <span
              className="text-xs truncate"
              style={{ color: '#ffffffcc' }}
            >
              {task.title}
            </span>
          </div>
        ))}
        {doneTasks.length > 0 && (
          <div className="mt-0.5 pt-0.5" style={{ borderTop: `1px solid ${qConfig.color}22` }}>
            <span className="text-xs" style={{ color: qConfig.color + '66' }}>
              ✓ {doneTasks.length} ukończone
            </span>
          </div>
        )}
        {quadrantTasks.length === 0 && doneTasks.length === 0 && (
          <div className="py-1">
            <span className="text-xs" style={{ color: '#ffffff44' }}>
              Brak zadań
            </span>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-center justify-center group/resize"
        style={{ pointerEvents: 'all' }}
        onPointerDown={handleResizePointerDown}
      >
        <div className="w-8 h-0.5 rounded-full transition-colors" style={{ backgroundColor: qConfig.color + '55' }} />
      </div>
    </div>
  )
}

// ── Kolumna dnia — dropzone z pozycją kursora ────────────────────────────────
function DayColumn({
  date,
  dayIndex,
  events,
  ghost,
  isToday,
  now,
  hourStart,
  hourEnd,
  onSlotClick,
  onEventRightClick,
  onEventResizeEnd,
  iconSet,
  eisenhowerTasks,
  onTaskStatusChange,
}: {
  date: Date
  dayIndex: number
  events: Event[]
  ghost: DragGhost | null
  isToday: boolean
  now: Date
  hourStart: number
  hourEnd: number
  onSlotClick: (date: Date, hour: number) => void
  onEventRightClick: (e: Event) => void
  onEventResizeEnd: (event: Event, newDurationMin: number) => void
  iconSet?: import('../../lib/iconSets').IconSetId
  eisenhowerTasks: EisenhowerTask[]
  onTaskStatusChange: (taskId: number, newStatus: 'todo' | 'in_progress' | 'done') => void
}) {
  const columnRef = useRef<HTMLDivElement>(null)

  // Dropzone — przyjmuje szablony, taski eisenhowera i przesuwane eventy.
  // Przekazuje też `columnRef` i `date` żeby AppLayout mógł wyliczyć godzinę.
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}`,
    data: { type: 'calendar_day', date, dayIndex, columnRef },
  })

  // Łączymy oba refy
  const setRefs = (el: HTMLDivElement | null) => {
    (columnRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    setNodeRef(el)
  }

  return (
    <div
      ref={setRefs}
      className={`relative border-l border-gray-100 transition-colors overflow-hidden ${isOver ? 'bg-indigo-50/50' : ''}`}
      style={{ height: `${(hourEnd - hourStart) * HOUR_HEIGHT}px` }}
    >
      {/* Linie godzinowe */}
      {Array.from({ length: hourEnd - hourStart }, (_, i) => (
        <div
          key={i}
          className="absolute w-full border-t border-gray-100 pointer-events-none"
          style={{ top: `${i * HOUR_HEIGHT}px` }}
        />
      ))}
      {/* Linie półgodzinowe */}
      {Array.from({ length: hourEnd - hourStart }, (_, i) => (
        <div
          key={`h${i}`}
          className="absolute w-full border-t border-gray-50 pointer-events-none"
          style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
        />
      ))}

      {/* Klikalne sloty (co 30 min) */}
      {Array.from({ length: (hourEnd - hourStart) * 2 }, (_, i) => {
        const hour = hourStart + Math.floor(i / 2) + (i % 2 === 1 ? 0.5 : 0)
        return (
          <div
            key={`slot${i}`}
            className="absolute w-full hover:bg-indigo-50/40 cursor-pointer transition-colors"
            style={{ top: `${(i * HOUR_HEIGHT) / 2}px`, height: `${HOUR_HEIGHT / 2}px` }}
            onClick={() => onSlotClick(date, hour)}
          />
        )
      })}

      {/* Ghost — podgląd podczas drag */}
      {ghost && <GhostBlock ghost={ghost} hourStart={hourStart} iconSet={iconSet} />}

      {/* Linia "teraz" */}
      {isToday && <NowLine now={now} hourStart={hourStart} hourEnd={hourEnd} />}

      {/* Paski "Proces w tle" — wąski strip po prawej, klikalny */}
      {events.filter(ev => ev.is_background).map((ev) => (
        <BgStrip
          key={`bg-${ev.id}`}
          event={ev}
          hourStart={hourStart}
          onRightClick={onEventRightClick}
          iconSet={iconSet}
        />
      ))}

      {/* Eventy normalne — zwężone tylko gdy nakładają się czasowo z eventem tła */}
      {events.filter(ev => !ev.is_background && !ev.eisenhower_quadrant).map((ev) => {
        const evStart = parseISO(ev.start_datetime).getTime()
        const evEnd = parseISO(ev.end_datetime).getTime()
        const overlaps = events.some(bg =>
          bg.is_background &&
          evStart < parseISO(bg.end_datetime).getTime() &&
          evEnd > parseISO(bg.start_datetime).getTime()
        )
        return (
          <EventBlock
            key={ev.id}
            event={ev}
            columnRef={columnRef}
            hourStart={hourStart}
            onRightClick={onEventRightClick}
            onResizeEnd={onEventResizeEnd}
            iconSet={iconSet}
            rightOffset={overlaps ? BG_STRIP_WIDTH + 4 : 4}
          />
        )
      })}

      {/* Bloki Eisenhowera — eventy z eisenhower_quadrant */}
      {events.filter(ev => !!ev.eisenhower_quadrant).map((ev) => {
        const evStart = parseISO(ev.start_datetime).getTime()
        const evEnd = parseISO(ev.end_datetime).getTime()
        const overlaps = events.some(bg =>
          bg.is_background &&
          evStart < parseISO(bg.end_datetime).getTime() &&
          evEnd > parseISO(bg.start_datetime).getTime()
        )
        return (
          <EisenhowerCalendarBlock
            key={`eis-${ev.id}`}
            event={ev}
            columnRef={columnRef}
            hourStart={hourStart}
            onRightClick={onEventRightClick}
            onResizeEnd={onEventResizeEnd}
            iconSet={iconSet}
            rightOffset={overlaps ? BG_STRIP_WIDTH + 4 : 4}
            tasks={eisenhowerTasks}
            onTaskStatusChange={onTaskStatusChange}
          />
        )
      })}
    </div>
  )
}

// ── Główny komponent kalendarza ───────────────────────────────────────────────
export function WeeklyCalendar() {
  const qc = useQueryClient()
  const now = useNow()
  const {
    weekStart, nextWeek, prevWeek, goToToday,
    selectedTemplateId, dragGhost,
    viewMode,
    hourStart, hourEnd,
    iconSet,
  } = useCalendarStore()
  const [modalData, setModalData] = useState<{
    mode: 'create' | 'edit'
    event?: Event
    defaultStart?: string
    defaultTemplateId?: number
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bestiaryContactId, setBestiaryContactId] = useState<number | null>(null)
  const [bdPopover, setBdPopover] = useState<{ contacts: typeof contacts; rect: DOMRect } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Zamknij popover urodzin klikając poza nim
  useEffect(() => {
    if (!bdPopover) return
    const h = () => setBdPopover(null)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [bdPopover])

  // Scroll poziomy kółkiem (tilt lewo/prawo) → zmiana tygodnia
  // Scroll pionowy → normalne przewijanie godzin
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    let lastTime = 0
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        const now = Date.now()
        if (now - lastTime < 400) return
        lastTime = now
        if (e.deltaX > 0) nextWeek()
        else prevWeek()
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [nextWeek, prevWeek])

  // Klawisze strzałek: ←/→ → tydzień, ↑/↓ → scroll godzin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Nie przechwytuj gdy użytkownik pisze w input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return

      const el = scrollContainerRef.current
      if (!el) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevWeek()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextWeek()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        el.scrollBy({ top: -80, behavior: 'smooth' })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        el.scrollBy({ top: 80, behavior: 'smooth' })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [nextWeek, prevWeek])

  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Etykieta dnia — w trybie dynamicznym: Wczoraj/Dziś/Jutro/poj. nazwa; w statycznym: skrót dnia tygodnia
  const dayLabel = (day: Date): string => {
    if (viewMode === 'dynamic') {
      if (isYesterday(day)) return 'Wczoraj'
      if (isTodayFn(day)) return 'Dziś'
      if (isSameDay(day, addDays(new Date(), 1))) return 'Jutro'
    }
    return format(day, 'EEE', { locale: pl })
  }

  const { data: events = [] } = useQuery({
    queryKey: ['events', weekStartStr],
    queryFn: () => eventsApi.list(weekStartStr),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['activity-templates'],
    queryFn: templatesApi.list,
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.list,
  })

  // Eisenhower tasks — potrzebne do renderowania bloków kwadrantów na kalendarzu
  const { data: eisenhowerTasks = [] } = useQuery({
    queryKey: ['eisenhower-tasks'],
    queryFn: tasksApi.list,
  })

  const taskPatchMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EisenhowerTask> }) =>
      tasksApi.patch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })

  const handleTaskStatusChange = (taskId: number, newStatus: 'todo' | 'in_progress' | 'done') => {
    taskPatchMut.mutate({ id: taskId, data: { status: newStatus } })
  }

  // Kontakty z urodzinami w danym dniu
  const birthdayContactsForDay = (day: Date): Contact[] => {
    return contacts.filter((c) => {
      if (!c.birthday) return false
      const bd = new Date(c.birthday)
      return bd.getMonth() === day.getMonth() && bd.getDate() === day.getDate()
    })
  }

  const createMut = useMutation({
    mutationFn: eventsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      eventsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      // Dwukierunkowa sync: opis propagowany do szablonu i innych eventów
      qc.invalidateQueries({ queryKey: ['activity-templates'] })
    },
  })

  const handleSlotClick = (date: Date, hour: number) => {
    const hh = Math.floor(hour)
    const mm = hour % 1 === 0 ? 0 : 30
    const dt = new Date(date)
    dt.setHours(hh, mm, 0, 0)
    const dtEnd = new Date(dt)
    const tpl = templates.find((t) => t.id === selectedTemplateId)
    dtEnd.setMinutes(dtEnd.getMinutes() + (tpl?.default_duration ?? 60))
    setModalData({
      mode: 'create',
      defaultStart: dt.toISOString(),
      defaultTemplateId: selectedTemplateId ?? undefined,
    })
  }

  const eventsByDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_datetime), day))

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Nawigacja — wycentrowana */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 border-b border-gray-100 shrink-0">
        {/* Lewa strona — pusty spacer */}
        <div />
        {/* Środek — nawigacja tygodnia */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg font-light shrink-0"
          >‹</button>
          <span className="font-semibold text-gray-800 text-sm w-[210px] text-center shrink-0">
            {format(weekStart, 'd MMMM', { locale: pl })} –{' '}
            {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: pl })}
          </span>
          <button
            onClick={nextWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg font-light shrink-0"
          >›</button>
        </div>
        {/* Prawa strona — przyciski */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Dziś
          </button>
          {/* Przycisk ustawień — otwiera overlay */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Ustawienia kalendarza"
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors ${settingsOpen ? 'bg-gray-100' : ''}`}
          >
            <IconRenderer icon="⚙️" iconSet={iconSet} size={16} />
          </button>
        </div>
      </div>

      {/* Scrollowalny kontener — zawiera i nagłówki i body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto"
      >
        <div className="min-w-[1160px]">

          {/* Nagłówki dni — sticky top */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-100 sticky top-0 z-20 bg-white">
            <div />
            {days.map((day, i) => {
              const isToday = isSameDay(day, new Date())
              const bdContacts = birthdayContactsForDay(day)
              return (
                <div key={i} className="text-center py-2 relative">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{dayLabel(day)}</div>
                  <div
                    className={`text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full relative ${
                      isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  {/* Miniaturowe nazwy solenizantów pod datą — klikalne */}
                  {bdContacts.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setBdPopover({ contacts: bdContacts, rect })
                      }}
                      className="text-xs text-red-500 font-medium mt-0.5 truncate px-1 hover:text-red-400 transition-colors w-full"
                    >
                      <span className="inline-flex items-center gap-1"><IconRenderer icon="🎂" iconSet={iconSet} size={12} />{bdContacts[0].name}{bdContacts.length > 1 ? ` +${bdContacts.length - 1}` : ''}</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Siatka z osią czasu i kolumnami dni */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)]">
            {/* Oś czasu — sticky left */}
            <div className="border-r border-gray-100 sticky left-0 bg-white z-10">
              {Array.from({ length: hourEnd - hourStart }, (_, i) => (
                <div
                  key={i}
                  className="flex items-start justify-end pr-2 pt-1 text-xs text-gray-400 select-none"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {`${hourStart + i}:00`}
                </div>
              ))}
            </div>

            {/* Kolumny dni */}
            {days.map((day, i) => (
              <DayColumn
                key={i}
                date={day}
                dayIndex={i}
                events={eventsByDay(day)}
                ghost={dragGhost?.dayIndex === i ? dragGhost : null}
                isToday={isSameDay(day, now)}
                now={now}
                hourStart={hourStart}
                hourEnd={hourEnd}
                onSlotClick={handleSlotClick}
                iconSet={iconSet}
                onEventRightClick={(ev) => setModalData({ mode: 'edit', event: ev })}
                onEventResizeEnd={(ev, newDur) => {
                  const start = parseISO(ev.start_datetime)
                  const end = new Date(start.getTime() + newDur * 60000)
                  updateMut.mutate({ id: ev.id, data: { end_datetime: end.toISOString() } })
                }}
                eisenhowerTasks={eisenhowerTasks}
                onTaskStatusChange={handleTaskStatusChange}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Modal */}
      {modalData && (
        <EventModal
          mode={modalData.mode}
          event={modalData.event}
          defaultStart={modalData.defaultStart}
          defaultTemplateId={modalData.defaultTemplateId}
          templates={templates}
          onClose={() => setModalData(null)}
          onSave={(data) => {
            if (modalData.mode === 'create') {
              createMut.mutate(data as Parameters<typeof eventsApi.create>[0])
            } else if (modalData.event) {
              updateMut.mutate({ id: modalData.event.id, data })
            }
            setModalData(null)
          }}
          onDelete={
            modalData.mode === 'edit' && modalData.event
              ? async () => {
                  await eventsApi.delete(modalData.event!.id)
                  qc.invalidateQueries({ queryKey: ['events'] })
                  setModalData(null)
                }
              : undefined
          }
          onPin={
            modalData.mode === 'edit' && modalData.event
              ? (weeksAhead) => {
                  const ev = modalData.event!
                  const start = parseISO(ev.start_datetime)
                  const end = parseISO(ev.end_datetime)
                  const durationMs = end.getTime() - start.getTime()
                  const promises = Array.from({ length: weeksAhead }, (_, i) => {
                    const newStart = new Date(start.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000)
                    const newEnd = new Date(newStart.getTime() + durationMs)
                    return eventsApi.create({
                      title: ev.title,
                      start_datetime: newStart.toISOString(),
                      end_datetime: newEnd.toISOString(),
                      activity_template_id: ev.activity_template_id,
                      description: ev.description,
                      location: ev.location,
                    } as Parameters<typeof eventsApi.create>[0])
                  })
                   Promise.all(promises).then(() => qc.invalidateQueries({ queryKey: ['events'] }))
                 }
               : undefined
           }
         />
      )}

      {/* Overlay ustawień */}
      {settingsOpen && (
        <SettingsOverlay onClose={() => setSettingsOpen(false)} />
      )}

      {/* Bestiary otwarty na konkretnym kontakcie */}
      {bestiaryContactId !== null && (
        <BestiaryOverlay
          initialContactId={bestiaryContactId}
          onClose={() => setBestiaryContactId(null)}
        />
      )}

      {/* Popover urodzin */}
      {bdPopover && (
        <div
          className="fixed z-[80] bg-gray-900 border border-white/20 rounded-2xl shadow-2xl overflow-hidden min-w-[180px]"
          style={{
            top: bdPopover.rect.bottom + 6,
            left: Math.min(bdPopover.rect.left, window.innerWidth - 200),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">Urodziny dziś <IconRenderer icon="🎂" iconSet={iconSet} size={12} /></p>
          </div>
          {bdPopover.contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => { setBdPopover(null); setBestiaryContactId(c.id) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0 overflow-hidden border border-white/10">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                  : c.name[0].toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-white/30 truncate">{c.phone}</p>}
              </div>
              <span className="text-white/20 text-xs shrink-0">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
