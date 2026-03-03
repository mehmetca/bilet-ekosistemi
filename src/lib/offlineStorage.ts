// Offline storage utility for ticket validation and sync

interface OfflineTicket {
  code: string;
  result: any;
  timestamp: string;
  synced: boolean;
}

interface SyncQueueItem {
  id: string;
  type: 'ticket_validation' | 'ticket_checkin';
  data: any;
  timestamp: string;
  retryCount: number;
}

class OfflineStorage {
  private dbName = 'BiletEkosistemiDB';
  private version = 1;

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('tickets')) {
          const ticketStore = db.createObjectStore('tickets', { keyPath: 'code' });
          ticketStore.createIndex('timestamp', 'timestamp', { unique: false });
          ticketStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('eventId', 'eventId', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async storeTicket(ticket: OfflineTicket): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['tickets'], 'readwrite');
      const store = transaction.objectStore('tickets');
      
      store.put(ticket);
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Error storing ticket:', error);
      return false;
    }
  }

  async getTicket(code: string): Promise<OfflineTicket | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['tickets'], 'readonly');
      const store = transaction.objectStore('tickets');
      
      return new Promise((resolve, reject) => {
        const request = store.get(code);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting ticket:', error);
      return null;
    }
  }

  async getAllTickets(): Promise<OfflineTicket[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['tickets'], 'readonly');
      const store = transaction.objectStore('tickets');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all tickets:', error);
      return [];
    }
  }

  async getUnsyncedTickets(): Promise<OfflineTicket[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['tickets'], 'readonly');
      const store = transaction.objectStore('tickets');
      const index = store.index('synced');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(false));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting unsynced tickets:', error);
      return [];
    }
  }

  async markTicketSynced(code: string): Promise<boolean> {
    try {
      const ticket = await this.getTicket(code);
      if (ticket) {
        ticket.synced = true;
        return await this.storeTicket(ticket);
      }
      return false;
    } catch (error) {
      console.error('Error marking ticket as synced:', error);
      return false;
    }
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'retryCount'>): Promise<boolean> {
    try {
      const syncItem: SyncQueueItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        retryCount: 0
      };

      const db = await this.initDB();
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      store.put(syncItem);
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      return false;
    }
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async removeFromSyncQueue(id: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      store.delete(id);
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Error removing from sync queue:', error);
      return false;
    }
  }

  async incrementRetryCount(id: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const item = request.result;
          if (item) {
            item.retryCount += 1;
            const updateRequest = store.put(item);
            updateRequest.onsuccess = () => resolve(true);
            updateRequest.onerror = () => reject(updateRequest.error);
          } else {
            resolve(false);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error incrementing retry count:', error);
      return false;
    }
  }

  async storeEventData(eventId: string, data: any): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      
      store.put({ id: eventId, eventId, data, cachedAt: new Date().toISOString() });
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Error storing event data:', error);
      return false;
    }
  }

  async getEventData(eventId: string): Promise<any | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      
      return new Promise((resolve, reject) => {
        const request = store.get(eventId);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting event data:', error);
      return null;
    }
  }

  async setSetting(key: string, value: any): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      store.put({ key, value });
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Error setting setting:', error);
      return false;
    }
  }

  async getSetting(key: string): Promise<any | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      const db = await this.initDB();
      const stores = ['tickets', 'syncQueue', 'events', 'settings'];
      
      for (const storeName of stores) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        await store.clear();
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }

  async getStorageStats(): Promise<{
    tickets: number;
    unsyncedTickets: number;
    syncQueueItems: number;
    cachedEvents: number;
  }> {
    try {
      const [tickets, unsyncedTickets, syncQueue] = await Promise.all([
        this.getAllTickets(),
        this.getUnsyncedTickets(),
        this.getSyncQueue()
      ]);

      return {
        tickets: tickets.length,
        unsyncedTickets: unsyncedTickets.length,
        syncQueueItems: syncQueue.length,
        cachedEvents: tickets.filter(t => t.result?.eventTitle).length
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        tickets: 0,
        unsyncedTickets: 0,
        syncQueueItems: 0,
        cachedEvents: 0
      };
    }
  }
}

export const offlineStorage = new OfflineStorage();
export type { OfflineTicket, SyncQueueItem };
