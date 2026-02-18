import { api } from './client'

export interface UserSettings {
  scroll_mode: string
  view_mode: string
  first_day_of_week: number
  hour_start: number
  hour_end: number
}

export const settingsApi = {
  get: async (): Promise<UserSettings> => {
    const res = await api.get<UserSettings>('/settings')
    return res.data
  },

  put: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    const res = await api.put<UserSettings>('/settings', settings)
    return res.data
  },
}
