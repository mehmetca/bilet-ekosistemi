/** İlk boyama (LCP hero) için — tam Tailwind yüklenmeden önce uygulanır. */
export const CRITICAL_HOME_CSS = `
body{margin:0;background-color:#FAFAF9;color:#181818}
.hero-lcp-fold{position:relative;min-height:min(68dvh,820px);background:#0E0E0D;color:#fff}
@media (min-width:768px){.hero-lcp-fold{min-height:100vh}}
.hero-lcp-img{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover}
header img[alt="Kurdevent Logo"]{display:block;width:128px;height:auto}
@media (min-width:640px){header img[alt="Kurdevent Logo"]{width:160px}}
`.trim();
