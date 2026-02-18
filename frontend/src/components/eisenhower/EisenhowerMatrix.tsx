import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { tasksApi } from '../../api/tasks'
import { EisenhowerTask, Quadrant, getQuadrant, quadrantToFlags } from '../../types'
import { useCalendarStore } from '../../store/calendarStore'
import { IconRenderer } from '../ui/IconRenderer'

// ── Konfiguracja kwadrantów ──────────────────────────────────────────────────
interface QuadrantConfig {
  id: Quadrant
  label: string
  urgentLabel: string
  importantLabel: string
  bg: string
  qBg: string
  border: string
  accent: string
  text: string
  doneColor: string   // kolor na liście ukończonych
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: 'do_first',
    label: 'Zrób teraz',
    urgentLabel: 'Pilne',
    importantLabel: 'Ważne',
    bg: 'bg-red-900/80',
    qBg: 'bg-red-950/60',
    border: 'border-red-800',
    accent: 'text-red-400',
    text: 'text-red-100',
    doneColor: '#ef4444',
  },
  {
    id: 'schedule',
    label: 'Zaplanuj',
    urgentLabel: 'Niepilne',
    importantLabel: 'Ważne',
    bg: 'bg-blue-900/80',
    qBg: 'bg-blue-950/60',
    border: 'border-blue-800',
    accent: 'text-blue-400',
    text: 'text-blue-100',
    doneColor: '#3b82f6',
  },
  {
    id: 'delegate',
    label: 'Deleguj',
    urgentLabel: 'Pilne',
    importantLabel: 'Nieważne',
    bg: 'bg-yellow-900/80',
    qBg: 'bg-yellow-950/60',
    border: 'border-yellow-800',
    accent: 'text-yellow-400',
    text: 'text-yellow-100',
    doneColor: '#eab308',
  },
  {
    id: 'eliminate',
    label: 'Eliminuj',
    urgentLabel: 'Niepilne',
    importantLabel: 'Nieważne',
    bg: 'bg-gray-800/80',
    qBg: 'bg-gray-900/60',
    border: 'border-gray-700',
    accent: 'text-gray-400',
    text: 'text-gray-300',
    doneColor: '#6b7280',
  },
]

function quadrantConfig(task: EisenhowerTask): QuadrantConfig {
  return QUADRANTS.find((q) => q.id === getQuadrant(task)) ?? QUADRANTS[3]
}

// ── Menu kontekstowe ──────────────────────────────────────────────────────────
interface ContextMenu {
  x: number
  y: number
  task: EisenhowerTask
  isPending: boolean
}

// ── Modal edycji zadania ──────────────────────────────────────────────────────
function TaskEditModal({
  task,
  onClose,
  onSave,
}: {
  task: EisenhowerTask
  onClose: () => void
  onSave: (data: Partial<EisenhowerTask>) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const cfg = quadrantConfig(task)

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header z kolorowym paskiem */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: cfg.doneColor }} />
            <h3 className="text-white font-bold text-base">Edytuj zadanie</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-gray-900 px-1 text-xs font-medium text-white/40">Tytuł</label>
            <input
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-all placeholder:text-white/20"
              style={{ '--focus-color': cfg.doneColor } as React.CSSProperties}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onSave({ title: title.trim() || task.title, description: desc.trim() || null }); onClose() } }}
              placeholder="Tytuł zadania"
              autoFocus
              onFocus={e => e.currentTarget.style.borderColor = cfg.doneColor + '80'}
              onBlur={e => e.currentTarget.style.borderColor = ''}
            />
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-gray-900 px-1 text-xs font-medium text-white/40">Opis <span className="text-white/20">(opcjonalnie)</span></label>
            <textarea
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-all resize-none placeholder:text-white/20"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Opis, notatki..."
              rows={3}
              onFocus={e => e.currentTarget.style.borderColor = cfg.doneColor + '80'}
              onBlur={e => e.currentTarget.style.borderColor = ''}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/40 hover:text-white rounded-xl border border-white/10 hover:border-white/25 transition-colors"
            >Anuluj</button>
            <button
              onClick={() => { onSave({ title: title.trim() || task.title, description: desc.trim() || null }); onClose() }}
              className="px-4 py-2 text-sm text-white rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: cfg.doneColor }}
            >Zapisz</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Modal podglądu (powiększ) ─────────────────────────────────────────────────
