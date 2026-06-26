export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message),
  );
  return bufferToHex(digest);
}

export async function hmacSha256(
  key: string | ArrayBuffer,
  message: string,
): Promise<ArrayBuffer> {
  const keyBytes =
    typeof key === 'string'
      ? new TextEncoder().encode(key)
      : new Uint8Array(key);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}
