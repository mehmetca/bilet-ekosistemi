"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Eye, EyeOff, ArrowLeft, Calendar, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";

const PASSWORD_EXISTS_PATTERN = /already registered|already exists/i;
const PASSWORD_VALIDATION_PATTERN = /password|weak|at least \d+ characters/i;

export default function OrganizerApplicationPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("organizerApplication");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [tradeRegister, setTradeRegister] = useState("");
  const [tradeRegisterNumber, setTradeRegisterNumber] = useState("");
  const [vatId, setVatId] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [organizationDisplayName, setOrganizationDisplayName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!termsAccepted) {
      setError(tApp("termsRequired"));
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: undefined },
      });

      if (signUpError) {
        if (PASSWORD_EXISTS_PATTERN.test(signUpError.message || "")) {
          setError(t("errorEmailExistsOrganizer"));
        } else if (PASSWORD_VALIDATION_PATTERN.test(signUpError.message || "")) {
          setError(t("passwordRequirements"));
        } else {
          setError(signUpError.message || t("errorRegisterFailed"));
        }
        return;
      }

      if (!signUpData.user?.id) {
        setError(t("errorOrganizerApplyFailed"));
        return;
      }

      const res = await fetch("/api/organizer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: signUpData.user.id,
          email: email.trim(),
          company_name: companyName.trim() || undefined,
          legal_form: legalForm.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          trade_register: tradeRegister.trim() || undefined,
          trade_register_number: tradeRegisterNumber.trim() || undefined,
          vat_id: vatId.trim() || undefined,
          representative_name: representativeName.trim() || undefined,
          organization_display_name: organizationDisplayName.trim() || undefined,
          terms_accepted: true,
        }),
      });

      const resData = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(resData.error || t("errorOrganizerApplyFailedShort"));
        return;
      }

      setSuccess(t("successOrganizerApplied"));
      setEmail("");
      setPassword("");
      setCompanyName("");
      setLegalForm("");
      setAddress("");
      setPhone("");
      setTradeRegister("");
      setTradeRegisterNumber("");
      setVatId("");
      setRepresentativeName("");
      setOrganizationDisplayName("");
      setTermsAccepted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/giris"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {tApp("backToLogin")}
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-100 text-primary-600 mb-4">
              <Calendar className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{tApp("title")}</h1>
            <p className="text-slate-600 text-sm leading-relaxed">{tApp("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hesap Bilgileri */}
            <section>
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {tApp("accountSection")}
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="org-email" className="block text-sm font-medium text-slate-700 mb-1">
                    {t("email")}
                  </label>
                  <input
                    id="org-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t("regEmailPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="org-password" className="block text-sm font-medium text-slate-700 mb-1">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <input
                      id="org-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder={t("regPasswordPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Firma / DDG § 5 Bilgileri */}
            <section>
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {tApp("companySection")}
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="company-name" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("companyName")} *
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder={tApp("companyNamePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="legal-form" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("legalForm")} *
                  </label>
                  <input
                    id="legal-form"
                    type="text"
                    value={legalForm}
                    onChange={(e) => setLegalForm(e.target.value)}
                    required
                    placeholder={tApp("legalFormPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("address")} *
                  </label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    rows={3}
                    placeholder={tApp("addressPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("phone")} *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder={tApp("phonePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="trade-register" className="block text-sm font-medium text-slate-700 mb-1">
                      {tApp("tradeRegister")}
                    </label>
                    <input
                      id="trade-register"
                      type="text"
                      value={tradeRegister}
                      onChange={(e) => setTradeRegister(e.target.value)}
                      placeholder={tApp("tradeRegisterPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="trade-register-number" className="block text-sm font-medium text-slate-700 mb-1">
                      {tApp("tradeRegisterNumber")}
                    </label>
                    <input
                      id="trade-register-number"
                      type="text"
                      value={tradeRegisterNumber}
                      onChange={(e) => setTradeRegisterNumber(e.target.value)}
                      placeholder={tApp("tradeRegisterNumberPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="vat-id" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("vatId")}
                  </label>
                  <input
                    id="vat-id"
                    type="text"
                    value={vatId}
                    onChange={(e) => setVatId(e.target.value)}
                    placeholder={tApp("vatIdPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="representative" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("representativeName")} *
                  </label>
                  <input
                    id="representative"
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    required
                    placeholder={tApp("representativeNamePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="org-display-name" className="block text-sm font-medium text-slate-700 mb-1">
                    {tApp("organizationDisplayName")} *
                  </label>
                  <input
                    id="org-display-name"
                    type="text"
                    value={organizationDisplayName}
                    onChange={(e) => setOrganizationDisplayName(e.target.value)}
                    required
                    placeholder={tApp("organizationDisplayNamePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">{tApp("organizationDisplayNameHelp")}</p>
                </div>
              </div>
            </section>

            {/* Sözleşme Onayı */}
            <section>
              <h2 className="text-sm font-semibold text-slate-800 mb-4">{tApp("termsSection")}</h2>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700 group-hover:text-slate-900">
                  {tApp("termsCheckbox")}
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-2 ml-8">
                <Link href="/bilgilendirme/b2b" className="text-primary-600 hover:underline">
                  {tApp("termsB2BLink")}
                </Link>{" "}
                {tApp("termsB2BLinkSuffix")}
              </p>
            </section>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white py-3 rounded-lg font-semibold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? t("submitting") : t("organizerApply")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