function TaskDetailModal({ task, onClose }: { task: EisenhowerTask; onClose: () => void }) {
  const cfg = quadrantConfig(task)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-3 border"
        style={{ backgroundColor: cfg.doneColor + '22', borderColor: cfg.doneColor + '55' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span
              className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: cfg.doneColor + '33', color: cfg.doneColor }}
            >
              {cfg.label} · {cfg.urgentLabel} / {cfg.importantLabel}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl shrink-0">×</button>
        </div>
        <h3 className="text-white font-bold text-lg leading-snug">{task.title}</h3>
        {task.description && (
          <p className="text-white/60 text-sm leading-relaxed">{task.description}</p>
        )}
        <div className="flex gap-2 pt-1">
          {task.urgent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Pilne</span>
          )}
          {task.important && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Ważne</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            task.status === 'done' ? 'bg-green-500/20 text-green-300' :
            task.status === 'in_progress' ? 'bg-orange-500/20 text-orange-300' :
            'bg-white/10 text-white/40'
          }`}>
            {task.status === 'done' ? 'Ukończone' : task.status === 'in_progress' ? 'W toku' : 'Do zrobienia'}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Tooltip przy kursorze ─────────────────────────────────────────────────────
function TooltipPopup({
  x, y, description, dueDate, targetQuadrant, accentColor, showBufferPath,
}: {
  x: number; y: number
  description?: string
  dueDate?: string | null
  targetQuadrant?: string | null
  accentColor: string
  showBufferPath?: boolean   // pokazuj etapy: bufor → docelowy
}) {
  const OFFSET_X = 14
  const OFFSET_Y = 18
  const TIP_W = 250
  const TIP_H = 100

  const left = x + OFFSET_X + TIP_W > window.innerWidth ? x - TIP_W - OFFSET_X : x + OFFSET_X
  const top  = y + OFFSET_Y + TIP_H > window.innerHeight ? y - TIP_H - 6 : y + OFFSET_Y

  const qCfg = targetQuadrant ? QUADRANTS.find((q) => q.id === targetQuadrant) : null
  const daysLeft = dueDate
    ? Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // Ścieżka bufora (tylko dla zaplanowanych w sidebarze)
  const bufferCfg = qCfg && showBufferPath ? (() => {
    const bqId = bufferQuadrant(qCfg.id as Quadrant)
    const bq = QUADRANTS.find((q) => q.id === bqId)
    const totalDays = daysLeft ?? 7
    const buf = bufferDays(totalDays)
    const daysToBuffer = totalDays - buf
    return bqId !== qCfg.id ? { bq, daysToBuffer, buf } : null
  })() : null

  return (
    <div className="fixed z-[200] pointer-events-none" style={{ left, top, maxWidth: TIP_W }}>
      <div
        className="rounded-xl px-3 py-2.5 shadow-2xl border space-y-1.5"
        style={{ backgroundColor: 'rgba(12,12,22,0.97)', borderColor: accentColor + '50', backdropFilter: 'blur(8px)' }}
      >
        {/* Ścieżka: bufor → docelowy */}
        {bufferCfg && daysLeft !== null && (
          <div className="space-y-1">
            {bufferCfg.daysToBuffer > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <span className="text-yellow-400/70">◑</span>
                <span>Za <span className="text-yellow-300 font-medium">{bufferCfg.daysToBuffer}d</span></span>
                <span className="text-white/25">→</span>
                <span style={{ color: bufferCfg.bq?.doneColor + 'cc' }}>{bufferCfg.bq?.label} <span className="opacity-60">(bufor)</span></span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <span style={{ color: daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : accentColor }}>●</span>
              <span style={{ color: daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}>
                Za <span className="font-semibold">{daysLeft <= 0 ? 'dziś' : `${daysLeft}d`}</span>
              </span>
              <span className="text-white/25">→</span>
              <span className="font-medium" style={{ color: qCfg?.doneColor }}>{qCfg?.label}</span>
            </div>
          </div>
        )}
        {/* Prosty info o terminie (bez ścieżki bufora) */}
        {!showBufferPath && daysLeft !== null && qCfg && (
          <div className="flex items-center gap-1.5 text-xs">
            <span>⏰</span>
            <span style={{ color: daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#fbbf24' : accentColor }}>
              Za {daysLeft <= 0 ? 'dziś' : `${daysLeft}d`}
            </span>
            <span className="text-white/30">→</span>
            <span className="font-medium" style={{ color: qCfg.doneColor }}>{qCfg.label}</span>
          </div>
        )}
        {/* Opis */}
        {description && (
          <p className="text-xs leading-relaxed text-white/75">{description}</p>
        )}
      </div>
    </div>
  )
}

// ── Kafelek zadania wewnątrz kwadrantu ────────────────────────────────────────
function TaskTile({
  task,
  config,
  onSendToPending,
  onAddToPending,
  onContextMenu,
}: {
  task: EisenhowerTask
  config: QuadrantConfig
  onSendToPending: (task: EisenhowerTask) => void
  onAddToPending: (task: EisenhowerTask) => void  // tylko aktualizuje pendingIds, bez patcha
  onContextMenu: (e: React.MouseEvent, task: EisenhowerTask, isPending?: boolean) => void
}) {
  const qc = useQueryClient()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `etask-${task.id}`,
    data: { type: 'eisenhower_task', task },
  })
  // Tooltip z opisem — śledzi pozycję myszy
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const tooltipTimerRef = useRef<number | null>(null)
  const latestPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const mergeRef = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el)
  }, [setNodeRef])

  const trimmedDesc = task.description?.trim() ?? ''
  const hasTooltip = trimmedDesc.length > 0 || !!(task.due_date && task.target_quadrant)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!hasTooltip || isDragging) return
    latestPos.current = { x: e.clientX, y: e.clientY }
    if (tooltipPos) setTooltipPos({ x: e.clientX, y: e.clientY })
  }
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!hasTooltip || isDragging) return
    latestPos.current = { x: e.clientX, y: e.clientY }
    tooltipTimerRef.current = window.setTimeout(() => {
      setTooltipPos({ ...latestPos.current })
    }, 300)
  }
  const handleMouseLeave = () => {
    if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = null
    setTooltipPos(null)
  }
  const deleteMut = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })
  const patchMut = useMutation({
    mutationFn: (data: Partial<EisenhowerTask>) => tasksApi.patch(task.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
    // Jeśli task jest cykliczny i właśnie go ukończono:
    // → resetuj due_date od teraz, wróć do todo, wyślij do poczekalni
    // Warunek: tylko recurrence_days wystarczy (niezależnie od target_quadrant)
    if (next === 'done' && task.recurrence_days) {
      const newDue = new Date()
      newDue.setDate(newDue.getDate() + task.recurrence_days)
      // Zachowaj istniejący target_quadrant (ustawiony przy konfiguracji cyklu)
      // Jeśli z jakiegoś powodu go nie ma, użyj aktualnego kwadrantu jako fallback
      const fallbackQ = task.target_quadrant ?? getQuadrant(task)
      patchMut.mutate({
        status: 'todo',
        due_date: newDue.toISOString(),
        target_quadrant: fallbackQ,
        urgent: false,
        important: false,
      })
      // Przenieś wizualnie do poczekalni (bez dodatkowego patcha)
      onAddToPending(task)
    } else {
      patchMut.mutate({ status: next })
    }
  }

  const statusTooltip = task.status === 'done' ? 'Ukończone — kliknij aby cofnąć' : task.status === 'in_progress' ? 'W toku — kliknij aby ukończyć' : 'Do zrobienia — kliknij aby rozpocząć'

  return (
    <>
      <div
        ref={mergeRef} {...listeners} {...attributes}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, task) }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group relative rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing select-none transition-all
          ${config.bg} border ${config.border} ${isDragging ? 'opacity-30' : 'hover:brightness-110'}`}
      >
        <div className="flex items-center gap-1.5">
          {/* Ikona statusu — CSS circle w kolorze kwadrantu */}
          <button
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg transition-all hover:scale-110"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            title={statusTooltip}
            onClick={cycleStatus}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {task.status === 'todo' && (
              <div className="w-3 h-3 rounded-full border-[1.5px] transition-all"
                style={{ borderColor: config.doneColor + 'bb' }} />
            )}
            {task.status === 'in_progress' && (
              <div className="w-3 h-3 rounded-full border-[1.5px] relative overflow-hidden transition-all"
                style={{ borderColor: config.doneColor }}>
                <div className="absolute left-0 top-0 w-1/2 h-full" style={{ backgroundColor: config.doneColor }} />
              </div>
            )}
            {task.status === 'done' && (
              <div className="w-3 h-3 rounded-full flex items-center justify-center transition-all"
                style={{ backgroundColor: config.doneColor }}>
                <span className="text-white font-bold leading-none" style={{ fontSize: '8px' }}>✓</span>
              </div>
            )}
          </button>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className={`text-xs leading-snug font-medium truncate ${config.text} ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
              {task.title}
            </span>
            {hasTooltip && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0 opacity-50" style={{ backgroundColor: config.doneColor }} />
            )}
          </div>
          {/* Przyciski akcji — kwadratowe, pojawiają się przy hover */}
          <button
            title="Cofnij do poczekalni"
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold text-white transition-all hover:brightness-125 shrink-0"
            style={{ backgroundColor: config.doneColor + 'aa' }}
            onClick={(e) => { e.stopPropagation(); onSendToPending(task) }}
            onPointerDown={(e) => e.stopPropagation()}
          >↩</button>
          <button
            title="Usuń zadanie"
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md bg-red-600/70 hover:bg-red-500 transition-all shrink-0"
            style={{ color: '#ffffff', fontSize: '12px', lineHeight: '1', fontWeight: 'bold' }}
            onClick={(e) => { e.stopPropagation(); deleteMut.mutate() }}
            onPointerDown={(e) => e.stopPropagation()}
          >✕</button>
        </div>
      </div>

      {/* Tooltip — pozycjonowany przy kursorze */}
      {tooltipPos && hasTooltip && createPortal(
        <TooltipPopup
          x={tooltipPos.x}
          y={tooltipPos.y}
          description={trimmedDesc || undefined}
          dueDate={task.due_date}
          targetQuadrant={task.target_quadrant}
          accentColor={config.doneColor}
        />,
        document.body
      )}
    </>
  )
}

// ── Kafelek w poczekalni (bez przypisanego kwadrantu) ─────────────────────────
function PendingTaskTile({
  task,
  onContextMenu,
}: {
  task: EisenhowerTask
  onContextMenu: (e: React.MouseEvent, task: EisenhowerTask, isPending?: boolean) => void
}) {
  const qc = useQueryClient()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `etask-${task.id}`,
    data: { type: 'eisenhower_task', task },
  })
  const deleteMut = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, task, true) }}
      className={`group flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2
        cursor-grab active:cursor-grabbing select-none transition-all max-w-[220px] ${isDragging ? 'opacity-30' : 'hover:bg-white/15'}`}
    >
      <span className="text-white/40 text-base shrink-0" title="Przeciągnij do kwadrantu">⠿</span>
      <span className="text-white/80 text-sm truncate">{task.title}</span>
      <button
        title="Usuń zadanie"
        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-lg leading-none shrink-0 transition-all"
        onClick={(e) => { e.stopPropagation(); deleteMut.mutate() }}
        onPointerDown={(e) => e.stopPropagation()}
      >×</button>
    </div>
  )
}

// ── Kwadrant z dropzone ───────────────────────────────────────────────────────
function QuadrantZone({
  config,
  tasks,
  onSendToPending,
  onAddToPending,
  onContextMenu,
}: {
  config: QuadrantConfig
  tasks: EisenhowerTask[]
  onSendToPending: (task: EisenhowerTask) => void
  onAddToPending: (task: EisenhowerTask) => void
  onContextMenu: (e: React.MouseEvent, task: EisenhowerTask, isPending?: boolean) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id })
  return (
    <div ref={setNodeRef}
      className={`${config.qBg} border ${config.border} rounded-2xl transition-all
        ${isOver ? 'ring-2 ring-white/30 brightness-125' : ''}`}
    >
      {/* Nagłówek kwadrantu */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b shrink-0" style={{ borderColor: `${config.doneColor}35` }}>
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-4 rounded-full" style={{ backgroundColor: config.doneColor }} />
          <span className="text-xs font-bold text-white tracking-wide">{config.label}</span>
          {tasks.length > 0 && (
            <span
              className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
              style={{ backgroundColor: `${config.doneColor}30`, color: config.doneColor }}
            >{tasks.length}</span>
          )}
        </div>
        <div className="flex gap-1 items-center">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.accent}`}
            style={{ backgroundColor: `${config.doneColor}25` }}
            title={`Pilność: ${config.urgentLabel}`}
          >{config.urgentLabel}</span>
          <span className={`text-[10px] opacity-60 font-medium ${config.accent}`} title={`Ważność: ${config.importantLabel}`}>{config.importantLabel}</span>
        </div>
      </div>
      {/* Lista zadań — rośnie z contentem, bez wewnętrznego scrolla */}
      <div className="px-2.5 py-2">
        <div className="flex flex-col gap-1">
          {tasks.map((t) => (
            <TaskTile
              key={t.id}
              task={t}
              config={config}
              onSendToPending={onSendToPending}
              onAddToPending={onAddToPending}
              onContextMenu={onContextMenu}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.doneColor}15`, border: `1px dashed ${config.doneColor}40` }}>
                <span className="text-xs" style={{ color: `${config.doneColor}60` }}>+</span>
              </div>
              <span className="text-[10px] italic" style={{ color: `${config.doneColor}50` }}>upuść tutaj</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Przeciągalny wiersz w panelu bocznym ─────────────────────────────────────
function SidebarTaskRow({
  task,
  left,
  right,
}: {
  task: EisenhowerTask
  left: React.ReactNode
  right: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `etask-${task.id}`,
    data: { type: 'eisenhower_task', task },
  })
  const cfg = quadrantConfig(task)
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border cursor-grab active:cursor-grabbing select-none transition-all"
      style={{
        backgroundColor: cfg.doneColor + '15',
        borderColor: cfg.doneColor + '40',
        opacity: isDragging ? 0.3 : 1,
      }}
      title="Przeciągnij do kwadrantu"
    >
      {left}
      <span className="text-xs text-white/60 flex-1 leading-snug truncate">{task.title}</span>
      {right}
    </div>
  )
}

// ── Panel zrealizowanych zadań ────────────────────────────────────────────────
function DonePanel({
  tasks,
  onContextMenu,
}: {
  tasks: EisenhowerTask[]
  onContextMenu: (e: React.MouseEvent, task: EisenhowerTask, isPending?: boolean) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-white/20 text-xs text-center px-4">
        <span className="text-2xl mb-1">✓</span>
        Ukończone zadania<br />pojawią się tutaj
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((t) => {
        const cfg = quadrantConfig(t)
        return (
          <div
            key={t.id}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, t) }}
          >
            <SidebarTaskRow
              task={t}
              left={<span className="text-green-400 text-xs shrink-0">✓</span>}
              right={
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full shrink-0 line-through opacity-60"
                  style={{ backgroundColor: cfg.doneColor + '25', color: cfg.doneColor }}
                >
                  {cfg.label}
                </span>
              }
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Reguła bufora: ile dni przed due_date task pojawia się w buforze ──────────
function bufferDays(totalDays: number): number {
  if (totalDays <= 5)  return 1
  if (totalDays <= 10) return 2
  if (totalDays <= 20) return 3
  if (totalDays <= 60) return 7
  return 14
}

// ── Kwadrant bufora: zachowuje ważność, usuwa pilność ─────────────────────────
// do_first (Pilne·Ważne)      → bufor: schedule (Niepilne·Ważne)
// schedule  (Niepilne·Ważne)  → bufor: schedule (bez zmian)
// delegate  (Pilne·Nieważne)  → bufor: eliminate (Niepilne·Nieważne)
// eliminate (Niepilne·Nieważne)→ bufor: eliminate (bez zmian)
function bufferQuadrant(targetQ: Quadrant): Quadrant {
  if (targetQ === 'do_first') return 'schedule'
  if (targetQ === 'delegate') return 'eliminate'
  return targetQ  // schedule i eliminate już nie mają pilności
}

// ── Modal planowania zadania w czasie ─────────────────────────────────────────
function TaskRecurModal({
  task,
  onClose,
  onSave,
}: {
  task: EisenhowerTask
  onClose: () => void
  onSave: (daysFromNow: number, targetQ: Quadrant) => void
}) {
  const [targetQ, setTargetQ] = useState<Quadrant>('do_first')
  const [days, setDays] = useState<number | null>(7)
  const [customDays, setCustomDays] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const finalDays = isCustom ? (parseInt(customDays) || null) : days
  const valid = finalDays !== null && finalDays >= 1

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const QUADRANT_BTNS = [
    { id: 'do_first' as Quadrant, label: 'Zrób teraz', sub: 'Pilne · Ważne', color: 'border-red-700 text-red-300', active: 'bg-red-700/60 border-red-500 text-red-100' },
    { id: 'schedule' as Quadrant, label: 'Zaplanuj', sub: 'Niepilne · Ważne', color: 'border-blue-700 text-blue-300', active: 'bg-blue-700/60 border-blue-500 text-blue-100' },
    { id: 'delegate' as Quadrant, label: 'Deleguj', sub: 'Pilne · Nieważne', color: 'border-yellow-700 text-yellow-300', active: 'bg-yellow-700/60 border-yellow-500 text-yellow-100' },
    { id: 'eliminate' as Quadrant, label: 'Eliminuj', sub: 'Niepilne · Nieważne', color: 'border-gray-600 text-gray-400', active: 'bg-gray-700/60 border-gray-500 text-gray-200' },
  ]

  const DAY_PRESETS = [
    { label: '3 dni', days: 3 },
    { label: '5 dni', days: 5 },
    { label: '7 dni', days: 7 },
    { label: '14 dni', days: 14 },
    { label: '30 dni', days: 30 },
    { label: '90 dni', days: 90 },
  ]

  const buf = finalDays ? bufferDays(finalDays) : null

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
        {/* Nagłówek */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">🕐 Zaplanuj w czasie</h3>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-[300px]">„{task.title}"</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
          >×</button>
        </div>

        {/* Za ile dni pojawi się w docelowym kwadrancie */}
        <div>
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-2">Pojawi się w docelowym kwadrancie za:</p>
          <div className="flex flex-wrap gap-1.5">
            {DAY_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => { setDays(p.days); setIsCustom(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  !isCustom && days === p.days
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-white/20 text-white/70 hover:border-indigo-400'
                }`}
              >{p.label}</button>
            ))}
            <button
              onClick={() => setIsCustom(true)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                isCustom
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-white/20 text-white/50 hover:border-indigo-400'
              }`}
            >Custom</button>
          </div>
          {isCustom && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={730}
                autoFocus
                placeholder="dni"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-xs text-white/40">dni (max 730)</span>
            </div>
          )}
        </div>

        {/* Kwadrant docelowy */}
        <div>
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-2">Kwadrant docelowy (po upływie czasu)</p>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANT_BTNS.map((q) => (
              <button
                key={q.id}
                onClick={() => setTargetQ(q.id)}
                className={`px-3 py-2 rounded-xl border text-left transition-all ${
                  targetQ === q.id ? q.active : `bg-white/5 ${q.color} hover:bg-white/10`
                }`}
              >
                <p className="text-sm font-semibold">{q.label}</p>
                <p className="text-xs opacity-60">{q.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Info o buforze */}
        {valid && buf !== null && (() => {
          const bq = bufferQuadrant(targetQ)
          const bqCfg = QUADRANT_BTNS.find(q => q.id === bq)
          const tqCfg = QUADRANT_BTNS.find(q => q.id === targetQ)
          const daysBeforeBuf = finalDays! - buf
          const sameQuadrant = bq === targetQ
          return (
            <div className="bg-gray-800/60 rounded-xl px-4 py-3 space-y-1 border border-white/5">
              <p className="text-xs text-white/60 leading-relaxed">
                <span className="text-indigo-300 font-semibold">Dziś</span> → zadanie ląduje w poczekalni<br/>
                {!sameQuadrant && daysBeforeBuf > 0 && (
                  <><span className="text-yellow-300 font-semibold">Za {daysBeforeBuf} {daysBeforeBuf === 1 ? 'dzień' : 'dni'}</span> → pojawia się w <span className="text-white/80">{bqCfg?.label} · {bqCfg?.sub}</span><br/></>
                )}
                <span className="text-green-300 font-semibold">Za {finalDays} {finalDays === 1 ? 'dzień' : 'dni'}</span> → przeskakuje do <span className="text-white/80">{tqCfg?.label}</span>
              </p>
            </div>
          )
        })()}

        {/* Przyciski */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white rounded-xl border border-white/10 hover:border-white/30 transition-colors"
          >Anuluj</button>
          <button
            onClick={() => valid && onSave(finalDays!, targetQ)}
            disabled={!valid}
            className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold transition-colors"
          >
            🕐 Zaplanuj
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}



// ── Modal przyspieszenia zaplanowanego zadania ────────────────────────────────
function TaskAccelerateModal({
  task,
  daysLeft,
  onClose,
  onSave,
}: {
  task: EisenhowerTask
  daysLeft: number   // ile dni pozostało do due_date
  onClose: () => void
  onSave: (reduceDays: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [customVal, setCustomVal] = useState('')

  // Max przyśpieszenie = daysLeft (pojawia się dziś/jutro)
  const maxReduce = Math.max(daysLeft - 1, 0)   // min 1 dzień pozostaje; 0 = tylko "dziś"
  const canDoToday = daysLeft >= 1

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Generuj presety na podstawie daysLeft
  const ALL_PRESETS = [1, 2, 3, 5, 7, 14, 30]
  const presets = ALL_PRESETS.filter((d) => d < daysLeft)

  const finalReduce = isCustom ? (parseInt(customVal) || null) : selected
  const resultDays = finalReduce !== null ? daysLeft - finalReduce : null
  const valid = finalReduce !== null && finalReduce >= 1 && finalReduce <= daysLeft

  const cfg = QUADRANTS.find((q) => q.id === task.target_quadrant) ?? QUADRANTS[3]

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">⚡ Przyśpiesz zadanie</h3>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-[240px]">„{task.title}"</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
          >×</button>
        </div>

        {/* Aktualny stan */}
        <div className="bg-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between border border-white/8">
          <span className="text-xs text-white/50">Pojawi się w <span className={`font-semibold ${cfg.accent}`}>{cfg.label}</span></span>
          <span className={`text-sm font-bold ${daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-white/60'}`}>
            za {daysLeft}d
          </span>
        </div>

        {/* Presety — "przyśpiesz o X dni" */}
        <div>
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Przyśpiesz o:</p>
          <div className="flex flex-wrap gap-1.5">
            {canDoToday && (
              <button
                onClick={() => { setSelected(daysLeft); setIsCustom(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                  !isCustom && selected === daysLeft
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-orange-500/40 text-orange-300 hover:border-orange-400'
                }`}
              >Dziś!</button>
            )}
            {presets.map((d) => (
              <button
                key={d}
                onClick={() => { setSelected(d); setIsCustom(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  !isCustom && selected === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-white/20 text-white/70 hover:border-indigo-400'
                }`}
              >{d}d</button>
            ))}
            {maxReduce > 0 && (
              <button
                onClick={() => setIsCustom(true)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  isCustom ? 'bg-indigo-600 text-white border-indigo-600' : 'border-white/20 text-white/50 hover:border-indigo-400'
                }`}
              >Własne</button>
            )}
          </div>
          {isCustom && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number" min={1} max={daysLeft} autoFocus
                placeholder="dni"
                value={customVal}
                onChange={(e) => setCustomVal(e.target.value)}
                className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="text-xs text-white/40">max {daysLeft} dni</span>
            </div>
          )}
        </div>

        {/* Podgląd wyniku */}
        {valid && resultDays !== null && (
          <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-4 py-2.5">
            <p className="text-xs text-white/60">
              Pojawi się za <span className="text-white font-semibold">{resultDays === 0 ? 'dziś' : `${resultDays} dni`}</span> zamiast {daysLeft} dni
            </p>
          </div>
        )}

        {/* Przyciski */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white rounded-xl border border-white/10 hover:border-white/25 transition-colors">Anuluj</button>
          <button
            onClick={() => valid && onSave(finalReduce!)}
            disabled={!valid}
            className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-400 disabled:opacity-30 text-white rounded-xl font-semibold transition-colors"
          >⚡ Przyśpiesz</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Overlay pełnoekranowy ─────────────────────────────────────────────────────
function EisenhowerOverlay({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const iconSet = useCalendarStore((s) => s.iconSet)
  const [activeTask, setActiveTask] = useState<EisenhowerTask | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [editTask, setEditTask] = useState<EisenhowerTask | null>(null)
  const [detailTask, setDetailTask] = useState<EisenhowerTask | null>(null)
  const [recurTask, setRecurTask] = useState<EisenhowerTask | null>(null)
  const [accelerateTask, setAccelerateTask] = useState<{ task: EisenhowerTask; daysLeft: number } | null>(null)
  const [scheduledCtxMenu, setScheduledCtxMenu] = useState<{ x: number; y: number; task: EisenhowerTask; daysLeft: number } | null>(null)
  const [schedTooltip, setSchedTooltip] = useState<{ x: number; y: number; task: EisenhowerTask; daysLeft: number } | null>(null)
  const schedTooltipTimer = useRef<number | null>(null)
  const schedLatestPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const scheduledCtxRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Zamknij context menu po kliknięciu poza nim
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  useEffect(() => {
    if (!scheduledCtxMenu) return
    const handler = (e: MouseEvent) => {
      if (scheduledCtxRef.current && !scheduledCtxRef.current.contains(e.target as Node)) {
        setScheduledCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [scheduledCtxMenu])

  const { data: tasks = [] } = useQuery({
    queryKey: ['eisenhower-tasks'],
    queryFn: tasksApi.list,
  })

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EisenhowerTask> }) => tasksApi.patch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })

  const deleteMutOverlay = useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] }),
  })

  // ── Auto-promocja tasków z due_date ──────────────────────────────────────────
  // Po załadowaniu tasków sprawdzamy które wymagają zmiany kwadrantu
  useEffect(() => {
    if (!tasks.length) return
    const now = new Date()
    tasks.forEach((t) => {
      if (!t.due_date || !t.target_quadrant) return
      const due = new Date(t.due_date)
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysLeft <= 0) {
        // Czas minął — przenieś do docelowego kwadrantu, wyczyść due_date
        const flags = quadrantToFlags(t.target_quadrant as Quadrant)
        if (getQuadrant(t) !== t.target_quadrant || t.due_date) {
          patchMut.mutate({ id: t.id, data: { ...flags, due_date: null, target_quadrant: null } })
          setPendingIds((prev) => { const s = new Set(prev); s.delete(t.id); return s })
        }
      } else {
        // Czas jeszcze nie minął — sprawdź czy powinien być w kwadrancie bufora
        const totalDays = Math.ceil((due.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24))
        const buf = bufferDays(totalDays)
        const bq = bufferQuadrant(t.target_quadrant as Quadrant)
        if (daysLeft <= buf && getQuadrant(t) !== bq) {
          // Przenieś do kwadrantu bufora (zachowuje ważność, usuwa pilność)
          const flags = quadrantToFlags(bq)
          patchMut.mutate({ id: t.id, data: flags })
          setPendingIds((prev) => { const s = new Set(prev); s.delete(t.id); return s })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current
    if (d?.type === 'eisenhower_task') setActiveTask(d.task)
    setContextMenu(null)
  }

  // Stan poczekalni — persystowany w localStorage żeby przeżywał zamknięcie overlay
  const PENDING_STORAGE_KEY = 'eisenhower_pending_ids'
  const [pendingIds, setPendingIdsRaw] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(PENDING_STORAGE_KEY)
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>()
    } catch { return new Set<number>() }
  })
  const setPendingIds = (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setPendingIdsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const createWithPending = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: (newTask) => {
      qc.invalidateQueries({ queryKey: ['eisenhower-tasks'] })
      setNewTitle('')
      setPendingIds((prev) => new Set([...prev, newTask.id]))
    },
  })

  const handleDragEndWithPending = (e: DragEndEvent) => {
    setActiveTask(null)
    const { over, active } = e
    if (!over) return
    const d = active.data.current
    if (d?.type !== 'eisenhower_task') return
    const task: EisenhowerTask = d.task
    const targetQ = over.id as Quadrant

    // Zawsze usuwaj z poczekalni po upuszczeniu w kwadrant
    setPendingIds((prev) => { const s = new Set(prev); s.delete(task.id); return s })

    const newFlags = quadrantToFlags(targetQ)
    const updates: Partial<EisenhowerTask> = { ...newFlags }

    // Jeśli task był ukończony — przywróć do todo
    if (task.status === 'done') {
      updates.status = 'todo'
    }
    // Jeśli task był zaplanowany — wyczyść due_date
    // Dla tasków cyklicznych (recurrence_days) zachowaj target_quadrant — to cel powrotu po ukończeniu
    if (task.due_date || task.target_quadrant) {
      updates.due_date = null
      if (!task.recurrence_days) {
        // Tylko dla nie-cyklicznych czyść target_quadrant
        updates.target_quadrant = null
      }
      // recurrence_days celowo NIE jest kasowane
    }

    patchMut.mutate({ id: task.id, data: updates })
  }

  const addTaskWithPending = () => {
    if (!newTitle.trim()) return
    createWithPending.mutate({ title: newTitle.trim(), urgent: false, important: false, status: 'todo' })
  }

  // Cofnij zadanie do poczekalni
  const sendToPending = (task: EisenhowerTask) => {
    setPendingIds((prev) => new Set([...prev, task.id]))
    // Zerujemy flagi (brak kwadrantu = poczekalnia wizualnie)
    patchMut.mutate({ id: task.id, data: { urgent: false, important: false } })
  }

  // Otwórz context menu
  const openContextMenu = (e: React.MouseEvent, task: EisenhowerTask, isPending = false) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, task, isPending })
  }

  // Poczekalnia = w pendingIds ale BEZ due_date (taski z due_date są w sekcji Zaplanowane)
  const pendingTasks = tasks.filter((t) => pendingIds.has(t.id) && !t.due_date)
  const assignedTasks = tasks.filter((t) => !pendingIds.has(t.id))
  const doneTasks = assignedTasks.filter((t) => t.status === 'done')
  const activeTasks = assignedTasks.filter((t) => t.status !== 'done')
  const tasksByQ = (q: Quadrant) => activeTasks.filter((t) => getQuadrant(t) === q)

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Główna ramka — szersza, bo mamy dwa panele */}
        <div className="m-auto w-full max-w-5xl max-h-[95vh] flex flex-col rounded-3xl overflow-hidden bg-gray-950 shadow-2xl border border-white/10">

          {/* Nagłówek */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
            <h2 className="text-white font-bold text-lg tracking-wide">Matryca Eisenhowera</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-lg font-light transition-all hover:scale-110"
              title="Zamknij"
            >×</button>
          </div>

          {/* Ciało: lewy panel (matryca) + prawy panel (ukończone) */}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndWithPending}>
          <div className="flex flex-1 overflow-hidden">

            {/* ── Lewy: matryca + poczekalnia + formularz ── */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">

                {/* Matryca 2×2 — rośnie z contentem */}
                <div className="grid grid-cols-2 gap-3">
                  {QUADRANTS.map((q) => (
                    <QuadrantZone
                      key={q.id}
                      config={q}
                      tasks={tasksByQ(q.id)}
                      onSendToPending={sendToPending}
                      onAddToPending={(t) => setPendingIds((prev) => new Set([...prev, t.id]))}
                      onContextMenu={openContextMenu}
                    />
                  ))}
                </div>

                {/* Poczekalnia */}
                {pendingTasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">
                      Przeciągnij do kwadrantu ↑
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pendingTasks.map((t) => (
                        <PendingTaskTile key={t.id} task={t} onContextMenu={openContextMenu} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Formularz dodawania */}
                <div className="relative flex gap-2 items-center">
                  <label className="absolute -top-2 left-4 bg-gray-950 px-1 text-xs font-medium text-white/30">Nowe zadanie</label>
                  <input
                    placeholder="Tytuł... (Enter aby dodać)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTaskWithPending()}
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                  <button
                    onClick={addTaskWithPending}
                    disabled={!newTitle.trim() || createWithPending.isPending}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
                  >
                    + Dodaj
                  </button>
                </div>

              </div>

            {/* ── Prawy: ukończone + cykliczne + ikony robocze ── */}
            <div className="w-64 shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
              {/* Ukończone */}
              <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Ukończone</span>
                <span className="text-xs text-white/30 bg-white/5 rounded-full px-2 py-0.5">{doneTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <DonePanel tasks={doneTasks} onContextMenu={openContextMenu} />
              </div>

              {/* Zaplanowane w czasie */}
              {(() => {
                // Zaplanowane = taski w poczekalni z due_date (czekają na swój czas)
                const scheduledTasks = tasks.filter((t) => t.due_date && t.target_quadrant && pendingIds.has(t.id))
                if (scheduledTasks.length === 0) return null
                return (
                  <div className="border-t border-white/10 shrink-0">
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Zaplanowane</span>
                      <span className="text-xs text-white/30 bg-white/5 rounded-full px-2 py-0.5">{scheduledTasks.length}</span>
                    </div>
                     <div className="px-3 pb-2 space-y-1.5 max-h-40 overflow-y-auto">
                       {scheduledTasks.map((t) => {
                         const due = new Date(t.due_date!)
                         const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                         const cfg = QUADRANTS.find((q) => q.id === t.target_quadrant)
                         return (
                           <div
                             key={t.id}
                             onContextMenu={(e) => {
                               e.preventDefault()
                               setScheduledCtxMenu({ x: e.clientX, y: e.clientY, task: t, daysLeft })
                             }}
                             onMouseEnter={(e) => {
                               schedLatestPos.current = { x: e.clientX, y: e.clientY }
                               schedTooltipTimer.current = window.setTimeout(() => {
                                 setSchedTooltip({ ...schedLatestPos.current, task: t, daysLeft })
                               }, 300)
                             }}
                             onMouseMove={(e) => {
                               schedLatestPos.current = { x: e.clientX, y: e.clientY }
                               if (schedTooltip) setSchedTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                             }}
                             onMouseLeave={() => {
                               if (schedTooltipTimer.current) window.clearTimeout(schedTooltipTimer.current)
                               setSchedTooltip(null)
                             }}
                           >
                             <SidebarTaskRow
                               task={t}
                               left={<span className="text-xs shrink-0">🕐</span>}
                               right={
                                 <div className="text-right shrink-0">
                                   <p className={`text-xs font-semibold ${daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-white/40'}`}>
                                     {daysLeft <= 0 ? 'dziś!' : `za ${daysLeft}d`}
                                   </p>
                                   {cfg && <p className={`text-xs ${cfg.accent} opacity-70`}>{cfg.label}</p>}
                                 </div>
                               }
                             />
                           </div>
                         )
                       })}
                     </div>
                  </div>
                )
              })()}


            </div>

          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-gray-700 border border-white/20 rounded-lg shadow-2xl px-3 py-2 text-xs text-white font-medium opacity-95 cursor-grabbing">
                {activeTask.title}
              </div>
            )}
          </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* ── Menu kontekstowe ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[70] bg-gray-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
            onClick={() => { setEditTask(contextMenu.task); setContextMenu(null) }}
          >
             <IconRenderer icon="✏️" iconSet={iconSet} size={16} /> Edytuj
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
            onClick={() => { setDetailTask(contextMenu.task); setContextMenu(null) }}
          >
            <IconRenderer icon="🔍" iconSet={iconSet} size={16} /> Powiększ
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
            onClick={() => { setRecurTask(contextMenu.task); setContextMenu(null) }}
          >
            <IconRenderer icon="🔁" iconSet={iconSet} size={16} /> Cykliczne
          </button>
          {!contextMenu.isPending && (
            <>
              <div className="border-t border-white/10 my-1" />
              <button
                className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                onClick={() => { sendToPending(contextMenu.task); setContextMenu(null) }}
              >
                <IconRenderer icon="↩" iconSet={iconSet} size={16} /> Cofnij do poczekalni
              </button>
            </>
          )}
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            onClick={() => { deleteMutOverlay.mutate(contextMenu.task.id); setContextMenu(null) }}
          >
            <IconRenderer icon="🗑️" iconSet={iconSet} size={16} /> Usuń
          </button>
        </div>
      )}

      {/* ── Modal edycji ── */}
      {editTask && (
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(data) => {
            patchMut.mutate({ id: editTask.id, data })
          }}
        />
      )}

      {/* ── Modal podglądu ── */}
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}

      {/* ── Modal planowania w czasie ── */}
      {recurTask && (
        <TaskRecurModal
          task={recurTask}
          onClose={() => setRecurTask(null)}
          onSave={(daysFromNow, targetQ) => {
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + daysFromNow)
            patchMut.mutate({
              id: recurTask.id,
              data: {
                due_date: dueDate.toISOString(),
                target_quadrant: targetQ,
                recurrence_days: daysFromNow,
              },
            })
            setRecurTask(null)
          }}
        />
      )}

      {/* ── Menu kontekstowe Zaplanowanych ── */}
      {scheduledCtxMenu && createPortal(
        <div
          ref={scheduledCtxRef}
          className="fixed z-[70] bg-gray-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[180px]"
          style={{ left: scheduledCtxMenu.x, top: scheduledCtxMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/15 flex items-center gap-2 font-medium"
            onClick={() => {
              setAccelerateTask({ task: scheduledCtxMenu.task, daysLeft: scheduledCtxMenu.daysLeft })
              setScheduledCtxMenu(null)
            }}
          >
            <IconRenderer icon="⚡" iconSet={iconSet} size={16} /> Przyśpiesz
          </button>
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
            onClick={() => { setEditTask(scheduledCtxMenu.task); setScheduledCtxMenu(null) }}
          >
            <IconRenderer icon="✏️" iconSet={iconSet} size={16} /> Edytuj
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
            onClick={() => { sendToPending(scheduledCtxMenu.task); setScheduledCtxMenu(null) }}
          >
            <IconRenderer icon="↩" iconSet={iconSet} size={16} /> Cofnij do poczekalni
          </button>
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            onClick={() => { deleteMutOverlay.mutate(scheduledCtxMenu.task.id); setScheduledCtxMenu(null) }}
          >
            <IconRenderer icon="🗑️" iconSet={iconSet} size={16} /> Usuń
          </button>
        </div>,
        document.body,
      )}

      {/* ── Tooltip zaplanowanych ── */}
      {schedTooltip && createPortal(
        <TooltipPopup
          x={schedTooltip.x}
          y={schedTooltip.y}
          dueDate={schedTooltip.task.due_date}
          targetQuadrant={schedTooltip.task.target_quadrant}
          accentColor={QUADRANTS.find(q => q.id === schedTooltip.task.target_quadrant)?.doneColor ?? '#6b7280'}
          showBufferPath
        />,
        document.body,
      )}

      {/* ── Modal przyspieszenia ── */}
      {accelerateTask && (
        <TaskAccelerateModal
          task={accelerateTask.task}
          daysLeft={accelerateTask.daysLeft}
          onClose={() => setAccelerateTask(null)}
          onSave={(reduceDays) => {
            const t = accelerateTask.task
            const newDue = new Date(t.due_date!)
            newDue.setDate(newDue.getDate() - reduceDays)
            const newDaysLeft = accelerateTask.daysLeft - reduceDays
            const targetQ = (t.target_quadrant ?? 'do_first') as Quadrant

            if (newDaysLeft <= 0) {
              // Czas minął — przenieś od razu do docelowego kwadrantu
              const flags = quadrantToFlags(targetQ)
              patchMut.mutate({ id: t.id, data: { ...flags, due_date: null, target_quadrant: null } })
              setPendingIds((prev) => { const s = new Set(prev); s.delete(t.id); return s })
            } else {
              // Sprawdź czy nowy czas mieści się w oknie bufora
              const originalDays = t.recurrence_days ?? accelerateTask.daysLeft
              const buf = bufferDays(originalDays)
              const bq = bufferQuadrant(targetQ)
              if (newDaysLeft <= buf) {
                // Przenieś do kwadrantu bufora — widoczny w matrycy
                const flags = quadrantToFlags(bq)
                patchMut.mutate({ id: t.id, data: { ...flags, due_date: newDue.toISOString() } })
                setPendingIds((prev) => { const s = new Set(prev); s.delete(t.id); return s })
              } else {
                // Jeszcze poza buforem — tylko zaktualizuj datę
                patchMut.mutate({ id: t.id, data: { due_date: newDue.toISOString() } })
              }
            }
            setAccelerateTask(null)
          }}
        />
      )}
    </>,
    document.body,
  )
}

