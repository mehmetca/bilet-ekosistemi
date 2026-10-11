/** Geçersiz/silinmiş refresh token — beklenen durum; tam ekran hata / konsol widget gürültüsü için filtrelenir. */
export function isBenignSupabaseRefreshTokenMessage(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes("invalid refresh token") ||
    s.includes("refresh token not found") ||
    (s.includes("authapierror") && s.includes("refresh"))
  );
}

/** GoTrue şifre kuralları hatası; sunucu yalnız İngilizce ve karakter listesiyle döndürüyor. */
const PASSWORD_RULES_PATTERN = /should contain at least one character of each/i;

/** Paneli Türk/Alman/İngiliz karışık; üç dil alt alta, İngilizce metin hiç tek başına kalmıyor. */
const PASSWORD_RULES_MESSAGE = [
  "Şifre en az bir küçük harf (a-z), bir büyük harf (A-Z) ve bir rakam (0-9) içermelidir.",
  "Das Passwort muss mindestens einen Kleinbuchstaben (a-z), einen Großbuchstaben (A-Z) und eine Ziffer (0-9) enthalten.",
  "Password must contain at least one lowercase letter (a-z), one uppercase letter (A-Z) and one digit (0-9).",
].join("\n");

/** Supabase'in İngilizce hata metnini kullanıcıya gösterilecek metne çevirir; bilmediklerini aynen bırakır. */
export function formatSupabaseAuthErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return PASSWORD_RULES_PATTERN.test(msg) ? PASSWORD_RULES_MESSAGE : msg;
}
