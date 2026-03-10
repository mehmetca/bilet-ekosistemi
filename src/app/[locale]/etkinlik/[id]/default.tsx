// Next.js: Parallel route slot için fallback (yoksa "No default component" → NotFound).
// Bu segmentte @slot yok ama children slot'u için default gerekebilir; null = slot boş kalsın.
// Bkz: https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#defaultjs
export default function Default() {
  return null;
}
