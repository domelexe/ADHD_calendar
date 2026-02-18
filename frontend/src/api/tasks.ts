import { api } from './client'
import { EisenhowerTask } from '../types'

export const tasksApi = {
  list: async (): Promise<EisenhowerTask[]> => {
    const res = await api.get<EisenhowerTask[]>('/eisenhower-tasks')
    return res.data
  },

  create: async (data: Partial<EisenhowerTask>): Promise<EisenhowerTask> => {
    const res = await api.post<EisenhowerTask>('/eisenhower-tasks', data)
    return res.data
  },

  patch: async (id: number, data: Partial<EisenhowerTask>): Promise<EisenhowerTask> => {
    const res = await api.patch<EisenhowerTask>(`/eisenhower-tasks/${id}`, data)
    return res.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/eisenhower-tasks/${id}`)
  },
}
