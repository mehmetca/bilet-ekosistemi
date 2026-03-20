/** Geçersiz/silinmiş refresh token — beklenen durum; tam ekran hata / konsol widget gürültüsü için filtrelenir. */
export function isBenignSupabaseRefreshTokenMessage(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes("invalid refresh token") ||
    s.includes("refresh token not found") ||
    (s.includes("authapierror") && s.includes("refresh"))
  );
}
