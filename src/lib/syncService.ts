// Sync service for offline ticket validation and synchronization

import { offlineStorage, type OfflineTicket, type SyncQueueItem } from './offlineStorage';

interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
}

class SyncService {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Monitor online status
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Start periodic sync when online
    this.startPeriodicSync();
  }

  private handleOnline() {
    this.isOnline = true;
    console.log('Connection restored - starting sync');
    this.syncAll();
  }

  private handleOffline() {
    this.isOnline = false;
    console.log('Connection lost - offline mode');
  }

  private startPeriodicSync() {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncAll();
      }
    }, 30000);
  }

  private stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncAll(): Promise<SyncResult> {
    if (!this.isOnline || this.syncInProgress) {
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        errors: ['Offline or sync already in progress']
      };
    }

    this.syncInProgress = true;
    
    try {
      const result: SyncResult = {
        success: true,
        syncedItems: 0,
        failedItems: 0,
        errors: []
      };

      // Get all unsynced tickets
      const unsyncedTickets = await offlineStorage.getUnsyncedTickets();
      
      // Get sync queue items
      const syncQueue = await offlineStorage.getSyncQueue();

      // Process unsynced tickets
      for (const ticket of unsyncedTickets) {
        try {
          const success = await this.syncTicket(ticket);
          if (success) {
            await offlineStorage.markTicketSynced(ticket.code);
            result.syncedItems++;
          } else {
            result.failedItems++;
            result.errors.push(`Failed to sync ticket: ${ticket.code}`);
          }
        } catch (error) {
          result.failedItems++;
          result.errors.push(`Error syncing ticket ${ticket.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Process sync queue items
      for (const item of syncQueue) {
        try {
          const success = await this.processSyncQueueItem(item);
          if (success) {
            await offlineStorage.removeFromSyncQueue(item.id);
            result.syncedItems++;
          } else {
            await offlineStorage.incrementRetryCount(item.id);
            result.failedItems++;
            
            // Remove items that have failed too many times
            if (item.retryCount >= 3) {
              await offlineStorage.removeFromSyncQueue(item.id);
              result.errors.push(`Removed queue item after 3 failures: ${item.id}`);
            }
          }
        } catch (error) {
          result.failedItems++;
          result.errors.push(`Error processing queue item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncTicket(ticket: OfflineTicket): Promise<boolean> {
    try {
      // Send ticket validation to server
      const formData = new FormData();
      formData.append('ticket_code', ticket.code);
      
      const response = await fetch('/api/check-ticket', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      
      // Update local ticket with server result
      const updatedTicket: OfflineTicket = {
        ...ticket,
        result,
        synced: true
      };
      
      await offlineStorage.storeTicket(updatedTicket);
      
      return true;
    } catch (error) {
      console.error('Error syncing ticket:', error);
      return false;
    }
  }

  private async processSyncQueueItem(item: SyncQueueItem): Promise<boolean> {
    try {
      switch (item.type) {
        case 'ticket_validation':
          return await this.processTicketValidation(item.data);
        case 'ticket_checkin':
          return await this.processTicketCheckin(item.data);
        default:
          console.warn('Unknown sync item type:', item.type);
          return false;
      }
    } catch (error) {
      console.error('Error processing sync queue item:', error);
      return false;
    }
  }

  private async processTicketValidation(data: any): Promise<boolean> {
    try {
      const response = await fetch('/api/check-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      return response.ok;
    } catch (error) {
      console.error('Error processing ticket validation:', error);
      return false;
    }
  }

  private async processTicketCheckin(data: any): Promise<boolean> {
    try {
      const response = await fetch('/api/checkin-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      return response.ok;
    } catch (error) {
      console.error('Error processing ticket checkin:', error);
      return false;
    }
  }

  async addTicketToSyncQueue(ticketCode: string, result: any): Promise<boolean> {
    const syncItem = {
      type: 'ticket_validation' as const,
      data: {
        ticket_code: ticketCode,
        result,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return await offlineStorage.addToSyncQueue(syncItem);
  }

  async addCheckinToSyncQueue(ticketCode: string, eventData: any): Promise<boolean> {
    const syncItem = {
      type: 'ticket_checkin' as const,
      data: {
        ticket_code: ticketCode,
        event_data: eventData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return await offlineStorage.addToSyncQueue(syncItem);
  }

  async getSyncStatus(): Promise<{
    isOnline: boolean;
    syncInProgress: boolean;
    unsyncedTickets: number;
    syncQueueItems: number;
    lastSyncTime?: string;
  }> {
    const stats = await offlineStorage.getStorageStats();
    const lastSyncTime = await offlineStorage.getSetting('lastSyncTime');

    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      unsyncedTickets: stats.unsyncedTickets,
      syncQueueItems: stats.syncQueueItems,
      lastSyncTime: lastSyncTime || undefined
    };
  }

  async forceSyncNow(): Promise<SyncResult> {
    const result = await this.syncAll();
    
    if (result.success) {
      await offlineStorage.setSetting('lastSyncTime', new Date().toISOString());
    }
    
    return result;
  }

  async clearOfflineData(): Promise<boolean> {
    return await offlineStorage.clearAllData();
  }

  destroy() {
    this.stopPeriodicSync();
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }
}

export const syncService = new SyncService();
export type { SyncResult };
