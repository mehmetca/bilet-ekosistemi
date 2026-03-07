"use client";

import PanelLayout from "@/components/PanelLayout";
import BilgilerimContent from "@/components/BilgilerimContent";

export default function BilgilerimPage() {
  return (
    <PanelLayout>
      <BilgilerimContent inYonetim={false} />
    </PanelLayout>
  );
}
