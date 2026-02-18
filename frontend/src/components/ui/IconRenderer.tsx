/**
 * IconRenderer — renderuje ikonę na podstawie stringa w formacie:
 *   - emoji:  "📚"  (dowolny string nie zaczynający się od prefiksu)
 *   - lucide: "lu:LuHome"
 *
 * Używa statycznego importu react-icons/lu (działa prawidłowo z Vite).
 *
 * Opcjonalny prop `iconSet` umożliwia globalny przełącznik:
 * gdy iconSet='lu', emoji są automatycznie mapowane na Lucide.
 */

import { memo } from 'react'
import type { IconType } from 'react-icons'
import * as LuIcons from 'react-icons/lu'
import { IconSetId, resolveIconForSet } from '../../lib/iconSets'

interface Props {
  icon: string
  size?: number
  className?: string
  style?: React.CSSProperties
  /** Gdy podany — emoji są automatycznie zamieniane na odpowiednik Lucide */
  iconSet?: IconSetId
}

export function isReactIcon(icon: string): boolean {
  return icon.includes(':')
}

function resolveIcon(iconStr: string): IconType | null {
  if (!isReactIcon(iconStr)) return null
  const [prefix, name] = iconStr.split(':')
  if (prefix === 'lu') {
    return (LuIcons as unknown as Record<string, IconType>)[name] ?? null
  }
  return null
}

export const IconRenderer = memo(function IconRenderer({ icon, size = 16, className, style, iconSet }: Props) {
  // Globalny przełącznik — zamień emoji na Lucide jeśli podano iconSet
  const resolvedIcon = iconSet ? resolveIconForSet(icon, iconSet) : icon

  // Emoji / zwykły string
  if (!isReactIcon(resolvedIcon)) {
    return <span className={className} style={style}>{resolvedIcon}</span>
  }

  const IconComponent = resolveIcon(resolvedIcon)

  if (IconComponent) {
    return <IconComponent size={size} className={className} style={style} />
  }

  // Nieznany prefiks / nieznana ikona — fallback
  return <span className={`inline-block bg-gray-200 rounded ${className ?? ''}`} style={{ width: size, height: size, ...style }} />
})

/** Konwertuje nazwę ikony do stringa z prefiksem dla danego setu */
export function formatIconId(setId: IconSetId, iconName: string): string {
  if (setId === 'emoji') return iconName
  return `${setId}:${iconName}`
}

/** Zwraca prefix z iconId np. "lu:LuActivity" → "lu" */
export function getIconPrefix(iconStr: string): IconSetId {
  if (!iconStr.includes(':')) return 'emoji'
  return iconStr.split(':')[0] as IconSetId
}
