"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, UserCheck, CheckCircle, XCircle, Calendar, Eye, X } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

function authHeaders(accessToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

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
  full_name?: string;
  phone?: string;
};
type ControlEvent = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
};
type ControllerAssignment = {
  controller_user_id: string;
  event_id: string;
};
type ControllerRequest = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function KullanicilarContent() {
  const { accessToken, loading: authLoading } = useSimpleAuth();
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [controllerAssignments, setControllerAssignments] = useState<ControllerAssignment[]>([]);
  const [controllerAssignmentTableReady, setControllerAssignmentTableReady] = useState(true);
  const [organizerRequests, setOrganizerRequests] = useState<OrganizerRequest[]>([]);
  const [controllerRequests, setControllerRequests] = useState<ControllerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<OrganizerRequest | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin">("admin");
  const [showControllerForm, setShowControllerForm] = useState(false);
  const [creatingController, setCreatingController] = useState(false);
  const [controllerForm, setControllerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [controllerEventIds, setControllerEventIds] = useState<string[]>([]);
  const [editingControllerId, setEditingControllerId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/users", {
        headers: authHeaders(accessToken),
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Veriler yüklenemedi");
      }
      const data = (await res.json()) as {
        users?: DisplayUser[];
        events?: ControlEvent[];
        controllerAssignments?: ControllerAssignment[];
        controllerAssignmentTableReady?: boolean;
        organizerRequests?: OrganizerRequest[];
        controllerRequests?: ControllerRequest[];
      };
      setUsers(data.users || []);
      setEvents(data.events || []);
      setControllerAssignments(data.controllerAssignments || []);
      setControllerAssignmentTableReady(data.controllerAssignmentTableReady !== false);
      setOrganizerRequests((data.organizerRequests as OrganizerRequest[]) || []);
      setControllerRequests((data.controllerRequests as ControllerRequest[]) || []);
    } catch (error) {
      console.error("Fetch error:", error);
      alert(`Kullanıcılar listelenemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const controllerUsers = users.filter((user) => user.roles.includes("controller"));
  const controllerCountForEvent = (eventId: string) =>
    new Set(
      controllerAssignments
        .filter((assignment) => assignment.event_id === eventId)
        .map((assignment) => assignment.controller_user_id)
    ).size;

  async function handleCreateController(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken || creatingController) return;
    setCreatingController(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({
          action: "createController",
          ...controllerForm,
          eventIds: controllerEventIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mailSent?: boolean;
        mailReason?: string;
        passwordGenerated?: boolean;
      };
      if (!res.ok) {
        alert(data.error || "Kontrolör oluşturulamadı.");
        return;
      }
      setControllerForm({ firstName: "", lastName: "", email: "", phone: "", password: "" });
      setControllerEventIds([]);
      setShowControllerForm(false);
      await fetchData();
      alert(
        data.mailSent
          ? "Kontrolör hesabı oluşturuldu. Giriş bilgileri ve kullanım anlatımı kişinin e-postasına gönderildi."
          : `Giriş maili gönderilemedi${data.mailReason ? ` (${data.mailReason})` : ""}. ${
              data.passwordGenerated
                ? "Hesap oluşturulamadı, tekrar deneyin."
                : "Şifreyi kişiyle ayrıca paylaş."
            }`
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Kontrolör oluşturulamadı.");
    } finally {
      setCreatingController(false);
    }
  }

  function beginControllerAssignment(user: DisplayUser) {
    setEditingControllerId(user.user_id);
    setAssignmentDraft(
      controllerAssignments
        .filter((assignment) => assignment.controller_user_id === user.user_id)
        .map((assignment) => assignment.event_id)
    );
  }

  async function handleSaveControllerEvents(userId: string) {
    if (!accessToken || savingAssignment) return;
    setSavingAssignment(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({
          action: "assignControllerEvents",
          userId,
          eventIds: assignmentDraft,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Etkinlik atamaları kaydedilemedi.");
        return;
      }
      await fetchData();
      setEditingControllerId(null);
      setAssignmentDraft([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Etkinlik atamaları kaydedilemedi.");
    } finally {
      setSavingAssignment(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchData();
  }, [authLoading, accessToken, fetchData]);


  async function handleAddUser() {
    if (!newUserEmail) {
      alert("E-posta adresi giriniz!");
      return;
    }
    try {
      if (!accessToken) {
        alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ action: "add", email: newUserEmail, role: newUserRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Kullanıcı eklenemedi");
        return;
      }
      alert("Kullanıcı başarıyla oluşturuldu!");
      setNewUserEmail("");
      setNewUserRole("admin");
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
      if (!accessToken) {
        alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
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
      if (!accessToken) {
        alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
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

  async function handleApproveController(req: ControllerRequest) {
    if (!confirm(`${req.email} adresli kontrolör başvurusunu onaylamak istiyor musunuz?`)) return;
    if (!accessToken) return;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ action: "approveController", requestId: req.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; mailSent?: boolean };
    if (!res.ok) return alert(data.error || "Kontrolör onayı başarısız");
    alert(data.mailSent ? "Kontrolör onaylandı, kullanım anlatımı e-postasına gönderildi." : "Kontrolör onaylandı.");
    fetchData();
  }

  async function handleRejectController(req: ControllerRequest) {
    if (!confirm(`${req.email} adresli kontrolör başvurusunu reddetmek istiyor musunuz?`)) return;
    if (!accessToken) return;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ action: "rejectController", requestId: req.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return alert(data.error || "Kontrolör reddetme başarısız");
    alert("Kontrolör başvurusu reddedildi.");
    fetchData();
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
      if (!accessToken) {
        alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
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
      if (!accessToken) {
        alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
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
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            Kullanıcı Yönetimi
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowControllerForm((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 font-semibold text-white hover:bg-primary-800"
            >
              <Plus className="h-4 w-4" />
              Kontrolör oluştur
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Rol ekle
            </button>
          </div>
        </div>

        {showControllerForm && (
          <form onSubmit={handleCreateController} className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Yeni kontrolör hesabı</h2>
              <p className="mt-1 text-sm text-slate-600">Hesap bu formdan oluşturulur. Etkinlik seçmezsen kontrolör giriş yapabilir ama bilet kontrol edemez.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Ad
                <input
                  required
                  value={controllerForm.firstName}
                  onChange={(e) => setControllerForm((form) => ({ ...form, firstName: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  autoComplete="given-name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Soyad
                <input
                  required
                  value={controllerForm.lastName}
                  onChange={(e) => setControllerForm((form) => ({ ...form, lastName: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  autoComplete="family-name"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                E-posta
                <input
                  required
                  type="email"
                  value={controllerForm.email}
                  onChange={(e) => setControllerForm((form) => ({ ...form, email: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  autoComplete="email"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Telefon
                <input
                  required
                  type="tel"
                  value={controllerForm.phone}
                  onChange={(e) => setControllerForm((form) => ({ ...form, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  autoComplete="tel"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                İlk şifre (opsiyonel)
                <input
                  type="password"
                  minLength={8}
                  value={controllerForm.password}
                  onChange={(e) => setControllerForm((form) => ({ ...form, password: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  autoComplete="new-password"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Boş bırakırsan sistem şifre üretir ve giriş bağlantısıyla birlikte kişinin e-postasına gönderir.
                </span>
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold text-slate-800">Görevli olacağı etkinlikler</legend>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">Atanabilecek etkinlik bulunamadı.</p>
              ) : (
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  {events.map((event) => (
                    <label key={event.id} className="flex items-start gap-2 rounded-md p-2 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={controllerEventIds.includes(event.id)}
                        onChange={(e) => setControllerEventIds((ids) => e.target.checked ? [...ids, event.id] : ids.filter((id) => id !== event.id))}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium">{event.title || "Adsız etkinlik"}</span>
                        <span className="text-xs text-slate-500">
                          {event.date ? new Date(event.date).toLocaleDateString("tr-TR") : "Tarih yok"}
                          {" · "}{controllerCountForEvent(event.id)} kontrolör atandı
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowControllerForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                İptal
              </button>
              <button type="submit" disabled={creatingController} className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
                {creatingController ? "Oluşturuluyor..." : "Kontrolör hesabını oluştur"}
              </button>
            </div>
          </form>
        )}

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
                  onChange={(e) => setNewUserRole(e.target.value as "admin")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                >
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

        <section className="mb-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Kontrolör hesapları ({controllerUsers.length})</h2>
              <p className="mt-1 text-sm text-slate-600">Her kontrolör yalnızca burada atandığı etkinliklerde bilet sorgulayabilir ve giriş işaretleyebilir.</p>
            </div>
          </div>
          {!controllerAssignmentTableReady && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              Etkinlik atama tablosu henüz kurulmamış. Supabase SQL Editor’da <code>supabase/migrations/120_controller_event_assignments.sql</code> migration’ını çalıştırın; etkinlik atamaları ve bilet kontrolü migration tamamlanana kadar kapalıdır.
            </div>
          )}
          {controllerUsers.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Henüz kontrolör hesabı yok.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {controllerUsers.map((controller) => {
                const assignedEvents = controllerAssignments
                  .filter((assignment) => assignment.controller_user_id === controller.user_id)
                  .map((assignment) => events.find((event) => event.id === assignment.event_id))
                  .filter((event): event is ControlEvent => Boolean(event));
                const isEditing = editingControllerId === controller.user_id;
                return (
                  <article key={controller.user_id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">
                          {controller.full_name || "İsim bilgisi yok"}
                        </h3>
                        <p className="text-sm text-slate-600">{controller.email || "E-posta yok"}</p>
                        <p className="text-sm text-slate-600">{controller.phone || "Telefon yok"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {assignedEvents.length > 0 ? assignedEvents.map((event) => (
                            <span key={event.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {event.title}
                            </span>
                          )) : (
                            <span className="text-xs font-medium text-amber-700">Etkinlik atanmamış</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => isEditing ? setEditingControllerId(null) : beginControllerAssignment(controller)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {isEditing ? "Kapat" : "Etkinlikleri düzenle"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(controller)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Kontrolörü sil
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <fieldset>
                          <legend className="mb-2 text-sm font-semibold text-slate-800">Atanmış etkinlikler</legend>
                          <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                            {events.map((event) => (
                              <label key={event.id} className="flex items-start gap-2 rounded-md bg-white p-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={assignmentDraft.includes(event.id)}
                                  onChange={(e) => setAssignmentDraft((ids) => e.target.checked ? [...ids, event.id] : ids.filter((id) => id !== event.id))}
                                  className="mt-0.5"
                                />
                                <span>
                                  <span className="block font-medium">{event.title || "Adsız etkinlik"}</span>
                                  <span className="text-xs text-slate-500">
                                    {event.date ? new Date(event.date).toLocaleDateString("tr-TR") : "Tarih yok"}
                                    {" · "}{controllerCountForEvent(event.id)} kontrolör atandı
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleSaveControllerEvents(controller.user_id)}
                            disabled={savingAssignment}
                            className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
                          >
                            {savingAssignment ? "Kaydediliyor..." : "Atamaları kaydet"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {controllerRequests.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bekleyen Kontrolör Başvuruları ({controllerRequests.length})
            </h3>
            <div className="space-y-3">
              {controllerRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-4 p-4 bg-white rounded-lg border border-blue-100">
                  <div>
                    <p className="font-medium text-slate-900">{req.email}</p>
                    <p className="text-sm text-slate-700">Ad Soyad: {req.full_name}</p>
                    <p className="text-sm text-slate-700">Telefon: {req.phone}</p>
                    <p className="text-sm text-slate-500">Başvuru: {new Date(req.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveController(req)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Onayla
                    </button>
                    <button
                      onClick={() => handleRejectController(req)}
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
  );
}

export default function KullanicilarPage() {
  return (
    <AdminOnlyGuard>
      <KullanicilarContent />
    </AdminOnlyGuard>
  );
}
