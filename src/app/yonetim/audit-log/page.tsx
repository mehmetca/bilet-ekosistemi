"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminGuard from "@/components/AdminGuard";
import { FileText, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

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
  const { isAdmin, isController } = useSimpleAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin && !isController) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit-logs");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Veriler yüklenemedi");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Audit log fetch error:", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isController]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  if (!isAdmin && !isController) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    );
  }

  if (loading && logs.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Denetim Kaydı</h1>
            <p className="text-slate-600 mt-1">
              Kritik admin işlemlerinin kaydı. Son 200 kayıt gösteriliyor.
            </p>
          </div>
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 text-red-800">
            <p className="font-medium">Hata: {error}</p>
            <p className="text-sm mt-1">audit_logs tablosu mevcut mu? Migration 027 çalıştırıldı mı?</p>
            <button
              onClick={() => fetchLogs()}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {logs.length === 0 && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <FileText className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p>Henüz kayıt yok.</p>
            <p className="text-sm mt-2">Etkinlik silme, güncelleme gibi işlemler burada görünecektir.</p>
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
                    <React.Fragment key={log.id}>
                      <tr
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
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="p-4">
                            <pre className="text-xs text-slate-600 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
