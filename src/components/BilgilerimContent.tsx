"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { Save, Lock, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

type OrganizerRequest = {
  id?: string;
  email?: string;
  status?: string;
  company_name?: string | null;
  legal_form?: string | null;
  address?: string | null;
  phone?: string | null;
  trade_register?: string | null;
  trade_register_number?: string | null;
  vat_id?: string | null;
  representative_name?: string | null;
  organization_display_name?: string | null;
  created_at?: string;
};

type Profile = {
  id?: string;
  user_id?: string;
  kundennummer?: string;
  anrede?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firma?: string | null;
  address?: string | null;
  plz?: string | null;
  city?: string | null;
  ort?: string | null;
  country?: string | null;
  email?: string | null;
  telefon?: string | null;
  handynummer?: string | null;
  geburtsdatum?: string | null;
};

interface BilgilerimContentProps {
  /** Yönetim paneli içinde mi (organizatör) - true ise /giris'e yönlendirme yapılmaz */
  inYonetim?: boolean;
}

export default function BilgilerimContent({ inYonetim = false }: BilgilerimContentProps) {
  const t = useTranslations("myInfo");
  const tApp = useTranslations("organizerApplication");
  const { user, loading: authLoading, isOrganizer } = useSimpleAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizerRequest, setOrganizerRequest] = useState<OrganizerRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [orgSaveLoading, setOrgSaveLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  const isOrganizerInYonetim = inYonetim && isOrganizer;

  const [form, setForm] = useState({
    anrede: "",
    first_name: "",
    last_name: "",
    firma: "",
    address: "",
    plz: "",
    city: "",
    ort: "",
    country: "",
    email: "",
    telefon: "",
    handynummer: "",
    geburtsdatum: "",
  });

  const [password, setPassword] = useState({ newPassword: "", confirm: "" });

  const [orgForm, setOrgForm] = useState({
    company_name: "",
    legal_form: "",
    address: "",
    phone: "",
    trade_register: "",
    trade_register_number: "",
    vat_id: "",
    representative_name: "",
    organization_display_name: "",
  });

  useEffect(() => {
    if (!inYonetim && !authLoading && !user) {
      router.replace("/giris");
      return;
    }
    if (!user) return;
    fetchProfile();
  }, [user, authLoading, router, inYonetim]);

  useEffect(() => {
    if (organizerRequest && profile && !organizerRequest.representative_name?.trim()) {
      const repName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
      if (repName) setOrgForm((o) => ({ ...o, representative_name: repName }));
    }
  }, [organizerRequest, profile]);

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token || ""}`,
      "Content-Type": "application/json",
    };
  }

  async function fetchProfile() {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const [profileRes, orgRes] = await Promise.all([
        fetch("/api/profile", { headers }),
        fetch("/api/organizer-request", { headers }),
      ]);
      let profileData: Profile | null = null;
      let orgData: OrganizerRequest | null = null;
      if (profileRes.ok) {
        const data = (await profileRes.json()) as Profile | null;
        profileData = data;
        if (!data?.kundennummer) {
          const postRes = await fetch("/api/profile", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });
          if (postRes.ok) {
            const created = (await postRes.json()) as Profile;
            setProfile(created);
            profileData = created;
            setForm((f) => ({ ...f, email: user.email || "" }));
          }
        } else {
          setProfile(data || null);
          if (data) {
            setForm({
              anrede: data.anrede || "",
              first_name: data.first_name || "",
              last_name: data.last_name || "",
              firma: data.firma || "",
              address: data.address || "",
              plz: data.plz || "",
              city: data.city || "",
              ort: data.ort || "",
              country: data.country || "",
              email: data.email || user.email || "",
              telefon: data.telefon || "",
              handynummer: data.handynummer || "",
              geburtsdatum: data.geburtsdatum || "",
            });
          } else {
            setForm((f) => ({ ...f, email: user.email || "" }));
          }
        }
      }
      if (orgRes.ok) {
        orgData = (await orgRes.json()) as OrganizerRequest | null;
        setOrganizerRequest(orgData || null);
        if (orgData) {
          const repName = orgData.representative_name?.trim() ||
            (profileData ? [profileData.first_name, profileData.last_name].filter(Boolean).join(" ").trim() : "") ||
            "";
          setOrgForm({
            company_name: orgData.company_name || "",
            legal_form: orgData.legal_form || "",
            address: orgData.address || "",
            phone: orgData.phone || "",
            trade_register: orgData.trade_register || "",
            trade_register_number: orgData.trade_register_number || "",
            vat_id: orgData.vat_id || "",
            representative_name: repName,
            organization_display_name: orgData.organization_display_name || "",
          });
        } else if (isOrganizerInYonetim && profileData) {
          setOrgForm((o) => ({
            ...o,
            representative_name: [profileData!.first_name, profileData!.last_name].filter(Boolean).join(" ").trim(),
          }));
        }
      }
    } catch (e) {
      console.error(e);
      setError("errorLoadProfile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    setError("");
    setSuccess("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as Profile | { error?: string };
      if (!res.ok) {
        setError("errorSaveFailed");
        return;
      }
      setProfile(data as Profile);
      setSuccess("successSaved");
    } catch (e) {
      setError("errorGeneric");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!isOrganizerInYonetim) return;
    setOrgSaveLoading(true);
    setOrgError("");
    setOrgSuccess("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/organizer-request", {
        method: "PATCH",
        headers,
        body: JSON.stringify(orgForm),
      });
      const data = (await res.json().catch(() => ({}))) as OrganizerRequest | { error?: string };
      if (!res.ok) {
        setOrgError("errorSaveFailed");
        return;
      }
      setOrganizerRequest(data as OrganizerRequest);
      setOrgSuccess("successSaved");
    } catch (e) {
      setOrgError("errorGeneric");
    } finally {
      setOrgSaveLoading(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdLoading(true);
    setPwdError("");
    setPwdSuccess("");
    if (password.newPassword !== password.confirm) {
      setPwdError("errorPasswordsDontMatch");
      setPwdLoading(false);
      return;
    }
    if (password.newPassword.length < 6) {
      setPwdError("errorPasswordMinLength");
      setPwdLoading(false);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          password: password.newPassword,
          passwordConfirm: password.confirm,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const backendError = String(data.error || "").toLowerCase();
        if (backendError.includes("eşleş")) {
          setPwdError("errorPasswordsDontMatch");
        } else if (backendError.includes("en az 6")) {
          setPwdError("errorPasswordMinLength");
        } else {
          setPwdError("errorPasswordUpdateFailed");
        }
        return;
      }
      setPwdSuccess("successPasswordUpdated");
      setPassword({ newPassword: "", confirm: "" });
    } catch (e) {
      setPwdError("errorGeneric");
    } finally {
      setPwdLoading(false);
    }
  }

  if (!inYonetim && (authLoading || (!user && loading))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">{t("loading")}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t("title")}</h1>

      {loading ? (
        <div className="text-slate-500">{t("loading")}</div>
      ) : (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Müşteri Numarası - organizatörler için gizle (müşteri değiller) */}
          {!isOrganizerInYonetim && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("kundennummer")}</label>
              <input
                type="text"
                value={profile?.kundennummer || "—"}
                readOnly
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          )}

          {/* Anrede */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("anrede")}</label>
            <select
              value={form.anrede}
              onChange={(e) => setForm((f) => ({ ...f, anrede: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">—</option>
              <option value="Herr">{t("anredeHerr")}</option>
              <option value="Frau">{t("anredeFrau")}</option>
              <option value="divers">{t("anredeDivers")}</option>
            </select>
          </div>

          {/* Adı / Soyadı - organizatörlerde doluysa değiştirilemez */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("firstName")}</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                readOnly={isOrganizerInYonetim && !!(profile?.first_name?.trim())}
                className={`w-full px-3 py-2 border rounded-lg ${isOrganizerInYonetim && profile?.first_name?.trim() ? "bg-slate-100 text-slate-600 border-slate-200" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("lastName")}</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                readOnly={isOrganizerInYonetim && !!(profile?.last_name?.trim())}
                className={`w-full px-3 py-2 border rounded-lg ${isOrganizerInYonetim && profile?.last_name?.trim() ? "bg-slate-100 text-slate-600 border-slate-200" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"}`}
              />
            </div>
          </div>

          {/* Firma */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("firma")}</label>
            <input
              type="text"
              value={form.firma}
              onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {/* Adres */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("address")}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder={t("addressHint")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-slate-500">{t("addressHint")}</p>
          </div>

          {/* PLZ / Stadt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("plzCity")}</label>
              <input
                type="text"
                value={form.plz}
                onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))}
                placeholder={t("plzPlaceholder")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("cityLabel")}</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder={t("cityPlaceholder")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Ort / Land */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("ort")}</label>
              <input
                type="text"
                value={form.ort}
                onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("country")}</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* E-Mail */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {/* Telefon */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("telefon")}</label>
            <input
              type="tel"
              value={form.telefon}
              onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {/* Handynummer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("handynummer")}</label>
            <input
              type="tel"
              value={form.handynummer}
              onChange={(e) => setForm((f) => ({ ...f, handynummer: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {/* Geburtsdatum */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("geburtsdatum")}</label>
            <input
              type="date"
              value={form.geburtsdatum}
              onChange={(e) => setForm((f) => ({ ...f, geburtsdatum: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {t(error as Parameters<typeof t>[0]) || error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {t(success as Parameters<typeof t>[0]) || success}
            </div>
          )}

          <button
            type="submit"
            disabled={saveLoading}
            className="flex items-center gap-2 w-full justify-center py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {t("saveData")}
          </button>
        </form>
      )}

      {/* Organizasyon Başvuru Bilgileri - organizatörler için düzenlenebilir */}
      {(organizerRequest || isOrganizerInYonetim) && (
        <div className="mt-10 pt-8 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("organizationFormSection")}
          </h2>
          {organizerRequest?.status === "pending" && (
            <p className="text-amber-700 text-sm font-medium mb-4">{t("organizationFormStatusPending")}</p>
          )}
          {organizerRequest?.status === "approved" && (
            <p className="text-green-700 text-sm font-medium mb-4">{t("organizationFormStatusApproved")}</p>
          )}
          {organizerRequest?.status === "rejected" && (
            <p className="text-red-700 text-sm font-medium mb-4">{t("organizationFormStatusRejected")}</p>
          )}
          {isOrganizerInYonetim ? (
            <form onSubmit={handleSaveOrganization} className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("companyName")}</label>
                  <input
                    type="text"
                    value={orgForm.company_name}
                    onChange={(e) => setOrgForm((o) => ({ ...o, company_name: e.target.value }))}
                    placeholder={tApp("companyNamePlaceholder")}
                    readOnly={!!(organizerRequest?.company_name?.trim())}
                    className={`w-full px-3 py-2 border rounded-lg ${organizerRequest?.company_name?.trim() ? "bg-slate-100 text-slate-600 border-slate-200" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"}`}
                    title={organizerRequest?.company_name?.trim() ? t("organizationInfoReadOnlyHint") : undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("legalForm")}</label>
                  <input
                    type="text"
                    value={orgForm.legal_form}
                    onChange={(e) => setOrgForm((o) => ({ ...o, legal_form: e.target.value }))}
                    placeholder={tApp("legalFormPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("address")}</label>
                  <input
                    type="text"
                    value={orgForm.address}
                    onChange={(e) => setOrgForm((o) => ({ ...o, address: e.target.value }))}
                    placeholder={tApp("addressPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("phone")}</label>
                  <input
                    type="tel"
                    value={orgForm.phone}
                    onChange={(e) => setOrgForm((o) => ({ ...o, phone: e.target.value }))}
                    placeholder={tApp("phonePlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("representativeName")}</label>
                  <input
                    type="text"
                    value={orgForm.representative_name}
                    onChange={(e) => setOrgForm((o) => ({ ...o, representative_name: e.target.value }))}
                    placeholder={tApp("representativeNamePlaceholder")}
                    readOnly={!!(organizerRequest?.representative_name?.trim())}
                    className={`w-full px-3 py-2 border rounded-lg ${organizerRequest?.representative_name?.trim() ? "bg-slate-100 text-slate-600 border-slate-200" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"}`}
                    title={organizerRequest?.representative_name?.trim() ? t("organizationInfoReadOnlyHint") : undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("organizationDisplayName")}</label>
                  <input
                    type="text"
                    value={orgForm.organization_display_name}
                    onChange={(e) => setOrgForm((o) => ({ ...o, organization_display_name: e.target.value }))}
                    placeholder={tApp("organizationDisplayNamePlaceholder")}
                    readOnly={!!(organizerRequest?.organization_display_name?.trim())}
                    className={`w-full px-3 py-2 border rounded-lg ${organizerRequest?.organization_display_name?.trim() ? "bg-slate-100 text-slate-600 border-slate-200" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"}`}
                    title={organizerRequest?.organization_display_name?.trim() ? t("organizationInfoReadOnlyHint") : undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("tradeRegister")}</label>
                  <input
                    type="text"
                    value={orgForm.trade_register}
                    onChange={(e) => setOrgForm((o) => ({ ...o, trade_register: e.target.value }))}
                    placeholder={tApp("tradeRegisterPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("tradeRegisterNumber")}</label>
                  <input
                    type="text"
                    value={orgForm.trade_register_number}
                    onChange={(e) => setOrgForm((o) => ({ ...o, trade_register_number: e.target.value }))}
                    placeholder={tApp("tradeRegisterNumberPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{tApp("vatId")}</label>
                  <input
                    type="text"
                    value={orgForm.vat_id}
                    onChange={(e) => setOrgForm((o) => ({ ...o, vat_id: e.target.value }))}
                    placeholder={tApp("vatIdPlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>
              {orgError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{t(orgError as Parameters<typeof t>[0]) || orgError}</div>
              )}
              {orgSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{t(orgSuccess as Parameters<typeof t>[0]) || orgSuccess}</div>
              )}
              <button
                type="submit"
                disabled={orgSaveLoading}
                className="flex items-center gap-2 justify-center py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {t("saveOrganizationInfo")}
              </button>
            </form>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("companyName")}</span>
                  <span className="text-slate-900">{organizerRequest?.company_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("legalForm")}</span>
                  <span className="text-slate-900">{organizerRequest?.legal_form || "—"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block mb-1">{tApp("address")}</span>
                  <span className="text-slate-900">{organizerRequest?.address || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("phone")}</span>
                  <span className="text-slate-900">{organizerRequest?.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("representativeName")}</span>
                  <span className="text-slate-900">{organizerRequest?.representative_name || profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—" : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("organizationDisplayName")}</span>
                  <span className="text-slate-900">{organizerRequest?.organization_display_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("tradeRegister")}</span>
                  <span className="text-slate-900">{organizerRequest?.trade_register || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("tradeRegisterNumber")}</span>
                  <span className="text-slate-900">{organizerRequest?.trade_register_number || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">{tApp("vatId")}</span>
                  <span className="text-slate-900">{organizerRequest?.vat_id || "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Veri koruması */}
      <p className="mt-6 text-sm text-slate-600">
        {t("dataProtection")}{" "}
        <Link href="/bilgilendirme/cerez-politikasi" className="text-primary-600 hover:underline">
          {t("dataProtectionLink")}
        </Link>{" "}
        {t("dataProtectionSuffix")}
      </p>

      {/* Şifre değiştirme */}
      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t("changePassword")}
        </h2>
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("newPassword")}</label>
            <input
              type="password"
              value={password.newPassword}
              onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("confirmPassword")}</label>
            <input
              type="password"
              value={password.confirm}
              onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          {pwdError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {t(pwdError as Parameters<typeof t>[0]) || pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {t(pwdSuccess as Parameters<typeof t>[0]) || pwdSuccess}
            </div>
          )}
          <button
            type="submit"
            disabled={pwdLoading}
            className="flex items-center gap-2 w-full justify-center py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {t("save")}
          </button>
        </form>
      </div>
    </div>
  );
}
