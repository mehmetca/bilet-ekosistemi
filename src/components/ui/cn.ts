/** clsx/tailwind-merge bağımlılığı olmadan sınıf birleştirme; falsy değerleri eler. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
