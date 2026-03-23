# Salon planı görselleri

Bu klasöre salon planını **SVG** (tercih) veya fotoğraf/PDF’den export **PNG/JPEG** olarak koyun.

## Theater Duisburg (veya benzeri plan)

- Varsayılan dosya: **`theaterduisburg.svg`** (`theaterduisburg.ts` → `imageUrl`).
- İsteğe bağlı: `npm run seatplan:tag-duisburg` → `theaterduisburg.tagged.svg` (path’lere `id`); kullanmak için `imageUrl`’i bu dosyaya çevirin.
- Etkinlikte oturum planı adı "Theater Duisburg" (veya "theater duisburg") içeriyorsa, bu grafik üzerinde tıklanabilir koltuklar gösterilir (SVG’deki path’lerin `id`’si yok; tıklama, veritabanı koltuklarıyla eşleşen üstteki yuvarlak düğmelerle yapılır).

Dosya yoksa sayfa yine çalışır; liste görünümü veya genel salon planı kullanılır.

### Hizayı kontrol (kalibrasyon)

Etkinlik sayfasında “Yer seçerek bilet al” ile planı açın, URL’ye **`?seatDebug=1`** ekleyin (örn. `.../etkinlik/xxx?seatDebug=1`). Kırmızı dikdörtgenler `theaterduisburg.ts` içindeki `sections` bölgeleridir; kayıksa o dosyada `x`, `y`, `width`, `height` değerlerini düzenleyin.

### Duisburg SVG koltuk hizası ve plaka metinleri

1. `npm run seatplan:build-duisburg-coords` — `theaterduisburg-svg-coords.generated.ts` üretir.  
2. Koltuk üzerindeki metinler: `theaterduisburg-seat-display-labels.json` (şema sırası, `seat-001` …). Güncelleyince `npm run seatplan:duisburg-section-labels`.  
3. İkisini ardışık: `npm run seatplan:refresh-duisburg-visual`.
