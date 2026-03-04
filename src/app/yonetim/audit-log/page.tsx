"use client";

import { useState, useEffect } from "react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import AdminGuard from "@/components/AdminGuard";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogPage() {
  return (
    <AdminGuard>
      <AuditLogContent />
    </AdminGuard>
  );
}

function AuditLogContent() {
  const { isAdmin } = useSimpleAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchLogs();
  }, [isAdmin]);

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (err) {
      console.error("Audit log fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const actionLabels: Record<string, string> = {
    create: "Oluşturma",
    update: "Güncelleme",
    delete: "Silme",
    login: "Giriş",
  };

  const entityLabels: Record<string, string> = {
    event: "Etkinlik",
    order: "Sipariş",
    user_role: "Kullanıcı Rolü",
    venue: "Mekan",
    news: "Haber",
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Denetim Kaydı</h1>
        <p className="text-slate-600 mb-6">
          Kritik admin işlemlerinin kaydı. Son 200 kayıt gösteriliyor.
        </p>

        {logs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <FileText className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p>Henüz kayıt yok.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Tarih</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Kullanıcı</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">İşlem</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Varlık</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">ID</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
                      >
                        <td className="p-4 text-sm text-slate-600">
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-4 text-sm text-slate-900">{log.user_email || "—"}</td>
                        <td className="p-4 text-sm">
                          <span className="font-medium">
                            {actionLabels[log.action] || log.action}
                          </span>
                        </td>
                        <td className="p-4 text-sm">
                          {entityLabels[log.entity_type] || log.entity_type}
                        </td>
                        <td className="p-4 text-sm font-mono text-slate-500 truncate max-w-[120px]">
                          {log.entity_id || "—"}
                        </td>
                        <td className="p-4">
                          {Object.keys(log.details || {}).length > 0 ? (
                            expandedId === log.id ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )
                          ) : null}
                        </td>
                      </tr>
                      {expandedId === log.id && Object.keys(log.details || {}).length > 0 && (
                        <tr key={`${log.id}-detail`} className="bg-slate-50/50">
                          <td colSpan={6} className="p-4">
                            <pre className="text-xs text-slate-600 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
