"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, UserCheck, CheckCircle, XCircle, Calendar, Eye, X } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";

type OrganizerRequest = {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
  organization_display_name?: string | null;
  company_name?: string | null;
  legal_form?: string | null;
  address?: string | null;
  phone?: string | null;
  trade_register?: string | null;
  trade_register_number?: string | null;
  vat_id?: string | null;
  representative_name?: string | null;
};

type DisplayUser = {
  user_id: string;
  email: string | null;
  created_at?: string;
  roles: string[];
};

export default function KullanicilarPage() {
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [organizerRequests, setOrganizerRequests] = useState<OrganizerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<OrganizerRequest | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "controller">("controller");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Veriler yüklenemedi");
      }
      const data = (await res.json()) as { users?: DisplayUser[]; organizerRequests?: OrganizerRequest[] };
      setUsers(data.users || []);
      setOrganizerRequests((data.organizerRequests as OrganizerRequest[]) || []);
    } catch (error) {
      console.error("Fetch error:", error);
      alert(`Kullanıcılar listelenemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  }


  async function handleAddUser() {
    if (!newUserEmail) {
      alert("E-posta adresi giriniz!");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", email: newUserEmail, role: newUserRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Kullanıcı eklenemedi");
        return;
      }
      alert("Kullanıcı başarıyla oluşturuldu!");
      setNewUserEmail("");
      setNewUserRole("controller");
      setShowAddForm(false);
      fetchData();
    } catch (error) {
      console.error("Add user error:", error);
      alert("İşlem başarısız oldu: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  async function handleApproveOrganizer(req: OrganizerRequest) {
    if (!confirm(`${req.email} adresli kullanıcıyı organizatör olarak onaylamak istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", requestId: req.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Onaylama başarısız");
        return;
      }
      alert("Organizatör onaylandı!");
      fetchData();
    } catch (error) {
      alert("Hata: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  async function handleRejectOrganizer(req: OrganizerRequest) {
    if (!confirm(`${req.email} adresli başvuruyu reddetmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", requestId: req.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Reddetme başarısız");
        return;
      }
      alert("Başvuru reddedildi.");
      fetchData();
    } catch (error) {
      alert("Hata: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  async function handleDeleteUser(user: DisplayUser) {
    const label = user.email || user.user_id;
    if (
      !confirm(
        `${label} kullanıcısını kalıcı olarak silmek istediğinize emin misiniz?\n\nKullanıcı tekrar üye olarak kayıt olabilir. Bu işlem geri alınamaz.`
      )
    )
      return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId: user.user_id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Kullanıcı silinemedi");
        return;
      }
      alert("Kullanıcı silindi. Tekrar üye olarak kayıt olabilir.");
      fetchData();
    } catch (error) {
      console.error("Delete user error:", error);
      alert("Bir hata oluştu.");
    }
  }

  async function removeRole(userId?: string, role?: string) {
    if (!userId || !role) {
      alert("Kullanıcı bilgisi eksik.");
      return;
    }
    const roleLabel = role === "admin" ? "yönetici" : role === "organizer" ? "organizatör" : "kontrolör";
    if (!confirm(`Bu kullanıcının ${roleLabel} rolünü kaldırmak istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeRole", userId, role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Rol kaldırılamadı");
        return;
      }
      alert("Kullanıcı rolü başarıyla kaldırıldı.");
      fetchData();
    } catch (error) {
      console.error("Remove role error:", error);
      alert("Bir hata oluştu.");
    }
  }

  // Sadece admin erişebilir - kontrolü devre dışı bırak
  // if (!isAdmin) {
  //   return (
  //     <div className="p-8">
  //       <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
  //         <Users className="h-12 w-12 text-red-600 mx-auto mb-4" />
  //         <h2 className="text-lg font-semibold text-red-800 mb-2">
  //           Erişim Reddedildi
  //         </h2>
  //         <p className="text-red-600">
  //           Bu sayfaya sadece yöneticiler erişebilir.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Kullanıcı Yönetimi
          </h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Rol Ekle
          </button>
        </div>

        {/* Rol Ekle Formu */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Yeni Kullanıcı Rolü
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="kullanici@ornek.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rol
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as "admin" | "controller")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="controller">Kontrolör</option>
                  <option value="admin">Yönetici</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddUser}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700"
              >
                Kullanıcı Ekle
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Bekleyen Organizatör Başvuruları */}
        {organizerRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bekleyen Organizasyon Başvuruları ({organizerRequests.length})
            </h3>
            <div className="space-y-3">
              {organizerRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-4 p-4 bg-white rounded-lg border border-amber-100"
                >
                  <div>
                    <p className="font-medium text-slate-900">{req.email}</p>
                    {req.organization_display_name && (
                      <p className="text-sm text-primary-600">Organizasyon: {req.organization_display_name}</p>
                    )}
                    <p className="text-sm text-slate-500">
                      Başvuru: {new Date(req.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingRequest(req)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
                    >
                      <Eye className="h-4 w-4" />
                      Görüntüle
                    </button>
                    <button
                      onClick={() => handleApproveOrganizer(req)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Onayla
                    </button>
                    <button
                      onClick={() => handleRejectOrganizer(req)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200"
                    >
                      <XCircle className="h-4 w-4" />
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Başvuru Formu Görüntüleme Modal */}
        {viewingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setViewingRequest(null)}>
            <div
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Organizasyon Başvuru Formu</h3>
                <button
                  onClick={() => setViewingRequest(null)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">E-posta</span>
                  <span className="text-slate-900">{viewingRequest.email}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Firma / İşletme Adı</span>
                  <span className="text-slate-900">{viewingRequest.company_name || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Hukuki Şekil</span>
                  <span className="text-slate-900">{viewingRequest.legal_form || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Adres</span>
                  <span className="text-slate-900">{viewingRequest.address || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Telefon</span>
                  <span className="text-slate-900">{viewingRequest.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Yetkili Temsilci</span>
                  <span className="text-slate-900">{viewingRequest.representative_name || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Organizasyonlarda Görünecek İsim</span>
                  <span className="text-slate-900">{viewingRequest.organization_display_name || "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">Ticaret Sicili</span>
                    <span className="text-slate-900">{viewingRequest.trade_register || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">Registernummer</span>
                    <span className="text-slate-900">{viewingRequest.trade_register_number || "—"}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">USt-IdNr. / WiIdNr.</span>
                  <span className="text-slate-900">{viewingRequest.vat_id || "—"}</span>
                </div>
                <p className="text-xs text-slate-500 pt-2">
                  Başvuru: {new Date(viewingRequest.created_at).toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => setViewingRequest(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Kapat
                </button>
                <button
                  onClick={() => {
                    handleApproveOrganizer(viewingRequest);
                    setViewingRequest(null);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Onayla
                </button>
                <button
                  onClick={() => {
                    handleRejectOrganizer(viewingRequest);
                    setViewingRequest(null);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  <XCircle className="h-4 w-4" />
                  Reddet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tüm Üyeler (Organizatör, Bilet Alıcı, Yönetici, Kontrolör) */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">E-posta</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Rol</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Kayıt Tarihi</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-b border-slate-100">
                    <td className="p-4 text-sm text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium">{user.email || "(e-posta yok)"}</div>
                          <div className="text-xs text-slate-500">
                            ID: {user.user_id ? String(user.user_id).slice(-8) : "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                role === "admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : role === "organizer"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {role === "admin"
                                ? "Yönetici"
                                : role === "organizer"
                                ? "Organizatör"
                                : "Kontrolör"}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            Bilet Alıcı
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString("tr-TR")
                        : "Bilinmiyor"}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex items-center gap-2">
                        {user.roles.map((role) => (
                          <button
                            key={role}
                            onClick={() => removeRole(user.user_id, role)}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                            title={`${role} rolünü kaldır`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ))}
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 px-2 text-red-600 hover:bg-red-50 rounded text-xs font-medium border border-red-200"
                          title="Kullanıcıyı sil (tekrar üye olabilir)"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