// ── Kompaktowy widok w sidebarze ─────────────────────────────────────────────
export function EisenhowerMatrix() {
  const [open, setOpen] = useState(false)
  const { data: tasks = [] } = useQuery({
    queryKey: ['eisenhower-tasks'],
    queryFn: tasksApi.list,
  })
  const countByQ = (q: Quadrant) => tasks.filter((t) => getQuadrant(t) === q && t.status !== 'done').length

  // Draggable — cały widget można przeciągnąć na kalendarz
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'eisenhower-widget',
    data: { type: 'eisenhower_widget' },
  })

  // Ref do śledzenia drag-w-toku — żeby onClick nie otworzyło overlay po dragu
  const wasDraggingRef = useRef(false)
  useEffect(() => {
    if (isDragging) wasDraggingRef.current = true
  }, [isDragging])

  const handleClick = () => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false
      return
    }
    setOpen(true)
  }

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Matryca Eisenhowera</h2>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={handleClick}
          className={`w-full grid grid-cols-2 gap-1.5 group cursor-grab active:cursor-grabbing select-none ${isDragging ? 'opacity-50' : ''}`}
        >
          {[
            { id: 'do_first' as Quadrant, label: 'Zrób teraz', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', color: '#ef4444' },
            { id: 'schedule' as Quadrant, label: 'Zaplanuj', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', color: '#3b82f6' },
            { id: 'delegate' as Quadrant, label: 'Deleguj', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', color: '#eab308' },
            { id: 'eliminate' as Quadrant, label: 'Eliminuj', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.35)', color: '#6b7280' },
          ].map((q) => (
            <div
              key={q.id}
              className="rounded-xl px-2.5 py-2 text-left transition-all group-hover:brightness-110 border"
              style={{ backgroundColor: q.bg, borderColor: q.border }}
            >
              <div className="text-xs font-medium" style={{ color: q.color }}>{q.label}</div>
              <div className="text-xl font-bold leading-none mt-0.5 text-white">{countByQ(q.id)}</div>
            </div>
          ))}
        </div>
      </div>
      {open && <EisenhowerOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
