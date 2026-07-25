"use client";

import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import SalonWizard2Client from "@/components/salon-wizard-2/SalonWizard2Client";

/**
 * Salon Yapım Wizard 2 — eski `/yonetim/salon-yapim-wizard` ile paralel.
 * Eski wizard dosyalarına dokunulmaz; geri dönüş: bu rotayı kullanmayı bırak.
 */
export default function SalonYapimWizard2Page() {
  return (
    <OrganizerOrAdminGuard>
      <SalonWizard2Client />
    </OrganizerOrAdminGuard>
  );
}
