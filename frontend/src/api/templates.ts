import { api } from './client'
import { ActivityTemplate } from '../types'

export const templatesApi = {
  list: async (): Promise<ActivityTemplate[]> => {
    const res = await api.get<ActivityTemplate[]>('/activity-templates')
    return res.data
  },

  create: async (data: Partial<ActivityTemplate>): Promise<ActivityTemplate> => {
    const res = await api.post<ActivityTemplate>('/activity-templates', data)
    return res.data
  },

  update: async (id: number, data: Partial<ActivityTemplate>): Promise<ActivityTemplate> => {
    const res = await api.put<ActivityTemplate>(`/activity-templates/${id}`, data)
    return res.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/activity-templates/${id}`)
  },
}
