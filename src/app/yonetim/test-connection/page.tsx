"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

type TestResult = { success: boolean; data?: unknown; error?: string | null } | null;

export default function TestConnectionPage() {
  const [result, setResult] = useState<TestResult>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("count")
          .single();

        setResult({ success: !error, data, error: error?.message ?? null });
      } catch (err) {
        console.error("Test hatası:", err);
        setResult({
          success: false,
          error: (err as Error)?.message || 'Bilinmeyen hata'
        });
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Supabase Bağlantı Testi
        </h1>
        
        {loading ? (
          <div className="text-center text-slate-500">
            Test ediliyor...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Test Sonucu
            </h2>
            
            {result?.success ? (
              <div className="text-green-600">
                ✅ Bağlantı başarılı!
              </div>
            ) : (
              <div className="text-red-600">
                ❌ Bağlantı hatası: {result?.error}
              </div>
            )}
            
            <pre className="mt-4 p-4 bg-slate-100 rounded text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
