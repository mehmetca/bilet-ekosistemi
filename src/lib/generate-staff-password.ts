/**
 * Admin'in kontrolör hesapları için ürettiği tek kullanımlık giriş şifresi.
 * Alfabe karışabilecek harflerden arındırılmıştır (0/O, 1/l/I yok): kapıda
 * telefonda elle yazılması gerekebilir.
 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const ALL = UPPER + LOWER + DIGIT;

function pick(source: string): string {
  const limit = Math.floor(256 / source.length) * source.length;
  const bytes = new Uint8Array(1);
  do {
    globalThis.crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);
  return source.charAt(bytes[0] % source.length);
}

export function generateStaffPassword(length = 14): string {
  const size = Math.min(32, Math.max(12, Math.floor(length)));
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT)];
  while (chars.length < size) chars.push(pick(ALL));

  for (let i = chars.length - 1; i > 0; i--) {
    const roll = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
    const j = Math.floor(roll * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
