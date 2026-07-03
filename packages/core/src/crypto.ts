import { Logger } from "./logger"

export class Crypto {
  private static log = new Logger("crypto")

  static async generateKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    )
    const exported = await crypto.subtle.exportKey("raw", key)
    return btoa(String.fromCharCode(...new Uint8Array(exported)))
  }

  static async encrypt(plaintext: string, keyB64: string): Promise<string> {
    try {
      const keyBuffer = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
      const key = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
      )
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encoded = new TextEncoder().encode(plaintext)
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded,
      )
      const combined = new Uint8Array([...iv, ...new Uint8Array(ciphertext)])
      return btoa(String.fromCharCode(...combined))
    } catch (e) {
      Crypto.log.error("Encryption failed", { err: String(e) })
      throw e
    }
  }

  static async decrypt(ciphertextB64: string, keyB64: string): Promise<string> {
    try {
      const keyBuffer = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
      const key = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      )
      const combined = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0))
      const iv = combined.slice(0, 12)
      const ciphertext = combined.slice(12)
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      )
      return new TextDecoder().decode(decrypted)
    } catch (e) {
      Crypto.log.error("Decryption failed", { err: String(e) })
      throw e
    }
  }

  static getDeviceKey(): string {
    const home = process.env.HOME || process.env.USERPROFILE || "default"
    const hostname = process.env.HOSTNAME || "local"
    const raw = `jaicode-device-key:${home}:${hostname}`
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i)
      hash = ((hash << 5) - hash + char) | 0
    }
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = (hash >> (i % 4) * 8) & 0xff
    }
    return btoa(String.fromCharCode(...bytes))
  }
}
