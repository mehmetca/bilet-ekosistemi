"use client";

import Link from "next/link";

const policyLinks = [
  { href: "/#guvenli-odeme", label: "Güvenli Ödeme" },
  { href: "/#iade-politikasi", label: "İade Politikası" },
  { href: "/#gonderim-politikasi", label: "Gönderim Politikası" },
  { href: "/#canli-stok", label: "Canlı Stok" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-4">
          {policyLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 hover:text-primary-600"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="space-y-4 text-center text-xs text-slate-500 max-w-2xl mx-auto">
          <section id="guvenli-odeme">
            <strong>Güvenli Ödeme:</strong> 3D Secure destekli ödeme altyapısı kullanılmaktadır.
          </section>
          <section id="iade-politikasi">
            <strong>İade Politikası:</strong> İade koşulları etkinlik organizatörü tarafından belirlenir. Etkinlik ve kampanya koşullarına göre iade veya değişiklik uygulanabilir. Satın alma öncesi ilgili etkinlik koşullarını inceleyiniz.
          </section>
          <section id="gonderim-politikasi">
            <strong>Gönderim Politikası:</strong> Standart kargo (DE): 2–4 iş günü. Ekspres kargo (DE): Öğleden önce (Pzt–Cuma) verilen siparişler ertesi iş günü teslim. Dijital bilet: Sözleşme sonrası anında yazdırılabilir. Basılı bilet ücretlidir; gönderim ücreti ödeyenlere teslim edilir. Gönderim seçenekleri alışveriş sepetinde sunulur.
          </section>
          <section id="canli-stok">
            <strong>Canlı Stok:</strong> Stok bilgisi anlık güncellenir.
          </section>
        </div>
        <div className="text-center text-sm text-slate-500 mt-6" suppressHydrationWarning>
          © {new Date().getFullYear()} Bilet Ekosistemi
        </div>
      </div>
    </footer>
  );
}
