import Link from "next/link";
import { Ticket, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo ve Açıklama */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <Ticket className="h-4 w-4" />
              </div>
              <span className="font-bold text-xl">Bilet Ekosistemi</span>
            </div>
            <p className="text-slate-400 mb-4">
              Etkinlik biletleri ve daha fazlası için en güvenilir platform.
            </p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="h-4 w-4" />
                <span>info@bilet-ekosistemi.com</span>
              </div>
            </div>
          </div>

          {/* Hızlı Linkler */}
          <div>
            <h3 className="font-semibold mb-4">Hızlı Linkler</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                  Etkinlikler
                </Link>
              </li>
              <li>
                <Link href="/takvim" className="text-slate-400 hover:text-white transition-colors">
                  Takvim
                </Link>
              </li>
              <li>
                <Link href="/giris" className="text-slate-400 hover:text-white transition-colors">
                  Giriş Yap
                </Link>
              </li>
            </ul>
          </div>

          {/* İletişim */}
          <div>
            <h3 className="font-semibold mb-4">İletişim</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-slate-400">
                <Phone className="h-4 w-4" />
                <span>+90 212 555 0123</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-4 w-4" />
                <span>İstanbul, Türkiye</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
          <p>&copy; 2024 Bilet Ekosistemi. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </footer>
  );
}
