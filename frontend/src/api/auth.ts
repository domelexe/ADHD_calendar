import { api } from './client'
import { Token } from '../types'

export async function login(email: string, password: string): Promise<Token> {
  const form = new FormData()
  form.append('username', email)
  form.append('password', password)
  const res = await api.post<Token>('/auth/token', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
