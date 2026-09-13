// Server-side half of lib/agent-verification: minting and checking the
// texted 6-digit code. Codes are stored hashed and bound to the user, so a
// leaked agent_phone_codes row can't be replayed on another account.

import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { VERIFY_CODE_LENGTH } from '@/lib/agent-verification'

export function generateVerificationCode(): string {
  return String(randomInt(0, 10 ** VERIFY_CODE_LENGTH)).padStart(VERIFY_CODE_LENGTH, '0')
}

export function hashVerificationCode(code: string, userId: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex')
}

export function verificationCodeMatches(code: string, userId: string, storedHash: string): boolean {
  const cleaned = (code || '').replace(/\D/g, '')
  if (cleaned.length !== VERIFY_CODE_LENGTH || !/^[0-9a-f]{64}$/.test(storedHash)) return false
  return timingSafeEqual(Buffer.from(hashVerificationCode(cleaned, userId), 'hex'), Buffer.from(storedHash, 'hex'))
}
