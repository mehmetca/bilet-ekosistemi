"use client";

import { useState, useEffect } from "react";

export default function TestMailPage() {
  const [formData, setFormData] = useState({
    smtpHost: "esrycjixjpup.eig6.mail-manager-smtp.amazonaws.com",
    smtpPort: "587",
    smtpUser: "inp-qewlzhjve6qzci5ujchklpup",
    smtpPass: "Mehmetcan21!",
    smtpFrom: "KurdEvents <noreply@kurdevents.com>",
    testEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);
  const [apiTest, setApiTest] = useState<{ success: boolean; message: string } | null>(null);

  // API endpoint çalışıyor mu test et
  const testApiEndpoint = async () => {
    try {
      // Yeni mail-test endpoint'ini dene
      const res = await fetch("/api/mail-test");
      const data = await res.json();
      console.log("Mail API test:", data);
      setApiTest(data);
    } catch (error) {
      console.error("API test error:", error);
      setApiTest({ success: false, message: "API endpoint çalışmıyor: " + (error instanceof Error ? error.message : "Bilinmeyen hata") });
    }
  };

  useEffect(() => {
    testApiEndpoint();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/mail-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log("API response:", data);
      setResult(data);
    } catch (error) {
      console.error("Fetch error:", error);
      setResult({ success: false, message: "API hatası: " + (error instanceof Error ? error.message : "Bilinmeyen hata") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">SMTP Mail Test</h1>
        
        {apiTest && (
          <div className={`mb-4 p-4 rounded ${apiTest.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            <p className="font-semibold">API Endpoint Durumu: {apiTest.success ? "✅ Çalışıyor" : "❌ Çalışmıyor"}</p>
            <p>{apiTest.message}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
          <div>
            <label className="block text-sm font-medium mb-1">SMTP Host</label>
            <input
              type="text"
              value={formData.smtpHost}
              onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">SMTP Port</label>
            <input
              type="text"
              value={formData.smtpPort}
              onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">SMTP User</label>
            <input
              type="text"
              value={formData.smtpUser}
              onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">SMTP Password</label>
            <input
              type="password"
              value={formData.smtpPass}
              onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">From Address</label>
            <input
              type="text"
              value={formData.smtpFrom}
              onChange={(e) => setFormData({ ...formData, smtpFrom: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Test Email (Kendi email adresiniz)</label>
            <input
              type="email"
              value={formData.testEmail}
              onChange={(e) => setFormData({ ...formData, testEmail: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="test@example.com"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded disabled:bg-gray-400"
          >
            {loading ? "Gönderiliyor..." : "Test Mail Gönder"}
          </button>
        </form>

        {result && (
          <div className={`mt-4 p-4 rounded ${result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            <p className="font-semibold">{result.success ? "✅ Başarılı" : "❌ Hata"}</p>
            <p>{result.message}</p>
            {result.messageId && <p className="text-sm mt-2">Message ID: {result.messageId}</p>}
            {result.details && <p className="text-sm mt-2 font-mono bg-white p-2 rounded">{result.details}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

TestMailPage.displayName = "TestMailPage";