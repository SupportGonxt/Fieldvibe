/**
 * Advanced Offline Service
 * Best-in-world offline-first architecture with conflict resolution
 */

import { offlineQueueService } from './offline-queue.service';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSync: Date | null;
  syncing: boolean;
  error: string | null;
}

interface SyncConflict {
  id: string;
  resource: string;
  resourceId: string;
  localVersion: any;
  serverVersion: any;
  timestamp: number;
  resolution: 'local' | 'server' | 'merge' | null;
}

class AdvancedOfflineService {
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSync: null,
    syncing: false,
    error: null
  };

  private conflictQueue: SyncConflict[] = [];
  private syncListeners: Set<() => void> = new Set();
  private readonly DB_NAME = 'fieldvibe_offline_v2';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize offline service
   */
  private async init() {
    // Listen to online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initialize IndexedDB
    await this.initDB();

    // Update sync status
    this.updateSyncStatus();

    // Start periodic sync check
    setInterval(() => this.checkAndSync(), 30000); // Every 30 seconds
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('cachedData')) {
          db.createObjectStore('cachedData', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
        }

        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Handle online status
   */
  private handleOnline() {
    this.syncStatus.isOnline = true;
    this.notifyListeners();
    this.sync();
  }

  /**
   * Handle offline status
   */
  private handleOffline() {
    this.syncStatus.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Check and sync if online
   */
  private async checkAndSync() {
    if (this.syncStatus.isOnline && !this.syncStatus.syncing) {
      await this.sync();
    }
  }

  /**
   * Sync pending operations
   */
  async sync(): Promise<void> {
    if (this.syncStatus.syncing || !this.syncStatus.isOnline) {
      return;
    }

    this.syncStatus.syncing = true;
    this.syncStatus.error = null;
    this.notifyListeners();

    try {
      // Get pending operations from IndexedDB
      const pendingOps = await this.getPendingOperations();

      if (pendingOps.length === 0) {
        this.syncStatus.lastSync = new Date();
        return;
      }

      // Sort by priority and timestamp
      pendingOps.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Process operations
      for (const op of pendingOps) {
        try {
          await this.executeOperation(op);
          await this.removeOperation(op.id);
        } catch (error) {
          console.error('Sync operation failed:', error);
          
          // Increment retry count
          op.retryCount = (op.retryCount || 0) + 1;
          
          if (op.retryCount >= 5) {
            // Max retries reached, mark as failed
            await this.markOperationFailed(op.id, error);
          } else {
            await this.updateOperation(op);
          }
        }
      }

      this.syncStatus.lastSync = new Date();
      this.syncStatus.pendingCount = 0;

    } catch (error) {
      this.syncStatus.error = error instanceof Error ? error.message : 'Sync failed';
      console.error('Sync error:', error);
    } finally {
      this.syncStatus.syncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Queue an operation for later sync
   */
  async queueOperation(operation: {
    type: 'create' | 'update' | 'delete';
    resource: string;
    resourceId?: string;
    data?: any;
    priority?: number;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const op = {
      id,
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
      priority: operation.priority || 1
    };

    // Store in IndexedDB
    await this.storeOperation(op);

    // Also add to localStorage queue for backwards compatibility
    if (operation.type === 'create' || operation.type === 'update') {
      offlineQueueService.addToQueue(
        `/api/v1/${operation.resource}${operation.resourceId ? `/${operation.resourceId}` : ''}`,
        operation.type === 'create' ? 'POST' : 'PUT',
        operation.data
      );
    }

    this.updateSyncStatus();

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.sync();
    }

    return id;
  }

  /**
   * Cache data for offline access
   */
  async cacheData(key: string, data: any, ttl: number = 3600000): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    const cachedItem = {
      key,
      data,
      timestamp: Date.now(),
      ttl
    };

    const transaction = this.db!.transaction(['cachedData'], 'readwrite');
    const store = transaction.objectStore('cachedData');
    
    return new Promise((resolve, reject) => {
      const request = store.put(cachedItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cached data
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.db) {
      await this.initDB();
    }

    const transaction = this.db!.transaction(['cachedData'], 'readonly');
    const store = transaction.objectStore('cachedData');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Check TTL
        if (Date.now() - result.timestamp > result.ttl) {
          // Expired, delete and return null
          this.deleteCachedData(key);
          resolve(null);
          return;
        }

        resolve(result.data as T);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete cached data
   */
  async deleteCachedData(key: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['cachedData'], 'readwrite');
    const store = transaction.objectStore('cachedData');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Handle sync conflict
   */
  async handleConflict(conflict: SyncConflict): Promise<void> {
    this.conflictQueue.push(conflict);
    
    // Store in IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['conflicts'], 'readwrite');
      const store = transaction.objectStore('conflicts');
      store.put(conflict);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge', mergedData?: any): Promise<void> {
    const conflictIndex = this.conflictQueue.findIndex(c => c.id === conflictId);
    
    if (conflictIndex === -1) {
      throw new Error('Conflict not found');
    }

    const conflict = this.conflictQueue[conflictIndex];
    conflict.resolution = resolution;

    // Apply resolution
    let resolvedData;
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localVersion;
        break;
      case 'server':
        resolvedData = conflict.serverVersion;
        break;
      case 'merge':
        resolvedData = mergedData || { ...conflict.serverVersion, ...conflict.localVersion };
        break;
    }

    // Queue update operation
    await this.queueOperation({
      type: 'update',
      resource: conflict.resource,
      resourceId: conflict.resourceId,
      data: resolvedData,
      priority: 10 // High priority
    });

    // Remove from conflict queue
    this.conflictQueue.splice(conflictIndex, 1);

    // Remove from IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['conflicts'], 'readwrite');
      const store = transaction.objectStore('conflicts');
      store.delete(conflictId);
    }

    this.notifyListeners();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Get pending conflicts
   */
  getConflicts(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: () => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus() {
    const pendingCount = await this.getPendingCount();
    this.syncStatus.pendingCount = pendingCount;
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.syncListeners.forEach(listener => listener());
  }

  /**
   * Store operation in IndexedDB
   */
  private async storeOperation(op: any): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    return new Promise((resolve, reject) => {
      const request = store.put(op);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending operations
   */
  private async getPendingOperations(): Promise<any[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending count
   */
  private async getPendingCount(): Promise<number> {
    const ops = await this.getPendingOperations();
    return ops.length;
  }

  /**
   * Remove operation
   */
  private async removeOperation(id: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update operation
   */
  private async updateOperation(op: any): Promise<void> {
    await this.storeOperation(op);
  }

  /**
   * Mark operation as failed
   */
  private async markOperationFailed(id: string, error: any): Promise<void> {
    await this.removeOperation(id);
    console.error('Operation failed permanently:', id, error);
  }

  /**
   * Execute operation
   */
  private async executeOperation(op: any): Promise<void> {
    // This would integrate with your API client
    // Implementation depends on your API structure
    console.log('Executing operation:', op);
  }
}

// Export singleton instance
export const advancedOfflineService = new AdvancedOfflineService();
