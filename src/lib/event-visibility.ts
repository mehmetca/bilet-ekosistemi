/** Sitede listelenen / satın alınabilir etkinlikler için ortak görünürlük kuralı. */
export function isEventPubliclyVisible(event: {
  is_active?: boolean | null;
  is_approved?: boolean | null;
  is_draft?: boolean | null;
}): boolean {
  return event.is_active === true && event.is_approved === true && event.is_draft !== true;
}
