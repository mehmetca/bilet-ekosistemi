/**
 * Standart input validation helper fonksiyonları
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function validatePhoneNumber(phone: string): boolean {
  // Basit telefon numarası validasyonu
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.length >= 10 && phoneRegex.test(phone);
}

export function sanitizeString(input: string, maxLength: number = 255): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

export function validatePagination(page: string, perPage: string): { page: number; perPage: number } {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10) || 10));
  return { page: pageNum, perPage: perPageNum };
}

export function validateDateRange(startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return true;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  return start <= end;
}