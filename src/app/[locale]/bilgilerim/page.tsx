"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import PanelLayout from "@/components/PanelLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { Save, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

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

export default function BilgilerimPage() {
  const t = useTranslations("myInfo");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useSimpleAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/giris");
      return;
    }
    if (!user) return;
    fetchProfile();
  }, [user, authLoading, router]);

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
      const res = await fetch("/api/profile", { headers });
      if (res.ok) {
        const data = (await res.json()) as Profile | null;
        if (!data?.kundennummer) {
          const postRes = await fetch("/api/profile", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });
          if (postRes.ok) {
            const created = (await postRes.json()) as Profile;
            setProfile(created);
            setForm((f) => ({ ...f, email: user.email || "" }));
            setLoading(false);
            return;
          }
        }
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
        setError((data as { error?: string }).error || "errorSaveFailed");
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
        setPwdError(data.error || "errorPasswordUpdateFailed");
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

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">{t("loading")}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <PanelLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{t("title")}</h1>

        {loading ? (
          <div className="text-slate-500">{t("loading")}</div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Kundennummer */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("kundennummer")}</label>
              <input
                type="text"
                value={profile?.kundennummer || "—"}
                readOnly
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>

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

            {/* Adı / Soyadı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("firstName")}</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("lastName")}</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
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
              <p className="mt-1 text-xs text-slate-500">
                {t("addressHint")}
              </p>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t("handynummer")}
              </label>
              <input
                type="tel"
                value={form.handynummer}
                onChange={(e) => setForm((f) => ({ ...f, handynummer: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            {/* Geburtsdatum */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t("geburtsdatum")}
              </label>
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

        {/* Veri koruması */}
        <p className="mt-6 text-sm text-slate-600">
          {t("dataProtection")}{" "}
          <Link href="/cerez-politikasi" className="text-primary-600 hover:underline">
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
    </PanelLayout>
  );
}
