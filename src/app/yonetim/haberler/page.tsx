import AdminOnlyGuard from "@/components/AdminOnlyGuard";

export default function HaberlerPage() {
  return (
    <AdminOnlyGuard>
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Haber yönetimi kapatıldı</h1>
        <p className="mt-3 text-slate-600">
          Bu sitede artık haber yayınlanmadığı için haber oluşturma, düzenleme ve silme işlemleri devre dışı bırakıldı.
        </p>
      </div>
    </AdminOnlyGuard>
  );
}
