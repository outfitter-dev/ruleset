/**
 * Frontend authentication utilities
 */

export type UserId = string & { __brand: 'UserId' }
export type AuthToken = string & { __brand: 'AuthToken' }

export interface AuthResult {
  success: boolean
  userId?: UserId
  token?: AuthToken
  error?: string
}

export async function authenticate(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      return { success: false, error: 'Authentication failed' }
    }

    const data = await response.json()

    return {
      success: true,
      userId: data.userId as UserId,
      token: data.token as AuthToken,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
