import { redirect } from "next/navigation";

/** Eski /yonetim/siparisler → bilet-listesi (çift sipariş sayfası kaldırıldı). */
export default function SiparislerRedirectPage() {
  redirect("/yonetim/bilet-listesi");
}
