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

export async function register(email: string, password: string, inviteToken: string): Promise<void> {
  await api.post('/auth/register', { email, password, invite_token: inviteToken })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function getMe(): Promise<{ id: number; email: string; is_admin: boolean }> {
  const res = await api.get('/auth/me')
  return res.data
}

// Admin API
export interface AdminUser {
  id: number
  email: string
  is_admin: boolean
  created_at: string
}

export interface InviteToken {
  token: string
  used: boolean
  created_at: string
  used_at: string | null
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const res = await api.get('/admin/users')
  return res.data
}

export async function adminUpdateUser(
  userId: number,
  payload: { email?: string; is_admin?: boolean; new_password?: string }
): Promise<AdminUser> {
  const res = await api.patch(`/admin/users/${userId}`, payload)
  return res.data
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await api.delete(`/admin/users/${userId}`)
}

export async function adminListInviteTokens(): Promise<InviteToken[]> {
  const res = await api.get('/admin/invite-tokens')
  return res.data
}

export async function adminCreateInviteTokens(count: number): Promise<InviteToken[]> {
  const res = await api.post('/admin/invite-tokens', { count })
  return res.data
}

export async function adminDeleteInviteToken(token: string): Promise<void> {
  await api.delete(`/admin/invite-tokens/${token}`)
}
