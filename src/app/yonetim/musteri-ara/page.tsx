import { redirect } from "next/navigation";

/** Müşteri arama, Kullanıcı Yönetimi sayfasındaki arama kutusuna taşındı. */
export default function MusteriAraPage() {
  redirect("/yonetim/kullanicilar");
}
