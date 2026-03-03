-- Sanatçılar ve Turneler sayfalarını bağımsız yapmak için:
-- show_on_artist_page: Sanatçılar sayfasında (biyografi, video, sosyal medya) gösterilsin mi?
-- show_on_tour_page: Turneler sayfasında (konser dizisi tanıtımı) gösterilsin mi?
-- NULL veya true = göster, false = gösterme. Mevcut kayıtlar etkilenmez (NULL = her iki sayfada da gösterilir).

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS show_on_artist_page boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_tour_page boolean DEFAULT true;

COMMENT ON COLUMN public.artists.show_on_artist_page IS 'Sanatçılar sayfasında (tanıtım, biyografi, video, sosyal medya) listelensin mi?';
COMMENT ON COLUMN public.artists.show_on_tour_page IS 'Turneler sayfasında (konser dizisi tanıtımı) listelensin mi?';
