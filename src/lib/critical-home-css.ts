/** İlk boyama (LCP hero) için — tam Tailwind yüklenmeden önce uygulanır. */
export const CRITICAL_HOME_CSS = `
body{margin:0;background-color:#FAF8F4;color:#181818}
.hero-lcp-fold{position:relative;min-height:min(100dvh,820px);background:#0E0E0D;color:#fff}
.hero-lcp-img{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover}
header img[alt="Kurdevent Logo"]{display:block;width:128px;height:auto}
@media (min-width:640px){header img[alt="Kurdevent Logo"]{width:160px}}
`.trim();
