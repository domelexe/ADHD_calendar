/**
 * Konfiguracja zestawów ikon.
 * Dwa zestawy: Emoji (klasyczne) i Lucide (SVG).
 * Ikona przechowywana jako string:
 *   - emoji: "📚"
 *   - lucide: "lu:LuActivity"
 */

export type IconSetId = 'emoji' | 'lu'

export interface IconSetConfig {
  id: IconSetId
  name: string
  description: string
  preview: string[]
  icons: string[]
}

// ── Emoji ─────────────────────────────────────────────────────────────────────
const EMOJI_ICONS = [
  '📚','💼','🏃','🤝','🚀','😴','🎯','🎨','🔬','🍎','⭐','🏠',
  '🧘','🎵','🖥️','✈️','🍕','🏋️','📝','💡','🌿','🐾',
  '🔥','💪','🎓','🏆','💰','🛒','🚗','⚽','🎮','📱',
  '🧠','❤️','🌍','🌙','☀️','🔑','🛡️','⚡','🎪','🎭',
  '🍀','🌸','🦋','🐶','🐱','🎃','🎄','🎁','🎉','🔔',
]

// ── Lucide — starannie dobrane ikony ─────────────────────────────────────────
export const LUCIDE_ICONS = [
  // Czas i kalendarz
  'LuCalendar','LuCalendarCheck','LuCalendarDays','LuClock','LuAlarmClock',
  'LuTimer','LuHourglass','LuSunrise','LuSunset','LuSun','LuMoon',
  // Praca i nauka
  'LuBriefcase','LuBookOpen','LuBook','LuGraduationCap','LuPenLine',
  'LuNotebook','LuFileText','LuClipboard','LuPresentation','LuMonitor',
  'LuCode','LuTerminal','LuDatabase','LuServer','LuFilePen',
  // Aktywność i zdrowie
  'LuActivity','LuHeart','LuHeartPulse','LuDumbbell','LuBicepsFlexed',
  'LuPersonStanding','LuFootprints','LuApple','LuSalad','LuPawPrint',
  'LuPill','LuStethoscope','LuBrain','LuEye','LuSmile',
  // Dom i codzienny
  'LuHouse','LuSofa','LuBed','LuUtensils','LuCoffee',
  'LuCupSoda','LuShoppingCart','LuShoppingBag','LuPackage','LuWashingMachine',
  'LuTv','LuPhone','LuSmartphone','LuWifi','LuLampDesk',
  // Transport
  'LuCar','LuBike','LuBus','LuTrainFront','LuPlane',
  'LuShip','LuTruck','LuMapPin','LuMap','LuNavigation',
  // Finanse
  'LuWallet','LuCreditCard','LuBanknote','LuPiggyBank','LuTrendingUp',
  'LuChartBar','LuDollarSign','LuReceipt','LuCoins','LuChartLine',
  // Hobby i rozrywka
  'LuMusic','LuHeadphones','LuMic','LuGuitar','LuDrum',
  'LuGamepad2','LuFilm','LuCamera','LuPaintbrush','LuPalette',
  'LuPenTool','LuCrop','LuImage','LuGalleryHorizontal','LuFramer',
  // Sport
  'LuTrophy','LuMedal','LuTarget','LuCrosshair','LuFlag',
  'LuMountain','LuWaves','LuFlame','LuZap','LuBolt',
  // Komunikacja i social
  'LuMessageCircle','LuMessageSquare','LuMail','LuBell','LuBellRing',
  'LuShare2','LuLink','LuGlobe','LuUsers','LuUser',
  'LuUserCheck','LuUserPlus','LuHandshake','LuSmilePlus','LuPartyPopper',
  // Narzędzia
  'LuSettings','LuSettings2','LuWrench','LuHammer','LuNut',
  'LuPencil','LuPencilLine','LuTrash2','LuArchive','LuBookmark',
  'LuTag','LuTags','LuFolderOpen','LuFolder','LuFilePen',
  // Natura
  'LuLeaf','LuTreeDeciduous','LuTrees','LuFlower','LuSprout',
  'LuCloud','LuCloudRain','LuSnowflake','LuWind','LuThermometer','LuDroplets',
  // Inne
  'LuStar','LuStarHalf','LuHexagon','LuCircle','LuSquare',
  'LuTriangle','LuDiamond','LuSparkles','LuWandSparkles','LuMagnet',
  'LuKey','LuLock','LuLockOpen','LuShield','LuShieldCheck',
  'LuPower','LuBattery','LuBatteryFull','LuPlug','LuLightbulb',
]

