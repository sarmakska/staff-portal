export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'general',    label: 'General Notice',   emoji: '📢', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'ooo',        label: 'Out of Office',    emoji: '🏖️', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'event',      label: 'Event / Meeting',  emoji: '📅', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'closure',    label: 'Office Closure',   emoji: '🏢', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  { value: 'celebrate',  label: 'Celebration',      emoji: '🎉', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  { value: 'newjoiner',  label: 'New Joiner',       emoji: '👋', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'policy',     label: 'Policy Update',    emoji: '📋', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { value: 'urgent',     label: 'Urgent Notice',    emoji: '⚠️', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { value: 'meeting',    label: 'Going to Meeting', emoji: '🤝', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { value: 'it',         label: 'IT / Systems',     emoji: '🔧', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
] as const

export type AnnouncementCategory = typeof ANNOUNCEMENT_CATEGORIES[number]['value']
