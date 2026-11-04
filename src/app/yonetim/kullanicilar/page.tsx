"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, UserCheck, CheckCircle, XCircle, Calendar, Eye, X, Search as SearchIcon } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";

function authHeaders(accessToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

/** Kullanıcı listesi sayfa boyu; altında 1,2,3… sayfa numaraları gösterilir. */
const USERS_PAGE_SIZE = 30;

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

/** Admin, organizatörün onaylı şirket/fatura bilgilerini kendi adına düzenler. */
type CustomerOrderRow = {
  id: string;
  quantity: number;
  total_price: number;
  ticket_code?: string;
  status: string;
  created_at: string;
  events?: { title?: string; date?: string; time?: string; venue?: string } | null;
  tickets?: { name?: string } | null;
};

type CustomerResult = {
  profile: {
    kundennummer?: string;
    anrede?: string;
    first_name?: string;
    last_name?: string;
    firma?: string;
    address?: string;
    plz?: string;
    city?: string;
    email?: string;
    telefon?: string;
    handynummer?: string;
  };
  authInfo?: { email?: string; created_at?: string; last_sign_in_at?: string; user_id?: string };
  orders: CustomerOrderRow[];
};

type OrganizerCompanyForm = {
  userId: string;
  email: string | null;
  company_name: string;
  legal_form: string;
  street: string;
  postcode: string;
  city: string;
  country_code: string;
  vat_id: string;
  tax_number: string;
  invoice_email: string;
  phone: string;
  representative_name: string;
  trade_register: string;
  trade_register_number: string;
  organization_display_name: string;
  logo_path: string;
  kleinunternehmer: boolean;
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
  const [companyEdit, setCompanyEdit] = useState<OrganizerCompanyForm | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [customerResult, setCustomerResult] = useState<CustomerResult | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
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

  /** Atama seçenekleri: geçmiş etkinlikler hiçbir listede gösterilmez. */
  const upcomingEvents = useMemo(() => {
    const bugun = new Date().toISOString().slice(0, 10);
    return events.filter((event) => !event.date || String(event.date).slice(0, 10) >= bugun);
  }, [events]);

  const controllerUsers = users.filter((user) => user.roles.includes("controller"));
  const controllerCountForEvent = (eventId: string) =>
    new Set(
      controllerAssignments
        .filter((assignment) => assignment.event_id === eventId)
        .map((assignment) => assignment.controller_user_id)
    ).size;

  const upcomingEventsById = useMemo(() => new Set(upcomingEvents.map((event) => event.id)), [upcomingEvents]);

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

  /** Müşteri/organizatörün giriş e-postasını düzeltir (destek: yanlış yazılmış adres). */
  async function handleFixEmail(user: DisplayUser) {
    const answer = window.prompt("Kullanıcının yeni e-posta adresi:", user.email || "");
    if (answer === null) return;
    const email = answer.trim().toLowerCase();
    if (!email || email === (user.email || "").toLowerCase()) return;
    if (!accessToken) {
      alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ action: "updateEmail", userId: user.user_id, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) {
        alert(data.error || "E-posta güncellenemedi");
        return;
      }
      alert(`E-posta güncellendi: ${data.email || email}`);
      fetchData();
    } catch {
      alert("Bir hata oluştu.");
    }
  }

  /** Kullanıcı şifresini unuttuğunda admin geçici şifre verir. */
  async function handleFixPassword(user: DisplayUser) {
    const answer = window.prompt(
      `${user.email || user.user_id} için yeni şifre (en az 8 karakter):`,
      ""
    );
    if (answer === null || !answer.trim()) return;
    if (answer.trim().length < 8) {
      alert("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (!accessToken) {
      alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({
          action: "updatePassword",
          userId: user.user_id,
          password: answer.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Şifre güncellenemedi");
        return;
      }
      alert("Şifre güncellendi. Kullanıcıya yeni şifreyi iletin.");
    } catch {
      alert("Bir hata oluştu.");
    }
  }

  /** Organizatörün şirket/fatura bilgilerini (fatura satıcı bloğu) düzenleme. */
  async function openCompanyEditor(user: DisplayUser) {
    if (!accessToken) {
      alert("Oturum gerekli. Lütfen tekrar giriş yapın.");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ action: "getOrganizerCompany", userId: user.user_id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        company?: Record<string, unknown>;
      };
      if (!res.ok || !data.company) {
        alert(data.error || "Organizatör kaydı okunamadı");
        return;
      }
      const c = data.company;
      const str = (key: string) => (typeof c[key] === "string" ? (c[key] as string) : "");
      setCompanyEdit({
        userId: user.user_id,
        email: user.email,
        company_name: str("company_name"),
        legal_form: str("legal_form"),
        street: str("street"),
        postcode: str("postcode"),
        city: str("city"),
        country_code: str("country_code") || "DE",
        vat_id: str("vat_id"),
        tax_number: str("tax_number"),
        invoice_email: str("invoice_email"),
        phone: str("phone"),
        representative_name: str("representative_name"),
        trade_register: str("trade_register"),
        trade_register_number: str("trade_register_number"),
        organization_display_name: str("organization_display_name"),
        logo_path: str("logo_path"),
        kleinunternehmer: c.kleinunternehmer === true,
      });
    } catch {
      alert("Bir hata oluştu.");
    }
  }

  async function handleSaveCompany() {
    if (!companyEdit || !accessToken) return;
    setCompanySaving(true);
    try {
      const { userId, email, ...company } = companyEdit;
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ action: "updateOrganizerCompany", userId, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Kaydedilemedi");
        return;
      }
      alert(`Şirket bilgileri kaydedildi${email ? ` (${email})` : ""}.`);
      setCompanyEdit(null);
    } catch {
      alert("Bir hata oluştu.");
    } finally {
      setCompanySaving(false);
    }
  }

  /** Kundennummer / e-posta / ID parçası ile profil + siparişleri getirir (eski "Müşteri Ara"). */
  async function handleCustomerSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = userSearch.trim();
    if (!term) {
      setCustomerResult(null);
      setCustomerError("");
      return;
    }
    setCustomerLoading(true);
    setCustomerError("");
    setCustomerResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/customer-by-kundennummer?q=${encodeURIComponent(term)}`,
        { headers: { Authorization: `Bearer ${session?.access_token || ""}` } }
      );
      const data = (await res.json().catch(() => ({}))) as CustomerResult & { error?: string };
      if (!res.ok) {
        setCustomerError(data.error || "Müşteri bulunamadı.");
        return;
      }
      setCustomerResult(data);
    } catch {
      setCustomerError("Bir hata oluştu.");
    } finally {
      setCustomerLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [
        user.email || "",
        user.full_name || "",
        user.phone || "",
        user.user_id || "",
        ...(user.roles || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [users, userSearch]);

  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const currentUsersPage = Math.min(usersPage, usersPageCount);
  const pagedUsers = filteredUsers.slice(
    (currentUsersPage - 1) * USERS_PAGE_SIZE,
    currentUsersPage * USERS_PAGE_SIZE
  );

  /** Uzun listelerde 1 … 4 5 6 … 20 biçiminde kompakt sayfa numaraları. */
  const usersPageNumbers = useMemo(() => {
    const pages: Array<number | "gap"> = [];
    const total = usersPageCount;
    const current = currentUsersPage;
    const windowStart = Math.max(2, current - 1);
    const windowEnd = Math.min(total - 1, current + 1);
    pages.push(1);
    if (windowStart > 2) pages.push("gap");
    for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p);
    if (windowEnd < total - 1) pages.push("gap");
    if (total > 1) pages.push(total);
    return pages;
  }, [usersPageCount, currentUsersPage]);

  async function removeRole(userId?: string, role?: string) {    if (!userId || !role) {
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
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-slate-500">Atanabilecek etkinlik bulunamadı.</p>
              ) : (
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  {upcomingEvents.map((event) => (
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
                const upcomingAssigned = assignedEvents.filter((event) => upcomingEventsById.has(event.id));
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
                          {upcomingAssigned.length > 0 ? upcomingAssigned.map((event) => (
                            <span key={event.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {event.title}
                            </span>
                          )) : assignedEvents.length === 0 ? (
                            <span className="text-xs font-medium text-amber-700">Etkinlik atanmamış</span>
                          ) : null}
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
                            {upcomingEvents.map((event) => (
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
        <form onSubmit={handleCustomerSearch} className="mb-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUsersPage(1);
                  if (!e.target.value.trim()) {
                    setCustomerResult(null);
                    setCustomerError("");
                  }
                }}
                placeholder="E-posta, ad soyad, Kundennummer veya ID parçası ile ara…"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={customerLoading}
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {customerLoading ? "Aranıyor…" : "Müşteri kartı"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Liste yazarken süzülür. "Müşteri kartı" bastığında profil, giriş bilgisi ve siparişler
            gelir (Kundennummer BiIgilerim sayfasındadır; e-posta veya ID parçası da kabul edilir).
          </p>
        </form>

        {customerError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {customerError}
          </div>
        )}

        {customerResult && (
          <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {[customerResult.profile.first_name, customerResult.profile.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                    customerResult.profile.email ||
                    customerResult.authInfo?.email ||
                    "Müşteri"}
                </h2>
                <p className="text-xs text-slate-500">
                  Kundennummer: {customerResult.profile.kundennummer || "—"} · ID:{" "}
                  <span className="font-mono">
                    {customerResult.authInfo?.user_id
                      ? customerResult.authInfo.user_id.slice(-8)
                      : "—"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerResult(null)}
                className="rounded p-1 hover:bg-slate-100"
                title="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-500">E-posta:</span>{" "}
                {customerResult.profile.email || customerResult.authInfo?.email || "—"}
              </div>
              <div>
                <span className="text-slate-500">Telefon:</span>{" "}
                {customerResult.profile.telefon || customerResult.profile.handynummer || "—"}
              </div>
              <div>
                <span className="text-slate-500">Adres:</span>{" "}
                {[customerResult.profile.address, customerResult.profile.plz, customerResult.profile.city]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
              <div>
                <span className="text-slate-500">Firma:</span>{" "}
                {customerResult.profile.firma || "—"}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Siparişler ({customerResult.orders.length})
              </h3>
              {customerResult.orders.length === 0 ? (
                <p className="text-sm text-slate-500">Henüz sipariş yok.</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {customerResult.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {order.events?.title || "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {order.events?.date || "—"}
                          {order.ticket_code ? ` · ${order.ticket_code}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">
                          {order.tickets?.name || "Bilet"} × {order.quantity}
                        </span>
                        <span className="font-medium">
                          €{Number(order.total_price || 0).toFixed(2)}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            order.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : order.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
                {pagedUsers.map((user) => (
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
                        <button
                          onClick={() => handleFixEmail(user)}
                          className="p-1.5 px-2 text-slate-700 hover:bg-slate-100 rounded text-xs font-medium border border-slate-200"
                          title="Giriş e-postasını düzelt"
                        >
                          E-posta
                        </button>
                        <button
                          onClick={() => handleFixPassword(user)}
                          className="p-1.5 px-2 text-slate-700 hover:bg-slate-100 rounded text-xs font-medium border border-slate-200"
                          title="Yeni şifre ver"
                        >
                          Şifre
                        </button>
                        {user.roles.includes("organizer") && (
                          <button
                            onClick={() => openCompanyEditor(user)}
                            className="p-1.5 px-2 text-amber-700 hover:bg-amber-50 rounded text-xs font-medium border border-amber-200"
                            title="Şirket / fatura bilgilerini düzenle"
                          >
                            Şirket
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {filteredUsers.length} kullanıcı · sayfa {currentUsersPage}/{usersPageCount}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setUsersPage(Math.max(1, currentUsersPage - 1))}
                disabled={currentUsersPage === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              {usersPageNumbers.map((entry, index) =>
                entry === "gap" ? (
                  <span key={`gap-${index}`} className="px-2 text-sm text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setUsersPage(entry)}
                    className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm ${
                      entry === currentUsersPage
                        ? "border-primary-500 bg-primary-50 font-semibold text-primary-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setUsersPage(Math.min(usersPageCount, currentUsersPage + 1))}
                disabled={currentUsersPage === usersPageCount}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )}

        {companyEdit && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
            <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Şirket bilgileri{companyEdit.email ? ` — ${companyEdit.email}` : ""}
                </h2>
                <button
                  type="button"
                  onClick={() => setCompanyEdit(null)}
                  className="rounded p-1 hover:bg-slate-100"
                  title="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-slate-600">
                Faturada satıcı bloğu bu bilgilerden üretilir. Değişiklik yalnız bundan sonraki belgelere yansır.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["company_name", "Ünvan / firma adı"],
                    ["legal_form", "Hukuki tür (GmbH, e.K.)"],
                    ["street", "Sokak / cadde"],
                    ["postcode", "Posta kodu"],
                    ["city", "Şehir"],
                    ["country_code", "Ülke kodu (DE)"],
                    ["vat_id", "USt-IdNr."],
                    ["tax_number", "Steuernummer"],
                    ["invoice_email", "Fatura e-postası"],
                    ["phone", "Telefon"],
                    ["representative_name", "Temsilci"],
                    ["trade_register", "Sicil mahkemesi"],
                    ["trade_register_number", "Sicil no (HRB)"],
                    ["organization_display_name", "Organizatör görünen adı"],
                    ["logo_path", "Logo yolu (uploads/...)"],
                  ] as Array<[keyof OrganizerCompanyForm, string]>
                ).map(([key, label]) => (
                  <label key={key} className="text-sm">
                    <span className="mb-1 block text-slate-600">{label}</span>
                    <input
                      value={String(companyEdit[key] ?? "")}
                      onChange={(e) =>
                        setCompanyEdit({ ...companyEdit, [key]: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={companyEdit.kleinunternehmer}
                  onChange={(e) =>
                    setCompanyEdit({ ...companyEdit, kleinunternehmer: e.target.checked })
                  }
                />
                Kleinunternehmer (§ 19 UStG — faturada KDV gösterilmez)
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyEdit(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompany}
                  disabled={companySaving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {companySaving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        )}
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