// ── Konfiguracja ─────────────────────────────────────────────────────────────
export const ICON_SETS: IconSetConfig[] = [
  {
    id: 'emoji',
    name: 'Emoji',
    description: 'Klasyczne emoji — działają na każdym urządzeniu',
    preview: ['📚', '🏃', '💼', '🎯', '⭐'],
    icons: EMOJI_ICONS,
  },
  {
    id: 'lu',
    name: 'Lucide',
    description: 'Czyste, minimalistyczne ikony SVG (ponad 1500 ikon)',
    preview: ['LuActivity', 'LuCalendar', 'LuDumbbell', 'LuStar', 'LuZap'],
    icons: LUCIDE_ICONS,
  },
]

export function getIconSetConfig(id: IconSetId): IconSetConfig {
  return ICON_SETS.find(s => s.id === id) ?? ICON_SETS[0]
}

/**
 * Mapowanie emoji → nazwa ikony Lucide (bez prefiksu).
 * Używane przy globalnym przełączniku zestawu ikon.
 */
const EMOJI_TO_LUCIDE: Record<string, string> = {
  '📚': 'LuBookOpen',
  '💼': 'LuBriefcase',
  '🏃': 'LuPersonStanding',
  '🤝': 'LuHandshake',
  '🚀': 'LuZap',
  '😴': 'LuBed',
  '🎯': 'LuTarget',
  '🎨': 'LuPalette',
  '🔬': 'LuFlaskConical',
  '🍎': 'LuApple',
  '⭐': 'LuStar',
  '🏠': 'LuHouse',
  '🧘': 'LuActivity',
  '🎵': 'LuMusic',
  '🖥️': 'LuMonitor',
  '✈️': 'LuPlane',
  '🍕': 'LuUtensils',
  '🏋️': 'LuDumbbell',
  '📝': 'LuNotebook',
  '💡': 'LuLightbulb',
  '🌿': 'LuLeaf',
  '🐾': 'LuPawPrint',
  '🔥': 'LuFlame',
  '💪': 'LuBicepsFlexed',
  '🎓': 'LuGraduationCap',
  '🏆': 'LuTrophy',
  '💰': 'LuWallet',
  '🛒': 'LuShoppingCart',
  '🚗': 'LuCar',
  '⚽': 'LuTarget',
  '🎮': 'LuGamepad2',
  '📱': 'LuSmartphone',
  '🧠': 'LuBrain',
  '❤️': 'LuHeart',
  '🌍': 'LuGlobe',
  '🌙': 'LuMoon',
  '☀️': 'LuSun',
  '🔑': 'LuKey',
  '🛡️': 'LuShield',
  '⚡': 'LuZap',
  '🎪': 'LuSparkles',
  '🎭': 'LuFilm',
  '🍀': 'LuLeaf',
  '🌸': 'LuFlower',
  '🦋': 'LuSparkles',
  '🐶': 'LuSmile',
  '🐱': 'LuSmile',
  '🎃': 'LuSparkles',
  '🎄': 'LuTreeDeciduous',
  '🎁': 'LuPackage',
  '🎉': 'LuPartyPopper',
  '🔔': 'LuBell',
  '🎂': 'LuCake',
  '📖': 'LuBookOpen',
  '📌': 'LuPin',
  '🗑️': 'LuTrash2',
  '✏️': 'LuPencil',
  '📅': 'LuCalendar',
  '📍': 'LuMapPin',
  '🔍': 'LuSearch',
  '🔁': 'LuRepeat',
  '↩': 'LuUndo2',
  '♾️': 'LuInfinity',
  '✕': 'LuX',
  '⋮': 'LuEllipsisVertical',
  '⚙️': 'LuSettings',
}

/**
 * Jeśli ikona jest emoji i aktywny zestaw to 'lu',
 * zamień na odpowiednik Lucide (z prefiksem "lu:").
 * Jeśli nie ma mapowania — zwróć "lu:LuStar" jako fallback.
 */
export function resolveIconForSet(icon: string, setId: IconSetId): string {
  if (setId !== 'lu') return icon
  // Jeśli już jest Lucide (format "lu:LuXxx") — zostaw
  if (icon.startsWith('lu:')) return icon
  // Ikona emoji — zamień na Lucide
  const lucideName = EMOJI_TO_LUCIDE[icon] ?? 'LuStar'
  return `lu:${lucideName}`
}
