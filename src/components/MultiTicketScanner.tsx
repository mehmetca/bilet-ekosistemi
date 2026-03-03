"use client";

import { useState, useCallback } from "react";
import { Camera, X, Users, CheckCircle, AlertCircle, Wifi, WifiOff } from "lucide-react";
import QRScanner from "./QRScanner";
import { feedbackService } from "@/lib/feedbackService";

interface ScannedTicket {
  code: string;
  status: 'pending' | 'valid' | 'invalid' | 'duplicate';
  timestamp: Date;
  result?: any;
}

interface MultiTicketScannerProps {
  onBatchComplete?: (tickets: ScannedTicket[]) => void;
  onClose?: () => void;
}

export default function MultiTicketScanner({ onBatchComplete, onClose }: MultiTicketScannerProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedTickets, setScannedTickets] = useState<ScannedTicket[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);

  // Monitor online status
  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  const handleScan = useCallback(async (code: string) => {
    // Check for duplicates
    if (scannedTickets.some(ticket => ticket.code === code)) {
      feedbackService.playWarning();
      setScannedTickets(prev => [...prev, {
        code,
        status: 'duplicate',
        timestamp: new Date()
      }]);
      return;
    }

    // Add pending ticket
    const newTicket: ScannedTicket = {
      code,
      status: 'pending',
      timestamp: new Date()
    };

    setScannedTickets(prev => [...prev, newTicket]);

    // Validate ticket (online or offline)
    try {
      let result;
      if (isOnline) {
        // Online validation
        const formData = new FormData();
        formData.append('ticket_code', code);
        result = await fetch('/api/check-ticket', {
          method: 'POST',
          body: formData
        }).then(res => res.json());
      } else {
        // Offline validation - check local cache
        result = await validateOffline(code);
      }

      // Update ticket status
      setScannedTickets(prev => prev.map(ticket => 
        ticket.code === code 
          ? { ...ticket, status: result.valid ? 'valid' : 'invalid', result }
          : ticket
      ));

      // Play appropriate feedback
      if (result.valid) {
        feedbackService.playSuccess();
      } else {
        feedbackService.playError();
      }

      // Store offline if needed
      if (!isOnline && result.valid) {
        await storeOfflineTicket(code, result);
      }

    } catch (error) {
      feedbackService.playError();
      setScannedTickets(prev => prev.map(ticket => 
        ticket.code === code 
          ? { ...ticket, status: 'invalid', result: { error: error instanceof Error ? error.message : 'Bilinmeyen hata' } }
          : ticket
      ));
    }
  }, [scannedTickets, isOnline]);

  const validateOffline = async (code: string) => {
    // Check in IndexedDB cache
    const cachedData = await getFromCache(`ticket_${code}`);
    if (cachedData) {
      return cachedData;
    }
    
    // Return basic validation for offline mode
    return {
      valid: true, // Assume valid for offline, will sync later
      offlineMode: true,
      eventTitle: "Etkinlik (Çevrimdışı)",
      buyerName: "Çevrimdışı Doğrulama"
    };
  };

  const storeOfflineTicket = async (code: string, result: any) => {
    const offlineData = {
      code,
      result,
      timestamp: new Date().toISOString(),
      synced: false
    };
    
    // Store in IndexedDB
    await setInCache(`offline_ticket_${code}`, offlineData);
    await addToSyncQueue(offlineData);
  };

  const removeFromList = (code: string) => {
    setScannedTickets(prev => prev.filter(ticket => ticket.code !== code));
  };

  const clearAll = () => {
    setScannedTickets([]);
  };

  const handleBatchComplete = async () => {
    setIsProcessing(true);
    
    try {
      // Sync offline tickets if online
      if (isOnline) {
        await syncOfflineTickets();
      }
      
      onBatchComplete?.(scannedTickets);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = scannedTickets.filter(t => t.status === 'valid').length;
  const invalidCount = scannedTickets.filter(t => t.status === 'invalid').length;
  const duplicateCount = scannedTickets.filter(t => t.status === 'duplicate').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Çoklu Bilet Tarama</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {isOnline ? (
                  <>
                    <Wifi className="h-4 w-4" />
                    Çevrimiçi
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4" />
                    Çevrimdışı
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Toggle */}
        <div className="p-6 border-b">
          <button
            onClick={() => setShowScanner(!showScanner)}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              showScanner 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
            }`}
          >
            <Camera className="h-5 w-5" />
            {showScanner ? 'Taramayı Durdur' : 'Kamera ile Tara'}
          </button>
        </div>

        {/* QR Scanner */}
        {showScanner && (
          <div className="border-b">
            <QRScanner
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        )}

        {/* Stats */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{scannedTickets.length}</div>
              <div className="text-xs text-gray-500">Toplam</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{validCount}</div>
              <div className="text-xs text-gray-500">Geçerli</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{invalidCount}</div>
              <div className="text-xs text-gray-500">Geçersiz</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">{duplicateCount}</div>
              <div className="text-xs text-gray-500">Mükerrer</div>
            </div>
          </div>
        </div>

        {/* Scanned Tickets List */}
        <div className="flex-1 overflow-y-auto p-6">
          {scannedTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Henüz bilet taranmadı</p>
              <p className="text-sm">Kamerayı açıp biletleri tarayın</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scannedTickets.map((ticket) => (
                <div
                  key={ticket.code}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    ticket.status === 'valid' ? 'bg-green-50 border-green-200' :
                    ticket.status === 'invalid' ? 'bg-red-50 border-red-200' :
                    ticket.status === 'duplicate' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {ticket.status === 'valid' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {ticket.status === 'invalid' && <AlertCircle className="h-5 w-5 text-red-600" />}
                    {ticket.status === 'duplicate' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                    {ticket.status === 'pending' && <div className="h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
                    
                    <div>
                      <div className="font-mono font-medium">{ticket.code}</div>
                      <div className="text-xs text-gray-500">
                        {ticket.timestamp.toLocaleTimeString('tr-TR')}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeFromList(ticket.code)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={clearAll}
              disabled={scannedTickets.length === 0}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Temizle
            </button>
            <button
              onClick={handleBatchComplete}
              disabled={scannedTickets.length === 0 || isProcessing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'İşleniyor...' : 'Grup Girişini Tamamla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// IndexedDB utility functions
async function getFromCache(key: string) {
  return new Promise((resolve) => {
    const request = indexedDB.open('BiletEkosistemiDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => resolve(getRequest.result?.value);
      getRequest.onerror = () => resolve(null);
    };
    
    request.onerror = () => resolve(null);
  });
}

async function setInCache(key: string, value: any) {
  return new Promise((resolve) => {
    const request = indexedDB.open('BiletEkosistemiDB', 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue');
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.put({ key, value }, key);
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    };
    
    request.onerror = () => resolve(false);
  });
}

async function addToSyncQueue(data: any) {
  return new Promise((resolve) => {
    const request = indexedDB.open('BiletEkosistemiDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      store.add(data, `sync_${Date.now()}_${data.code}`);
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    };
    
    request.onerror = () => resolve(false);
  });
}

async function syncOfflineTickets() {
  // Implementation for syncing offline tickets when online
  console.log('Syncing offline tickets...');
}
