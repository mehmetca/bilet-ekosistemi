"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import type { SeatingPlan, SeatingPlanSection, SeatingPlanRow, Seat } from "@/types/database";

export default function OturumPlaniPage() {
  return (
    <OrganizerOrAdminGuard>
      <OturumPlaniContent />
    </OrganizerOrAdminGuard>
  );
}

function OturumPlaniContent() {
  const params = useParams();
  const venueId = params?.venueId as string;

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
  const [newSectionName, setNewSectionName] = useState<Record<string, string>>({});
  const [newRowLabel, setNewRowLabel] = useState<Record<string, string>>({});
  const [newSeatRange, setNewSeatRange] = useState<Record<string, string>>({}); // "1-10" gibi
  const [sectionTicketLabel, setSectionTicketLabel] = useState<Record<string, string>>({}); // sectionId -> ticket_type_label (düzenleme)

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
      alert("Plan eklenemedi: " + error.message);
      return;
    }
    setNewPlanName("");
    await refreshPlans();
    if (data) setExpandedPlan(data.id);
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

  const setDefaultPlan = async (planId: string) => {
    await supabase.from("seating_plans").update({ is_default: false }).eq("venue_id", venueId);
    await supabase.from("seating_plans").update({ is_default: true }).eq("id", planId);
    await refreshPlans();
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Bu planı ve tüm bölüm/sıra/koltuk verilerini silmek istediğinize emin misiniz?")) return;
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
      <h1 className="text-2xl font-bold text-slate-900">Oturum planı</h1>
      <p className="mt-1 text-slate-600">
        <strong>{venueName}</strong> için bölüm, sıra ve koltuk tanımlayın. Etkinlik oluştururken bu planı seçerek &quot;Yer seçerek bilet al&quot; özelliğini açabilirsiniz.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          type="text"
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
          placeholder="Yeni plan adı (örn. Ana salon)"
          className="rounded-lg border border-slate-300 px-3 py-2 flex-1 max-w-xs"
        />
        <button
          type="button"
          onClick={handleAddPlan}
          disabled={addingPlan || !newPlanName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni plan
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedPlan((id) => (id === plan.id ? null : plan.id))}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                {expandedPlan === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {plan.name}
                {plan.is_default && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Varsayılan</span>}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
            </button>
            {expandedPlan === plan.id && (
              <div className="border-t border-slate-200 px-5 pb-5 pt-2">
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
                            <p className="text-sm font-medium text-slate-700">Sıra {row.row_label}</p>
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
                                <span key={s.id} className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                  {s.seat_label}
                                </span>
                              ))}
                            </div>
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
          Henüz oturum planı yok. Yukarıdan &quot;Yeni plan&quot; ile ekleyin; sonra bölüm, sıra ve koltuk tanımlayın.
        </p>
      )}
    </div>
  );
}
