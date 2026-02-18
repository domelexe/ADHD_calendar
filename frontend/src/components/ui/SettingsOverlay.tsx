import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCalendarStore, ViewMode, FirstDayOfWeek } from '../../store/calendarStore'
import { ICON_SETS } from '../../lib/iconSets'
import { IconRenderer, formatIconId } from '../ui/IconRenderer'
import { changePassword } from '../../api/auth'

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i) // 0–24

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const {
    viewMode, setViewMode,
    firstDayOfWeek, setFirstDayOfWeek,
    hourStart, setHourStart,
    hourEnd, setHourEnd,
    hideContactNotes, setHideContactNotes,
    iconSet, setIconSet,
  } = useCalendarStore()

  const [hoursExpanded, setHoursExpanded] = useState(false)

  // Zmiana hasła
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  async function handleChangePassword() {
    setPwError(null)
    setPwSuccess(false)
    if (pwNew.length < 8) { setPwError('Nowe hasło musi mieć co najmniej 8 znaków'); return }
    if (pwNew !== pwConfirm) { setPwError('Hasła nie są identyczne'); return }
    setPwLoading(true)
    try {
      await changePassword(pwCurrent, pwNew)
      setPwSuccess(true)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPwError(msg ?? 'Błąd zmiany hasła')
    } finally {
      setPwLoading(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const DAY_OPTIONS: { day: FirstDayOfWeek; label: string; full: string }[] = [
    { day: 1, label: 'Pn', full: 'Poniedziałek' },
    { day: 2, label: 'Wt', full: 'Wtorek' },
    { day: 3, label: 'Śr', full: 'Środa' },
    { day: 4, label: 'Cz', full: 'Czwartek' },
    { day: 5, label: 'Pt', full: 'Piątek' },
    { day: 6, label: 'Sb', full: 'Sobota' },
    { day: 0, label: 'Nd', full: 'Niedziela' },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Ustawienia kalendarza</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none transition-colors"
          >✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-8">

          {/* ── Tryb widoku ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tryb widoku</h3>
            <div className="space-y-2">
              {([
                {
                  mode: 'dynamic' as ViewMode,
                  icon: '📅',
                  label: 'Dynamiczny',
                  desc: 'Zawsze zaczyna od wczoraj; etykiety: Wczoraj / Dziś / Jutro',
                },
                {
                  mode: 'static' as ViewMode,
                  icon: '📆',
                  label: 'Statyczny',
                  desc: 'Klasyczny tydzień z wybranym pierwszym dniem',
                },
              ]).map(({ mode, icon, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`w-full flex items-start gap-4 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    viewMode === mode
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm ${viewMode === mode ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {label} {viewMode === mode && '✓'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pierwszy dzień tygodnia — tylko tryb statyczny */}
            {viewMode === 'static' && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 font-medium mb-2">Pierwszy dzień tygodnia</p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_OPTIONS.map(({ day, label, full }) => (
                    <button
                      key={day}
                      onClick={() => setFirstDayOfWeek(day)}
                      title={full}
                      className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                        firstDayOfWeek === day
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Godziny dnia ── */}
          <section>
            <button
              onClick={() => setHoursExpanded(v => !v)}
              className="w-full flex items-center justify-between text-left group"
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Godziny dnia</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">
                  {hourStart}:00 – {hourEnd}:00 ({hourEnd - hourStart}h)
                </span>
                <span className={`text-gray-400 text-xs transition-transform duration-200 ${hoursExpanded ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>

            {hoursExpanded && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Początek dnia</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 6, 7, 8, 9, 10].map((h) => (
                        <button
                          key={h}
                          onClick={() => { if (h < hourEnd) setHourStart(h) }}
                          className={`text-xs px-2.5 py-1 rounded-full border-2 font-medium transition-all ${
                            hourStart === h
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : h >= hourEnd
                              ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                              : 'border-gray-200 text-gray-600 hover:border-indigo-400'
                          }`}
                        >
                          {h}:00
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">lub wpisz:</span>
                      <input
                        type="number"
                        min={0}
                        max={hourEnd - 1}
                        value={hourStart}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(hourEnd - 1, Number(e.target.value)))
                          setHourStart(v)
                        }}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <span className="text-xs text-gray-400">:00</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Koniec dnia</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[18, 20, 22, 23, 24].map((h) => (
                        <button
                          key={h}
                          onClick={() => { if (h > hourStart) setHourEnd(h) }}
                          className={`text-xs px-2.5 py-1 rounded-full border-2 font-medium transition-all ${
                            hourEnd === h
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : h <= hourStart
                              ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                              : 'border-gray-200 text-gray-600 hover:border-indigo-400'
                          }`}
                        >
                          {h}:00
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">lub wpisz:</span>
                      <input
                        type="number"
                        min={hourStart + 1}
                        max={24}
                        value={hourEnd}
                        onChange={(e) => {
                          const v = Math.max(hourStart + 1, Math.min(24, Number(e.target.value)))
                          setHourEnd(v)
                        }}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <span className="text-xs text-gray-400">:00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Zestaw ikon ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Zestaw ikon aktywności</h3>
            <div className="grid grid-cols-2 gap-2">
              {ICON_SETS.map((set) => (
                <button
                  key={set.id}
                  onClick={() => setIconSet(set.id)}
                  className={`flex flex-col gap-2 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    iconSet === set.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${iconSet === set.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {set.name} {iconSet === set.id && '✓'}
                    </span>
                  </div>
                  {/* Podgląd 5 ikon */}
                  <div className="flex gap-1.5 items-center">
                    {set.preview.map((ic) => (
                      <span key={ic} className={`${iconSet === set.id ? 'text-indigo-600' : 'text-gray-500'}`}>
                        <IconRenderer
                          icon={formatIconId(set.id, ic)}
                          size={18}
                        />
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">{set.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ── Prywatność ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Prywatność</h3>
            <button
              onClick={() => setHideContactNotes(!hideContactNotes)}
              className={`w-full flex items-start gap-4 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                hideContactNotes
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl shrink-0 mt-0.5">📌</span>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${hideContactNotes ? 'text-indigo-700' : 'text-gray-800'}`}>
                  Ukryj notatki kontaktów za pinem {hideContactNotes && '✓'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 leading-snug">
                  Notatki w Bestiariuszu będą widoczne dopiero po kliknięciu 📌
                </div>
              </div>
            </button>
          </section>


          {/* ── Zmiana hasła ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Zmiana hasła</h3>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Aktualne hasło"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="password"
                placeholder="Nowe hasło (min. 8 zn., wielka litera, cyfra, znak specjalny)"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="password"
                placeholder="Powtórz nowe hasło"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-600">Hasło zostało zmienione.</p>}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
              >
                {pwLoading ? 'Zapisywanie…' : 'Zmień hasło'}
              </button>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
