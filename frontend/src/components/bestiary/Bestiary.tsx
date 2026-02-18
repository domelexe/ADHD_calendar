import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi } from '../../api/contacts'
import { Contact } from '../../types'
import { useCalendarStore } from '../../store/calendarStore'
import { IconRenderer } from '../ui/IconRenderer'

// ── Sprawdzenie czy dzisiaj są urodziny ────────────────────────────────────────
export function isBirthdayToday(birthday: string): boolean {
  const today = new Date()
  const bd = new Date(birthday)
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate()
}

// ── Ile dni do urodzin ────────────────────────────────────────────────────────
function daysUntilBirthday(birthday: string): number {
  const today = new Date()
  const bd = new Date(birthday)
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ contact, size = 'md' }: { contact?: Partial<Contact>; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'w-9 h-9 text-sm' : size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-11 h-11 text-base'
  const name = contact?.name ?? ''
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center shrink-0 overflow-hidden font-bold text-indigo-300 relative border border-white/10`}>
      {contact?.photo_url ? (
        <img src={contact.photo_url} alt={name} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <span>{name ? name[0].toUpperCase() : '?'}</span>
      )}
    </div>
  )
}

// ── Formularz kontaktu (inline w prawym panelu) ───────────────────────────────
function ContactForm({
  contact,
  onSave,
  onCancel,
  onDelete,
}: {
  contact?: Contact
  onSave: (data: Omit<Contact, 'id' | 'user_id' | 'created_at'>) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [photoUrl, setPhotoUrl] = useState(contact?.photo_url ?? '')

  // Data urodzin rozbita na DD / MM / YYYY
  const parseBirthday = (iso?: string) => {
    if (!iso) return { dd: '', mm: '', yyyy: '' }
    const [y, m, d] = iso.split('-')
    return { dd: d ?? '', mm: m ?? '', yyyy: y ?? '' }
  }
  const init = parseBirthday(contact?.birthday)
  const [bdDay, setBdDay] = useState(init.dd)
  const [bdMonth, setBdMonth] = useState(init.mm)
  const [bdYear, setBdYear] = useState(init.yyyy)

  // Złożony ISO string, gdy wszystkie pola wypełnione
  const birthdayISO = bdDay && bdMonth && bdYear && bdYear.length === 4
    ? `${bdYear}-${bdMonth.padStart(2, '0')}-${bdDay.padStart(2, '0')}`
    : ''

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      birthday: birthdayISO || undefined,
      photo_url: photoUrl.trim() || undefined,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Avatar + imię */}
        <div className="flex items-center gap-4">
          <Avatar contact={{ name, photo_url: photoUrl }} size="lg" />
          <div className="flex-1 space-y-1.5">
            <input
              autoFocus
              placeholder="Imię i nazwisko *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
            />
            <input
              placeholder="URL zdjęcia (opcjonalnie)"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/40 font-medium block mb-1.5">📞 Telefon</label>
          <input
            type="tel"
            placeholder="+48 000 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="text-xs text-white/40 font-medium block mb-1.5">🎂 Data urodzin</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="DD"
              min={1} max={31}
              value={bdDay}
              onChange={(e) => setBdDay(e.target.value)}
              className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-white text-center placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 [appearance:textfield]"
            />
            <span className="text-white/30">/</span>
            <input
              type="number"
              placeholder="MM"
              min={1} max={12}
              value={bdMonth}
              onChange={(e) => setBdMonth(e.target.value)}
              className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-white text-center placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 [appearance:textfield]"
            />
            <span className="text-white/30">/</span>
            <input
              type="number"
              placeholder="RRRR"
              min={1900} max={2100}
              value={bdYear}
              onChange={(e) => setBdYear(e.target.value)}
              className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-white text-center placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 [appearance:textfield]"
            />
          </div>
          {birthdayISO && (
            <p className="text-xs text-white/30 mt-1">
              {isBirthdayToday(birthdayISO) ? '🎉 Dzisiaj!' : `Za ${daysUntilBirthday(birthdayISO)} dni`}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-white/40 font-medium block mb-1.5">📝 Notatki</label>
          <textarea
            placeholder="Notatki o osobie..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs text-red-400 border border-red-400/30 rounded-lg px-3 py-1.5 hover:bg-red-400/10 transition-colors"
          >
            Usuń
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="text-xs text-white/50 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors"
        >
          Anuluj
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg px-4 py-1.5 font-semibold transition-colors"
        >
          Zapisz
        </button>
      </div>
    </div>
  )
}

// ── Widok szczegółów kontaktu ─────────────────────────────────────────────────
function ContactDetail({
  contact,
  hideNotesBehindPin,
  onEdit,
}: {
  contact: Contact
  hideNotesBehindPin: boolean
  onEdit: () => void
}) {
  const [notesVisible, setNotesVisible] = useState(false)
  const isToday = contact.birthday ? isBirthdayToday(contact.birthday) : false
  const daysLeft = contact.birthday ? daysUntilBirthday(contact.birthday) : null

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Avatar + imię */}
        <div className="flex items-center gap-4">
          <Avatar contact={contact} size="lg" />
          <div>
            <h3 className="text-white font-bold text-lg leading-snug">{contact.name}</h3>
            {isToday && <p className="text-red-400 text-sm font-medium">🎂 Dzisiaj urodziny!</p>}
            {!isToday && daysLeft !== null && daysLeft <= 30 && (
              <p className={`text-sm ${daysLeft <= 7 ? 'text-orange-400 font-medium' : 'text-white/40'}`}>
                🎂 Za {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'}
              </p>
            )}
          </div>
        </div>

        {contact.phone && (
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Telefon</p>
            <a href={`tel:${contact.phone}`} className="text-indigo-300 hover:text-indigo-200 text-sm font-medium">
              {contact.phone}
            </a>
          </div>
        )}

        {contact.birthday && (
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Data urodzin</p>
            <p className="text-white/80 text-sm">
              {new Date(contact.birthday).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {contact.notes && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-white/30 uppercase tracking-wider">Notatki</p>
              {hideNotesBehindPin && (
                <button
                  onClick={() => setNotesVisible((v) => !v)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  title={notesVisible ? 'Ukryj notatki' : 'Pokaż notatki'}
                >
                  {notesVisible ? '🔓' : '📌'}
                </button>
              )}
            </div>
            {(!hideNotesBehindPin || notesVisible) ? (
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
            ) : (
              <p className="text-white/20 text-xs italic">Notatki ukryte — kliknij 📌 aby odsłonić</p>
            )}
          </div>
        )}
      </div>

      {/* Okrągły przycisk edycji w prawym dolnym rogu */}
      <button
        onClick={onEdit}
        className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 text-base"
        title="Edytuj kontakt"
      >
        ✏️
      </button>
    </div>
  )
}

// ── Wiersz na liście ──────────────────────────────────────────────────────────
function ContactRow({
  contact,
  selected,
  onClick,
}: {
  contact: Contact
  selected: boolean
  onClick: () => void
}) {
  const isToday = contact.birthday ? isBirthdayToday(contact.birthday) : false
  const daysLeft = contact.birthday ? daysUntilBirthday(contact.birthday) : null
  const soon = daysLeft !== null && daysLeft <= 7 && !isToday

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
        selected ? 'bg-indigo-600/20 border-r-2 border-indigo-500' : 'hover:bg-white/5'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar contact={contact} size="sm" />
        {isToday && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 animate-pulse border-2 border-gray-950" />}
        {soon && !isToday && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-gray-950" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white/90 truncate">
          {contact.name} {isToday && '🎂'}
        </div>
        {contact.phone && <div className="text-xs text-white/30 truncate">{contact.phone}</div>}
      </div>
    </button>
  )
}

// ── Główny overlay ────────────────────────────────────────────────────────────
export function BestiaryOverlay({ onClose, initialContactId }: { onClose: () => void; initialContactId?: number }) {
  const qc = useQueryClient()
  const hideNotesBehindPin = useCalendarStore((s) => s.hideContactNotes)

  const [selectedId, setSelectedId] = useState<number | null>(initialContactId ?? null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>(initialContactId ? 'view' : 'view')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.list,
  })

  const createMut = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: (newContact) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setSelectedId(newContact.id)
      setMode('view')
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Contact> }) => contactsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setMode('view')
    },
  })
  const deleteMut = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setSelectedId(null)
      setMode('view')
    },
  })

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  )

  const sorted = [...filtered].sort((a, b) => {
    const aToday = a.birthday ? isBirthdayToday(a.birthday) : false
    const bToday = b.birthday ? isBirthdayToday(b.birthday) : false
    if (aToday && !bToday) return -1
    if (!aToday && bToday) return 1
    const aDays = a.birthday ? daysUntilBirthday(a.birthday) : 999
    const bDays = b.birthday ? daysUntilBirthday(b.birthday) : 999
    if (aDays <= 7 && bDays > 7) return -1
    if (aDays > 7 && bDays <= 7) return 1
    return a.name.localeCompare(b.name, 'pl')
  })

  const selected = contacts.find((c) => c.id === selectedId) ?? null

  // Gdy kliknięto kontakt na liście — przejdź do widoku
  const handleSelect = (c: Contact) => {
    setSelectedId(c.id)
    setMode('view')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl h-[85vh] flex rounded-3xl overflow-hidden bg-gray-950 shadow-2xl border border-white/10">

        {/* ── Lewa: lista kontaktów ── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-white/10">
          {/* Nagłówek listy */}
          <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-base">📖 Bestiariusz</h2>
              <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
            </div>
            <button
              onClick={() => { setSelectedId(null); setMode('new') }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-2 transition-colors"
            >
              + Dodaj kontakt
            </button>
            <input
              placeholder="Szukaj..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-white/20 text-xs italic px-4 text-center">
                {contacts.length === 0 ? 'Brak kontaktów.' : 'Brak wyników.'}
              </div>
            ) : (
              sorted.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  selected={selectedId === c.id && mode !== 'new'}
                  onClick={() => handleSelect(c)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Prawa: szczegóły / formularz ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {mode === 'new' && (
            <>
              <div className="px-5 py-3 border-b border-white/10 shrink-0">
                <h3 className="text-white font-semibold text-sm">Nowy kontakt</h3>
              </div>
              <div className="flex-1 min-h-0">
                <ContactForm
                  onSave={(data) => createMut.mutate(data)}
                  onCancel={() => setMode('view')}
                />
              </div>
            </>
          )}

          {mode === 'edit' && selected && (
            <>
              <div className="px-5 py-3 border-b border-white/10 shrink-0">
                <h3 className="text-white font-semibold text-sm">Edytuj kontakt</h3>
              </div>
              <div className="flex-1 min-h-0">
                <ContactForm
                  contact={selected}
                  onSave={(data) => updateMut.mutate({ id: selected.id, data })}
                  onCancel={() => setMode('view')}
                  onDelete={() => deleteMut.mutate(selected.id)}
                />
              </div>
            </>
          )}

          {mode === 'view' && selected && (
            <>
              <div className="px-5 py-3 border-b border-white/10 shrink-0">
                <h3 className="text-white font-semibold text-sm">Szczegóły</h3>
              </div>
              <div className="flex-1 min-h-0 relative">
                <ContactDetail
                  contact={selected}
                  hideNotesBehindPin={hideNotesBehindPin}
                  onEdit={() => setMode('edit')}
                />
              </div>
            </>
          )}

          {mode === 'view' && !selected && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 text-sm gap-2">
              <span className="text-5xl">👈</span>
              Wybierz kontakt z listy
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body,
  )
}

// ── Kompaktowy przycisk w sidebarze ──────────────────────────────────────────
export function Bestiary() {
  const [open, setOpen] = useState(false)
  const iconSet = useCalendarStore((s) => s.iconSet)
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.list,
  })
  const todayBirthdays = contacts.filter((c) => c.birthday && isBirthdayToday(c.birthday))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between group hover:bg-gray-50 rounded-lg px-1 py-1 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><IconRenderer icon="📖" iconSet={iconSet} size={13} /> Bestiariusz</h2>
          {todayBirthdays.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <span className="text-xs text-indigo-600 group-hover:text-indigo-800 font-medium">
          {contacts.length > 0 ? `${contacts.length} kontaktów →` : 'Otwórz →'}
        </span>
      </button>
      {open && <BestiaryOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
