"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";
import MDEditor from '@uiw/react-md-editor';

export default function ArtistEditorPage() {
  const { isAdmin } = useSimpleAuth();
  const router = useRouter();

  const [artist, setArtist] = useState({
    id: null as string | null,
    name: "",
    slug: "",
    bio: "",
    tour_name: "",
    tour_start_date: new Date().toISOString().slice(0,16),
    tour_end_date: new Date().toISOString().slice(0,16),
    price_from: "",
    image_url: ""
  });

  const [events, setEvents] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<Array<{id:string,name:string}>>([]);

  function addEventRow() {
    setEvents(prev => [...prev, { id: null, city: "", venue: "", event_date: new Date().toISOString().slice(0,16), price: "", ticket_url: "" }]);
  }

  function updateEvent(idx: number, key: string, value: any) {
    setEvents(prev => prev.map((e,i) => i===idx ? { ...e, [key]: value } : e));
  }

  function removeEvent(idx: number) {
    const ev = events[idx];
    if (ev && ev.id) {
      if (!confirm('Bu etkinliği veritabanından silmek istiyor musunuz?')) return;
      supabase.from('tour_events').delete().eq('id', ev.id).then(({ error }) => {
        if (error) {
          console.error('delete event error', error);
          alert('Etkinlik silinemedi. Konsolu kontrol edin.');
        } else {
          setEvents(prev => prev.filter((_,i) => i!==idx));
        }
      });
    } else {
      setEvents(prev => prev.filter((_,i) => i!==idx));
    }
  }

  async function fetchArtists() {
    const { data, error } = await supabase.from('artists').select('id,name').order('name');
    if (error) {
      console.error('fetch artists error', error);
      return;
    }
    setArtists(data || []);
  }

  async function loadArtist(artistId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('artists').select('*,tour_events(*)').eq('id', artistId).single();
      if (error) throw error;
      const a = data;
      setArtist({
        id: a.id,
        name: a.name || '',
        slug: a.slug || '',
        bio: a.bio || '',
        tour_name: a.tour_name || '',
        tour_start_date: a.tour_start_date ? new Date(a.tour_start_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16),
        tour_end_date: a.tour_end_date ? new Date(a.tour_end_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16),
        price_from: a.price_from != null ? String(a.price_from) : '',
        image_url: a.image_url || ''
      });

      const evs = (a.tour_events || []).map((ev:any) => ({
        id: ev.id,
        city: ev.city || '',
        venue: ev.venue || '',
        event_date: ev.event_date ? new Date(ev.event_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16),
        price: ev.price != null ? String(ev.price) : '',
        ticket_url: ev.ticket_url || ''
      }));
      setEvents(evs);
    } catch (err:any) {
      console.error('load artist error', err);
      alert('Sanatçı yüklenemedi. Konsolu kontrol edin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchArtists();
    }
  }, [isAdmin]);

  if (!isAdmin) return <div className="p-8">Yetkisiz. Admin girişi gerekli.</div>;

  async function handleSave() {
    setLoading(true);
    try {
      // upsert artist
      const payload: any = {
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio,
        tour_name: artist.tour_name,
        tour_start_date: artist.tour_start_date ? new Date(artist.tour_start_date).toISOString() : null,
        tour_end_date: artist.tour_end_date ? new Date(artist.tour_end_date).toISOString() : null,
        price_from: artist.price_from ? parseFloat(artist.price_from) : null,
        image_url: artist.image_url || null
      };

      let artistId = artist.id;

      if (artistId) {
        const { error } = await supabase.from('artists').update(payload).eq('id', artistId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('artists').insert(payload).select().single();
        if (error) throw error;
        artistId = data.id;
        setArtist(prev => ({ ...prev, id: artistId }));
      }

      // handle events: simplistic approach - delete events with null id? We'll upsert by id
      for (const ev of events) {
        const evPayload = {
          city: ev.city,
          venue: ev.venue,
          event_date: ev.event_date ? new Date(ev.event_date).toISOString() : null,
          price: ev.price ? parseFloat(ev.price) : null,
          ticket_url: ev.ticket_url || null,
          artist_id: artistId
        };
        if (ev.id) {
          const { error } = await supabase.from('tour_events').update(evPayload).eq('id', ev.id);
          if (error) console.error('update event error', error);
        } else {
          const { data, error } = await supabase.from('tour_events').insert(evPayload).select().single();
          if (error) console.error('insert event error', error);
          else {
            ev.id = data.id; // assign returned id
          }
        }
      }

      alert('Sanatçı ve etkinlikler kaydedildi.');
      router.push('/yonetim/turneler');
    } catch (err:any) {
      console.error('save error', err);
      alert('Kaydederken hata: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Sanatçı Düzenleyici</h1>

        <div className="flex items-center gap-3 mb-4">
          <select className="rounded-lg border px-3 py-2" value={artist.id || 'new'} onChange={e=>{
            const val = e.target.value;
            if (val === 'new') {
              setArtist({ id: null, name: '', slug: '', bio: '', tour_name: '', tour_start_date: new Date().toISOString().slice(0,16), tour_end_date: new Date().toISOString().slice(0,16), price_from: '', image_url: '' });
              setEvents([]);
            } else {
              loadArtist(val);
            }
          }}>
            <option value="new">Yeni Sanatçı oluştur</option>
            {artists.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={()=>{ setArtist({ id: null, name: '', slug: '', bio: '', tour_name: '', tour_start_date: new Date().toISOString().slice(0,16), tour_end_date: new Date().toISOString().slice(0,16), price_from: '', image_url: '' }); setEvents([]); }} className="bg-slate-100 px-3 py-2 rounded">Yeni</button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <input type="text" placeholder="Sanatçı Adı" value={artist.name} onChange={e=>setArtist({...artist, name:e.target.value})} className="rounded-lg border px-3 py-2" />
            <input type="text" placeholder="Slug" value={artist.slug} onChange={e=>setArtist({...artist, slug:e.target.value})} className="rounded-lg border px-3 py-2" />
            <input type="text" placeholder="Turne Adı" value={artist.tour_name} onChange={e=>setArtist({...artist, tour_name:e.target.value})} className="rounded-lg border px-3 py-2" />
            <input type="number" placeholder="Başlangıç Fiyatı" value={artist.price_from} onChange={e=>setArtist({...artist, price_from:e.target.value})} className="rounded-lg border px-3 py-2" />
            <input type="datetime-local" value={artist.tour_start_date} onChange={e=>setArtist({...artist, tour_start_date:e.target.value})} className="rounded-lg border px-3 py-2" />
            <input type="datetime-local" value={artist.tour_end_date} onChange={e=>setArtist({...artist, tour_end_date:e.target.value})} className="rounded-lg border px-3 py-2" />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Biyografi</label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <MDEditor
                value={artist.bio}
                onChange={(val) => setArtist({...artist, bio: val || ""})}
                height={200}
                preview="edit"
                hideToolbar={false}
                visibleDragbar={false}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Markdown formatında yazabilirsiniz. **kalın**, *italik*, [link](url), #başlık vb.
            </p>
          </div>

          <div className="mt-4">
            <AdminImageUploadFixed value={artist.image_url} onChange={(url:string)=>setArtist({...artist, image_url:url})} folder="artist-images" />
          </div>

        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Turne Etkinlikleri</h2>
            <button onClick={addEventRow} className="bg-primary-600 text-white px-3 py-1 rounded">Yeni Etkinlik Ekle</button>
          </div>

          <div className="space-y-4">
            {events.map((ev, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-6 items-center">
                <input value={ev.city} onChange={e=>updateEvent(idx,'city',e.target.value)} placeholder="Şehir" className="rounded-lg border px-3 py-2 md:col-span-1" />
                <input value={ev.venue} onChange={e=>updateEvent(idx,'venue',e.target.value)} placeholder="Mekan" className="rounded-lg border px-3 py-2 md:col-span-2" />
                <input value={ev.event_date} onChange={e=>updateEvent(idx,'event_date',e.target.value)} type="datetime-local" className="rounded-lg border px-3 py-2 md:col-span-2" />
                <input value={ev.price} onChange={e=>updateEvent(idx,'price',e.target.value)} placeholder="Fiyat" className="rounded-lg border px-3 py-2 md:col-span-1" />
                <input value={ev.ticket_url} onChange={e=>updateEvent(idx,'ticket_url',e.target.value)} placeholder="Bilet URL" className="rounded-lg border px-3 py-2 md:col-span-6" />
                <div className="md:col-span-6 text-right">
                  <button onClick={()=>removeEvent(idx)} className="text-sm text-red-600">Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={loading} className="bg-primary-600 text-white px-4 py-2 rounded">Kaydet</button>
          <button onClick={()=>router.push('/yonetim/turneler')} className="bg-slate-200 px-4 py-2 rounded">İptal</button>
        </div>
      </div>
    </div>
  );
}
