"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { getMusensaalTemplateCopy } from "@/lib/seating-plans/musensaal-to-db";
import { getPlan } from "@/lib/seating-plans";
import SalonPlanViewer from "@/components/SalonPlanViewer";
import type { SeatingPlan, SeatingPlanSection, SeatingPlanRow, Seat } from "@/types/database";
import { planSectionsMatchMusensaalTemplate } from "@/lib/seating-plans/musensaal-structure-match";

const SeatingKonvaRowEditor = dynamic(
  () => import("@/components/SeatingKonvaRowEditor"),
  { ssr: false, loading: () => <p className="text-xs text-slate-500 py-2">Görsel düzen yükleniyor…</p> }
);

function planHasMusensaalStructure(sections: SeatingPlanSection[]): boolean {
  return planSectionsMatchMusensaalTemplate(sections);
}

export default function OturumPlaniPage() {
  return (
    <OrganizerOrAdminGuard>
      <Suspense fallback={<div className="p-8 text-slate-500">Yükleniyor...</div>}>
        <OturumPlaniContent />
      </Suspense>
    </OrganizerOrAdminGuard>
  );
}

function OturumPlaniContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const venueId = params?.venueId as string;
  const rawReturn = searchParams.get("return");
  const safeReturn =
    rawReturn &&
    rawReturn.startsWith("/yonetim") &&
    !rawReturn.includes("//") &&
    rawReturn.startsWith("/")
      ? rawReturn
      : null;

  const [venueName, setVenueName] = useState<string>("");
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [sectionsByPlan, setSectionsByPlan] = useState<Record<string, SeatingPlanSection[]>>({});
  const [rowsBySection, setRowsBySection] = useState<Record<string, SeatingPlanRow[]>>({});
  const [seatsByRow, setSeatsByRow] = useState<Record<string, Seat[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [addingPlan, setAddingPlan] = useState(false);
  const [addingMultipleSalons, setAddingMultipleSalons] = useState(false);
  const [musensaalCopyPlanName, setMusensaalCopyPlanName] = useState("Salon 1");
  const [newSectionName, setNewSectionName] = useState<Record<string, string>>({});
  const [newRowLabel, setNewRowLabel] = useState<Record<string, string>>({});
  const [newSeatRange, setNewSeatRange] = useState<Record<string, string>>({}); // "1-10" gibi
  const [sectionTicketLabel, setSectionTicketLabel] = useState<Record<string, string>>({}); // sectionId -> ticket_type_label (düzenleme)
  const [copyingTemplate, setCopyingTemplate] = useState(false);
  const [creatingTheaterDuisburg, setCreatingTheaterDuisburg] = useState(false);
  const [addingMissingRows, setAddingMissingRows] = useState(false);
  const [addingMissingSeats, setAddingMissingSeats] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    (async () => {
      const { data: venue } = await supabase.from("venues").select("name").eq("id", venueId).single();
      setVenueName(venue?.name || "Mekan");

      const { data: plansData } = await supabase
        .from("seating_plans")
        .select("*")
        .eq("venue_id", venueId)
        .order("name");
      setPlans(plansData || []);

      if (plansData?.length) {
        const planIds = plansData.map((p) => p.id);
        const { data: sections } = await supabase
          .from("seating_plan_sections")
          .select("*")
          .in("seating_plan_id", planIds)
          .order("sort_order");
        const byPlan: Record<string, SeatingPlanSection[]> = {};
        (sections || []).forEach((s) => {
          if (!byPlan[s.seating_plan_id]) byPlan[s.seating_plan_id] = [];
          byPlan[s.seating_plan_id].push(s);
        });
        setSectionsByPlan(byPlan);

        const sectionIds = (sections || []).map((s) => s.id);
        if (sectionIds.length) {
          const { data: rows } = await supabase
            .from("seating_plan_rows")
            .select("*")
            .in("section_id", sectionIds)
            .order("sort_order");
          const bySection: Record<string, SeatingPlanRow[]> = {};
          (rows || []).forEach((r) => {
            if (!bySection[r.section_id]) bySection[r.section_id] = [];
            bySection[r.section_id].push(r);
          });
          setRowsBySection(bySection);

          const rowIds = (rows || []).map((r) => r.id);
          if (rowIds.length) {
            const { data: seats } = await supabase.from("seats").select("*").in("row_id", rowIds);
            const byRow: Record<string, Seat[]> = {};
            (seats || []).forEach((s) => {
              if (!byRow[s.row_id]) byRow[s.row_id] = [];
              byRow[s.row_id].push(s);
            });
            setSeatsByRow(byRow);
          }
        }
      }
      setLoading(false);
    })();
  }, [venueId]);

  const refreshPlans = async () => {
    if (!venueId) return;
    const { data } = await supabase.from("seating_plans").select("*").eq("venue_id", venueId).order("name");
    setPlans(data || []);
  };
  const refreshSections = async (planId: string) => {
    const { data } = await supabase
      .from("seating_plan_sections")
      .select("*")
      .eq("seating_plan_id", planId)
      .order("sort_order");
    setSectionsByPlan((prev) => ({ ...prev, [planId]: data || [] }));
  };
  const refreshRows = async (sectionId: string) => {
    const { data } = await supabase
      .from("seating_plan_rows")
      .select("*")
      .eq("section_id", sectionId)
      .order("sort_order");
    setRowsBySection((prev) => ({ ...prev, [sectionId]: data || [] }));
  };
  const refreshSeats = async (rowId: string) => {
    const { data } = await supabase.from("seats").select("*").eq("row_id", rowId);
    setSeatsByRow((prev) => ({ ...prev, [rowId]: data || [] }));
  };

  const handleDeleteSeat = async (seatId: string, rowId: string) => {
    if (!confirm("Bu koltuk silinsin mi? Satılmış koltuk silinemez.")) return;
    const { error } = await supabase.from("seats").delete().eq("id", seatId);
    if (error) {
      if (error.code === "23503") alert("Bu koltuk daha önce satıldığı için silinemez.");
      else alert("Koltuk silinemedi: " + error.message);
      return;
    }
    await refreshSeats(rowId);
  };

  const handleDeleteRow = async (rowId: string, sectionId: string, planId: string) => {
    if (!confirm("Bu sıra ve içindeki tüm koltuklar silinsin mi? Sırada satılmış koltuk varsa sıra silinemez.")) return;
    const { error } = await supabase.from("seating_plan_rows").delete().eq("id", rowId);
    if (error) {
      if (error.code === "23503") alert("Bu sırada satılmış koltuk var, sıra silinemez.");
      else alert("Sıra silinemedi: " + error.message);
      return;
    }
    await refreshRows(sectionId);
    setSeatsByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const handleAddPlan = async () => {
    if (!newPlanName.trim() || !venueId) return;
    setAddingPlan(true);
    const { data, error } = await supabase
      .from("seating_plans")
      .insert({ venue_id: venueId, name: newPlanName.trim(), is_default: plans.length === 0 })
      .select()
      .single();
    setAddingPlan(false);
    if (error) {
      alert("Salon eklenemedi: " + error.message);
      return;
    }
    setNewPlanName("");
    await refreshPlans();
    if (data) setExpandedPlan(data.id);
  };

  /** Bir seferde 2, 3 veya 4 salon ekler. Mevcut "Salon N" isimlerine bakıp numarayı devam ettirir (örn. 2 salon varsa Salon 3, Salon 4). */
  const handleAddMultipleSalons = async (count: number) => {
    if (!venueId || count < 2 || count > 4) return;
    const matchSalonN = plans.map((p) => p.name.match(/^Salon\s*(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
    const maxN = matchSalonN.length ? Math.max(0, ...matchSalonN.map((m) => parseInt(m[1], 10))) : 0;
    const start = maxN + 1;
    setAddingMultipleSalons(true);
    try {
      for (let i = 0; i < count; i++) {
        const name = `Salon ${start + i}`;
        const isFirst = plans.length === 0 && i === 0;
        const { data, error } = await supabase
          .from("seating_plans")
          .insert({ venue_id: venueId, name, is_default: isFirst })
          .select()
          .single();
        if (error) {
          alert(`"${name}" eklenirken hata: ${error.message}`);
          break;
        }
        if (data && i === 0) setExpandedPlan(data.id);
      }
      await refreshPlans();
    } finally {
      setAddingMultipleSalons(false);
    }
  };

  const handleAddSection = async (planId: string) => {
    const name = newSectionName[planId]?.trim();
    if (!name) return;
    const sections = sectionsByPlan[planId] || [];
    const { error } = await supabase.from("seating_plan_sections").insert({
      seating_plan_id: planId,
      name,
      sort_order: sections.length,
    });
    if (error) {
      alert("Bölüm eklenemedi: " + error.message);
      return;
    }
    setNewSectionName((prev) => ({ ...prev, [planId]: "" }));
    await refreshSections(planId);
  };

  const handleAddRow = async (sectionId: string, planId: string) => {
    const label = newRowLabel[sectionId]?.trim();
    if (!label) return;
    const rows = rowsBySection[sectionId] || [];
    const { error } = await supabase.from("seating_plan_rows").insert({
      section_id: sectionId,
      row_label: label,
      sort_order: rows.length,
    });
    if (error) {
      alert("Sıra eklenemedi: " + error.message);
      return;
    }
    setNewRowLabel((prev) => ({ ...prev, [sectionId]: "" }));
    await refreshRows(sectionId);
  };

  const handleAddSeats = async (rowId: string, sectionId: string) => {
    const range = newSeatRange[rowId]?.trim();
    if (!range) return;
    const existing = seatsByRow[rowId] || [];
    const labels: string[] = [];
    if (/^\d+-\d+$/.test(range)) {
      const [a, b] = range.split("-").map(Number);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) labels.push(String(i));
    } else {
      labels.push(range);
    }
    const toInsert = labels.filter((l) => !existing.some((s) => s.seat_label === l));
    if (toInsert.length === 0) {
      setNewSeatRange((prev) => ({ ...prev, [rowId]: "" }));
      return;
    }
    const { error } = await supabase.from("seats").insert(toInsert.map((seat_label) => ({ row_id: rowId, seat_label })));
    if (error) {
      alert("Koltuk eklenemedi: " + error.message);
      return;
    }
    setNewSeatRange((prev) => ({ ...prev, [rowId]: "" }));
    await refreshSeats(rowId);
  };

  /** Şablondan kopya oluşturur veya mevcut Musensaal planını şablonla yeniler. */
  const runMusensaalTemplate = async (planId: string, isNewPlan: boolean) => {
    const template = getMusensaalTemplateCopy();
    if (!isNewPlan) {
      const { data: existingSections } = await supabase.from("seating_plan_sections").select("id").eq("seating_plan_id", planId);
      const sectionIds = (existingSections || []).map((s) => s.id);
      if (sectionIds.length > 0) {
        const { data: rowsToDelete } = await supabase.from("seating_plan_rows").select("id").in("section_id", sectionIds);
        const rowIds = (rowsToDelete || []).map((r) => r.id);
        if (rowIds.length > 0) await supabase.from("seats").delete().in("row_id", rowIds);
        await supabase.from("seating_plan_rows").delete().in("section_id", sectionIds);
        await supabase.from("seating_plan_sections").delete().eq("seating_plan_id", planId);
      }
    }
    for (const section of template.sections) {
      const { data: sectionData, error: sectionErr } = await supabase
        .from("seating_plan_sections")
        .insert({
          seating_plan_id: planId,
          name: section.name,
          sort_order: section.sort_order,
          ticket_type_label: section.ticket_type_label ?? null,
        })
        .select()
        .single();
      if (sectionErr || !sectionData) {
        console.error("Section insert failed:", section.name, sectionErr);
        continue;
      }
      const sectionId = sectionData.id;
      for (let ri = 0; ri < section.rows.length; ri++) {
        const row = section.rows[ri];
        const { data: rowData, error: rowErr } = await supabase
          .from("seating_plan_rows")
          .insert({ section_id: sectionId, row_label: row.row_label, sort_order: row.sort_order })
          .select()
          .single();
        if (rowErr || !rowData) {
          console.error("Row insert failed:", section.name, row.row_label, rowErr);
          continue;
        }
        const toInsert = row.seat_labels.map((seat_label) => ({ row_id: rowData.id, seat_label }));
        for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
          const batch = toInsert.slice(chunk, chunk + 50);
          const { error: seatErr } = await supabase.from("seats").insert(batch);
          if (seatErr) console.error("Seats insert failed:", section.name, row.row_label, seatErr);
        }
      }
    }
  };

  const handleCopyFromTemplate = async () => {
    if (!venueId) return;
    const planName = (musensaalCopyPlanName || "Salon 1").trim() || "Salon 1";
    if (!confirm(`Musensaal (Rosengarten Mannheim) şablonu bu mekana "${planName}" adıyla eklenecek. Onaylıyor musunuz?`)) return;
    setCopyingTemplate(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: planData, error: planErr } = await supabase
        .from("seating_plans")
        .insert({ venue_id: venueId, name: planName, is_default: plans.length === 0 })
        .select()
        .single();
      if (planErr || !planData) {
        alert("Plan oluşturulamadı: " + (planErr?.message || "Bilinmeyen hata"));
        return;
      }
      await runMusensaalTemplate(planData.id, true);
      await refreshPlans();
      setExpandedPlan(planData.id);
    } finally {
      setCopyingTemplate(false);
    }
  };

  /** Theater Duisburg görsel planı için veritabanında bölüm/sıra/koltuk oluşturur (API ile). */
  const handleCreateTheaterDuisburg = async () => {
    if (!venueId) return;
    if (!confirm('Bu mekan için "Theater Duisburg" oturum planı oluşturulacak (bölümler, sıralar, koltuklar). Etkinlikte bu planı seçip görsel plan ile koltuk seçimi yapabilirsiniz. Devam?')) return;
    setCreatingTheaterDuisburg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      const res = await fetch('/api/yonetim/theater-duisburg-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Plan oluşturulamadı.');
        return;
      }
      await refreshPlans();
      if (data.planId) setExpandedPlan(data.planId);
    } finally {
      setCreatingTheaterDuisburg(false);
    }
  };

  /** Şablonda olup DB'de olmayan sıraları (ve koltuklarını) ekler. Mevcut veriler ve satılan koltuklar silinmez. */
  const handleAddMissingRows = async (planId: string) => {
    if (!confirm("Bu plan için Musensaal şablonundaki eksik sıralar eklenecek. Mevcut sıra ve koltuklar aynen kalır. Devam?")) return;
    setAddingMissingRows(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: dbSections } = await supabase
        .from("seating_plan_sections")
        .select("id, name, sort_order")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      if (!dbSections?.length || dbSections.length !== template.sections.length) {
        alert("Plan bölüm sayısı şablonla uyuşmuyor. Önce \"Şablonu yeniden uygula\" ile planı sıfırlayın.");
        return;
      }
      let added = 0;
      for (let si = 0; si < template.sections.length; si++) {
        const tSection = template.sections[si];
        const dbSection = dbSections[si];
        if (!dbSection || dbSection.name !== tSection.name) continue;
        const { data: existingRows } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label")
          .eq("section_id", dbSection.id);
        const existingLabels = new Set((existingRows || []).map((r) => String(r.row_label).trim()));
        for (let ri = 0; ri < tSection.rows.length; ri++) {
          const tRow = tSection.rows[ri];
          const rowLabel = String(tRow.row_label).trim();
          if (existingLabels.has(rowLabel)) continue;
          const { data: rowData, error: rowErr } = await supabase
            .from("seating_plan_rows")
            .insert({ section_id: dbSection.id, row_label: rowLabel, sort_order: tRow.sort_order })
            .select()
            .single();
          if (rowErr || !rowData) {
            console.error("Row insert failed:", dbSection.name, rowLabel, rowErr);
            continue;
          }
          const toInsert = tRow.seat_labels.map((seat_label) => ({ row_id: rowData.id, seat_label }));
          for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
            const batch = toInsert.slice(chunk, chunk + 50);
            const { error: seatErr } = await supabase.from("seats").insert(batch);
            if (seatErr) console.error("Seats insert failed:", dbSection.name, rowLabel, seatErr);
          }
          existingLabels.add(rowLabel);
          added++;
        }
      }
      if (added > 0) {
        await refreshPlans();
        const sectionIds = (dbSections || []).map((s) => s.id);
        const { data: rows } = await supabase.from("seating_plan_rows").select("*").in("section_id", sectionIds).order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds?.length) {
          const { data: seats } = await supabase.from("seats").select("*").in("row_id", rowIds);
          const byRow: Record<string, Seat[]> = {};
          (seats || []).forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
        setExpandedPlan(planId);
        alert(`${added} eksik sıra eklendi.`);
      } else {
        alert("Eksik sıra bulunamadı; plan şablondaki tüm sıralara sahip.");
      }
    } finally {
      setAddingMissingRows(false);
    }
  };

  /** Koltukları olmayan (veya şablona göre eksik koltuklu) sıralara şablondan koltuk ekler. */
  const handleAddMissingSeats = async (planId: string) => {
    if (!confirm("Koltuk sayısı 0 olan sıralara Musensaal şablonundaki koltuk sayısı kadar koltuk eklenecek. Devam?")) return;
    setAddingMissingSeats(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: dbSections } = await supabase
        .from("seating_plan_sections")
        .select("id, name, sort_order")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      if (!dbSections?.length || dbSections.length !== template.sections.length) {
        alert("Plan bölüm sayısı şablonla uyuşmuyor.");
        return;
      }
      let rowsFilled = 0;
      let seatsAdded = 0;
      for (let si = 0; si < template.sections.length; si++) {
        const tSection = template.sections[si];
        const dbSection = dbSections[si];
        if (!dbSection || dbSection.name !== tSection.name) continue;
        const tRowByLabel = new Map(tSection.rows.map((r) => [String(r.row_label).trim(), r]));
        const { data: dbRows } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label")
          .eq("section_id", dbSection.id);
        const { data: existingSeats } = await supabase
          .from("seats")
          .select("row_id")
          .in("row_id", (dbRows || []).map((r) => r.id));
        const seatCountByRowId = new Map<string, number>();
        (existingSeats || []).forEach((s) => {
          seatCountByRowId.set(s.row_id, (seatCountByRowId.get(s.row_id) ?? 0) + 1);
        });
        for (const dbRow of dbRows || []) {
          const count = seatCountByRowId.get(dbRow.id) ?? 0;
          if (count > 0) continue;
          const rowLabel = String(dbRow.row_label).trim();
          const tRow = tRowByLabel.get(rowLabel);
          if (!tRow || !tRow.seat_labels.length) continue;
          const toInsert = tRow.seat_labels.map((seat_label) => ({ row_id: dbRow.id, seat_label }));
          for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
            const batch = toInsert.slice(chunk, chunk + 50);
            const { error: seatErr } = await supabase.from("seats").insert(batch);
            if (seatErr) {
              console.error("Seats insert failed:", dbSection.name, rowLabel, seatErr);
              break;
            }
            seatsAdded += batch.length;
          }
          rowsFilled++;
        }
      }
      if (rowsFilled > 0 || seatsAdded > 0) {
        const sectionIds = dbSections.map((s) => s.id);
        const { data: rows } = await supabase.from("seating_plan_rows").select("*").in("section_id", sectionIds).order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds?.length) {
          const { data: seats } = await supabase.from("seats").select("*").in("row_id", rowIds);
          const byRow: Record<string, Seat[]> = {};
          (seats || []).forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
        setExpandedPlan(planId);
        alert(`${rowsFilled} sıraya toplam ${seatsAdded} koltuk eklendi.`);
      } else {
        alert("Koltukları eksik sıra bulunamadı; tüm sıralarda koltuk var.");
      }
    } finally {
      setAddingMissingSeats(false);
    }
  };

  const handleResyncMusensaal = async (planId: string) => {
    if (!confirm("Bu planın tüm bölüm/sıra/koltuk verileri silinip Musensaal şablonu yeniden uygulanacak. Devam?")) return;
    setCopyingTemplate(true);
    try {
      await runMusensaalTemplate(planId, false);
      await refreshPlans();
      const { data: sections } = await supabase
        .from("seating_plan_sections")
        .select("*")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      const byPlan: Record<string, SeatingPlanSection[]> = {};
      (sections || []).forEach((s) => {
        if (!byPlan[s.seating_plan_id]) byPlan[s.seating_plan_id] = [];
        byPlan[s.seating_plan_id].push(s);
      });
      setSectionsByPlan((prev) => ({ ...prev, ...byPlan }));
      const sectionIds = (sections || []).map((s) => s.id);
      if (sectionIds.length) {
        const { data: rows } = await supabase
          .from("seating_plan_rows")
          .select("*")
          .in("section_id", sectionIds)
          .order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds.length) {
          const { data: seats } = await supabase.from("seats").select("*").in("row_id", rowIds);
          const byRow: Record<string, Seat[]> = {};
          (seats || []).forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
      }
      setExpandedPlan(planId);
    } finally {
      setCopyingTemplate(false);
    }
  };

  const setDefaultPlan = async (planId: string) => {
    await supabase.from("seating_plans").update({ is_default: false }).eq("venue_id", venueId);
    await supabase.from("seating_plans").update({ is_default: true }).eq("id", planId);
    await refreshPlans();
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Bu salonu ve tüm bölüm/sıra/koltuk verilerini silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase.from("seating_plans").delete().eq("id", planId);
    if (error) alert("Silinemedi: " + error.message);
    else await refreshPlans();
  };

  const saveSectionTicketLabel = async (sectionId: string, label: string) => {
    const { error } = await supabase
      .from("seating_plan_sections")
      .update({ ticket_type_label: label.trim() || null })
      .eq("id", sectionId);
    if (error) alert("Bilet türü kaydedilemedi: " + error.message);
    else {
      const planId = (sectionsByPlan && Object.keys(sectionsByPlan).find((pid) => (sectionsByPlan[pid] || []).some((s) => s.id === sectionId))) || "";
      if (planId) await refreshSections(planId);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/yonetim/mekanlar"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Mekanlar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Salon tasarımı</h1>
      {safeReturn && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-slate-800">
          <span>Etkinlik sihirbazından geldiniz. Planı kaydettikten sonra geri dönüp salonu seçebilirsiniz.</span>
          <Link
            href={safeReturn}
            className="shrink-0 rounded-md bg-primary-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-primary-700"
          >
            Etkinlik sihirbazına dön
          </Link>
        </div>
      )}
      <p className="mt-1 text-slate-600">
        <strong>{venueName}</strong> için salonları burada tanımlayın. Musensaal (Rosengarten Mannheim) koltuk planını kullanmak için şablondan kopyalayın; açtığınız salonda görsel koltuk planı önizlemesi gösterilir. Etkinlik oluştururken mekan + salon seçilir. Her sıra altında <strong>sürükle-bırak</strong> ile koltuk konumlarını kaydedebilirsiniz.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Blok taslağı ile tasarlamak isterseniz: <Link href="/yonetim/salon-tasarim-vizor" className="text-primary-600 hover:underline">Salon Tasarım Vizörü</Link> ile tasarlayıp &quot;Bu planı mekana aktar&quot; ile bu mekana ekleyebilirsiniz.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
          placeholder="Salon adı (örn. Salon 1, Ana salon)"
          className="rounded-lg border border-slate-300 px-3 py-2 flex-1 max-w-xs"
        />
        <button
          type="button"
          onClick={handleAddPlan}
          disabled={addingPlan || !newPlanName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni salon
        </button>
        <span className="text-slate-400 text-sm">veya</span>
        <div className="inline-flex gap-1">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleAddMultipleSalons(n)}
              disabled={addingMultipleSalons}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm"
              title={`${n} salon ekle (Salon 1 … Salon ${n})`}
            >
              {addingMultipleSalons ? "Ekleniyor…" : `${n} salon ekle`}
            </button>
          ))}
        </div>
        <span className="text-slate-500 text-sm">Musensaal şablonu:</span>
        <input
          type="text"
          value={musensaalCopyPlanName}
          onChange={(e) => setMusensaalCopyPlanName(e.target.value)}
          placeholder="Salon 1 veya Musensaal"
          className="rounded-lg border border-slate-300 px-3 py-2 w-40"
          title="Şablon kopyalandığında bu isimle salon oluşturulur"
        />
        <button
          type="button"
          onClick={handleCopyFromTemplate}
          disabled={copyingTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Musensaal (Rosengarten Mannheim) koltuk planı bu mekana verilen isimle eklenir."
        >
          <Copy className="h-4 w-4" />
          {copyingTemplate ? "Kopyalanıyor…" : "Şablondan kopyala: Musensaal"}
        </button>
        <button
          type="button"
          onClick={handleCreateTheaterDuisburg}
          disabled={creatingTheaterDuisburg}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Theater Duisburg (görsel plan) bölüm/sıra/koltuk verilerini veritabanında oluşturur. Etkinlikte bu planı seçince salon görseli üzerinde tıklanabilir koltuklar gösterilir."
        >
          <Copy className="h-4 w-4" />
          {creatingTheaterDuisburg ? "Oluşturuluyor…" : "Theater Duisburg planını oluştur"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <strong>Musensaal:</strong> &quot;Salon 1&quot; veya &quot;Musensaal&quot; yazıp &quot;Şablondan kopyala&quot; ile Rosengarten Mannheim koltuk planı bu mekana eklenir. <strong>Theater Duisburg:</strong> &quot;Theater Duisburg planını oluştur&quot; ile görsel plan (fotoğraf/PDF) ile eşleşen bölüm/sıra/koltuk veritabanına eklenir; <code>public/seatplans/theaterduisburg.svg</code> dosyası varken etkinlik sayfasında görsel plan gösterilir; koltuk id’leri için <code>npm run seatplan:tag-duisburg</code> ile <code>theaterduisburg.tagged.svg</code> üretilebilir.
      </p>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Bilet türleri ile eşleştirme:</strong> Her bölümde &quot;Bilet türü (etkinlikte eşlenecek)&quot; alanına yazdığınız isim, <em>etkinlik oluştururken</em> eklediğiniz bilet türü adıyla <strong>birebir aynı</strong> olmalı (örn. Kategori 1, Kategori 2). Musensaal şablonundan kopyaladıysanız bölümler zaten Kategori 1–4 ile işaretlidir; etkinlikte bu isimlerle bilet türü ekleyin.
      </div>

      <div className="mt-8 space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedPlan((id) => (id === plan.id ? null : plan.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedPlan((id) => (id === plan.id ? null : plan.id));
                }
              }}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                {expandedPlan === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {plan.name}
                {plan.is_default && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Varsayılan</span>}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {plan.name && plan.name.includes("Musensaal") && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddMissingRows(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-green-700 hover:text-green-800 border border-green-400 px-2 py-1 rounded"
                      title="Şablonda olup planda olmayan sıraları ekler. Mevcut veriler silinmez."
                    >
                      {addingMissingRows ? "Ekleniyor…" : "Eksik sıraları ekle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddMissingSeats(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-blue-700 hover:text-blue-800 border border-blue-400 px-2 py-1 rounded"
                      title="Koltuk sayısı 0 olan sıralara şablondan koltuk ekler."
                    >
                      {addingMissingSeats ? "Ekleniyor…" : "Eksik koltukları ekle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResyncMusensaal(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-amber-700 hover:text-amber-800 border border-amber-300 px-2 py-1 rounded"
                      title="Bölüm/sıra/koltuk verilerini siler ve güncel Musensaal şablonunu yeniden uygular (Parkett 1–29, Empore Hinten 5–12 vb.)."
                    >
                      Şablonu yeniden uygula
                    </button>
                  </>
                )}
                {!plan.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefaultPlan(plan.id)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Varsayılan yap
                  </button>
                )}
                <button type="button" onClick={() => deletePlan(plan.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Planı sil">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {expandedPlan === plan.id && (
              <div className="border-t border-slate-200 px-5 pb-5 pt-2">
                {planHasMusensaalStructure(sectionsByPlan[plan.id] || []) && (() => {
                  const musensaalPlan = getPlan("musensaal");
                  return musensaalPlan ? (
                    <div className="mb-6 rounded-xl border border-primary-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Koltuk planı önizleme (Musensaal düzeni)</h3>
                      <p className="text-xs text-slate-500 mb-3">Bu salon Musensaal (Rosengarten Mannheim) düzenindedir. Koltuklara tıklayarak seçim yapabilirsiniz.</p>
                      <div className="overflow-x-auto">
                        <SalonPlanViewer plan={musensaalPlan} />
                      </div>
                    </div>
                  ) : null;
                })()}
                <div className="flex gap-2 mt-2 mb-4">
                  <input
                    type="text"
                    value={newSectionName[plan.id] ?? ""}
                    onChange={(e) => setNewSectionName((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                    placeholder="Bölüm adı (örn. Blok A)"
                    className="rounded-lg border border-slate-300 px-3 py-2 flex-1 max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSection(plan.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                  >
                    <Plus className="h-4 w-4" /> Bölüm ekle
                  </button>
                </div>
                {(sectionsByPlan[plan.id] || []).map((section) => (
                  <div key={section.id} className="ml-4 mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedSection((id) => (id === section.id ? null : section.id))}
                      className="w-full flex items-center gap-2 text-left font-medium text-slate-800"
                    >
                      {expandedSection === section.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {section.name}
                    </button>
                    {expandedSection === section.id && (
                      <div className="mt-3 ml-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-sm text-slate-600">Bilet türü / fiyat (etkinlikte eşlenecek):</label>
                          <input
                            type="text"
                            value={sectionTicketLabel[section.id] ?? (section as SeatingPlanSection & { ticket_type_label?: string }).ticket_type_label ?? ""}
                            onChange={(e) => setSectionTicketLabel((prev) => ({ ...prev, [section.id]: e.target.value }))}
                            onBlur={(e) => saveSectionTicketLabel(section.id, e.target.value)}
                            placeholder="Örn: Kategori 1, VIP"
                            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-48"
                          />
                          <span className="text-xs text-slate-500">Etkinlikteki bilet türü adıyla aynı yazın; koltuk fiyatı o biletin fiyatı olur.</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newRowLabel[section.id] ?? ""}
                            onChange={(e) => setNewRowLabel((prev) => ({ ...prev, [section.id]: e.target.value }))}
                            placeholder="Sıra (örn. 1 veya A)"
                            className="rounded-lg border border-slate-300 px-3 py-2 w-32"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddRow(section.id, plan.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-300 text-sm"
                          >
                            <Plus className="h-3 w-3" /> Sıra ekle
                          </button>
                        </div>
                        {(rowsBySection[section.id] || []).map((row) => (
                          <div key={row.id} className="rounded border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-700">Sıra {row.row_label}</p>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id, section.id, plan.id)}
                                className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                                title="Sırayı ve tüm koltuklarını sil"
                                aria-label={`Sıra ${row.row_label} sil`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={newSeatRange[row.id] ?? ""}
                                onChange={(e) => setNewSeatRange((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                placeholder="Koltuk: 1 veya 1-20"
                                className="rounded border border-slate-300 px-2 py-1 w-28 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSeats(row.id, section.id)}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Ekle
                              </button>
                              <span className="text-slate-500 text-sm">
                                ({(seatsByRow[row.id] || []).length} koltuk)
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(seatsByRow[row.id] || []).map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-0.5 rounded bg-slate-100 pl-2 pr-1 py-0.5 text-xs text-slate-700"
                                >
                                  {s.seat_label}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSeat(s.id, row.id)}
                                    className="p-0.5 rounded hover:bg-red-100 text-slate-500 hover:text-red-600"
                                    title="Koltuk sil"
                                    aria-label={`Koltuk ${s.seat_label} sil`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <SeatingKonvaRowEditor
                              rowId={row.id}
                              rowLabel={row.row_label}
                              seats={seatsByRow[row.id] || []}
                              onSaved={() => {
                                void refreshSeats(row.id);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <p className="mt-6 text-slate-500">
          Henüz salon yok. Yukarıdan &quot;Yeni salon&quot; veya &quot;2 salon ekle&quot; / &quot;3 salon ekle&quot; ile ekleyin; her salona bölüm, sıra ve koltuk tanımlayın veya Salon Tasarım Vizöründen plan aktarın.
        </p>
      )}
    </div>
  );
}
