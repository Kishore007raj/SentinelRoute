/**
 * encryption.ts — AES-256-GCM encryption for sensitive data fields.
 *
 * Encrypts sensitive shipment data (notes, contactDetails, specialInstructions)
 * before storing in MongoDB. Uses AES-256-GCM with random IV per encryption.
 *
 * Required env var:
 *   DATA_ENCRYPTION_KEY — 32-byte base64-encoded key
 *
 * Payload format:
 *   {
 *     "iv": "base64-encoded-12-bytes",
 *     "encryptedData": "base64-encoded-ciphertext", 
 *     "authTag": "base64-encoded-16-bytes"
 *   }
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Environment validation ───────────────────────────────────────────────────

const encryptionKey = process.env.DATA_ENCRYPTION_KEY;

if (!encryptionKey) {
  console.warn(
    "[encryption] DATA_ENCRYPTION_KEY not set.\n" +
    "Sensitive data encryption is disabled. Set a 32-byte base64 key in .env.local"
  );
}

function getEncryptionKey(): Buffer {
  if (!encryptionKey) {
    throw new Error("DATA_ENCRYPTION_KEY not configured");
  }
  
  const key = Buffer.from(encryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be exactly 32 bytes when base64 decoded");
  }
  
  return key;
}

// ─── Encryption interface ─────────────────────────────────────────────────────

export interface EncryptedPayload {
  iv: string;
  encryptedData: string;
  authTag: string;
}

/**
 * Encrypts sensitive data using AES-256-GCM.
 * 
 * @param data - Plain text data to encrypt
 * @returns Encrypted payload with IV, ciphertext, and auth tag
 * @throws Error if encryption key is not configured or encryption fails
 */
export function encryptSensitiveData(data: string): EncryptedPayload {
  if (!data) {
    throw new Error("Cannot encrypt empty data");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString("base64"),
    encryptedData: encrypted,
    authTag: authTag.toString("base64")
  };
}

/**
 * Decrypts data encrypted with encryptSensitiveData.
 * 
 * @param payload - Encrypted payload from encryptSensitiveData
 * @returns Original plain text data
 * @throws Error if decryption key is not configured or decryption fails
 */
export function decryptSensitiveData(payload: EncryptedPayload): string {
  if (!payload.iv || !payload.encryptedData || !payload.authTag) {
    throw new Error("Invalid encrypted payload: missing required fields");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(payload.encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Encrypts an object's sensitive fields in place.
 * Only encrypts non-empty string values for the specified fields.
 * 
 * @param obj - Object containing sensitive fields
 * @param fields - Array of field names to encrypt
 * @returns Object with encrypted sensitive fields
 */
export function encryptObjectFields<T extends Record<string, unknown>>(
  obj: T, 
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === "string" && value.trim()) {
      result[field] = encryptSensitiveData(value) as T[keyof T];
    }
  }
  
  return result;
}

/**
 * Decrypts an object's encrypted fields in place.
 * Only decrypts fields that appear to be encrypted payloads.
 * 
 * @param obj - Object containing encrypted fields
 * @param fields - Array of field names to decrypt
 * @returns Object with decrypted sensitive fields
 */
export function decryptObjectFields<T extends Record<string, unknown>>(
  obj: T, 
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fields) {
    const value = obj[field];
    
    // Check if value looks like an encrypted payload
    if (
      value && 
      typeof value === "object" && 
      "iv" in value && 
      "encryptedData" in value && 
      "authTag" in value
    ) {
      try {
        result[field] = decryptSensitiveData(value as EncryptedPayload) as T[keyof T];
      } catch (err) {
        console.error(`[encryption] Failed to decrypt field ${String(field)}:`, err);
        // Leave field as-is if decryption fails
      }
    }
  }
  
  return result;
}