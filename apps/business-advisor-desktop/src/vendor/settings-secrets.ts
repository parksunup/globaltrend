import { safeStorage } from 'electron'

const PREFIX = 'electron-safe-storage:v1:'

/** Fail closed if the OS-backed secret store is unavailable or weak. */
export function sealSecretValue(value: string): string {
  if (!value) return ''
  assertSecureStorage()
  return PREFIX + safeStorage.encryptString(value).toString('base64')
}

export function openSecretValue(value: string): string {
  if (!value.startsWith(PREFIX)) return ''
  try {
    assertSecureStorage()
    return safeStorage.decryptString(Buffer.from(value.slice(PREFIX.length), 'base64'))
  } catch {
    return ''
  }
}

export function assertSecureStorage(): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential storage is unavailable.')
  const backend = safeStorage.getSelectedStorageBackend?.()
  if (backend === 'basic_text') throw new Error('Secure OS credential storage is unavailable on this desktop.')
}
