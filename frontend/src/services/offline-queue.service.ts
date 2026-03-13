/**
 * Offline Queue Service
 * Manages queuing of failed requests for later retry when back online
 */

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'fieldvibe_offline_queue';
const MAX_RETRIES = 3;

class OfflineQueueService {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.queue.length} queued requests from storage`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Add a request to the queue
   */
  addToQueue(url: string, method: string, data: any): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: QueuedRequest = {
      id,
      url,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(request);
    this.saveQueue();
    
    console.log(`📥 Added request to offline queue: ${method} ${url}`);
    return id;
  }

  /**
   * Get all queued requests
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Get queue count
   */
  getQueueCount(): number {
    return this.queue.length;
  }

  /**
   * Remove a request from the queue
   */
  removeFromQueue(id: string): void {
    this.queue = this.queue.filter(req => req.id !== id);
    this.saveQueue();
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    console.log('🗑️ Cleared offline queue');
  }

  /**
   * Process the queue (retry all pending requests)
   */
  async processQueue(apiClient: any): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing ${this.queue.length} queued requests...`);

    const requests = [...this.queue];
    
    for (const request of requests) {
      try {
        console.log(`⏳ Retrying: ${request.method} ${request.url}`);
        
        await apiClient[request.method.toLowerCase()](request.url, request.data);
        
        this.removeFromQueue(request.id);
        console.log(`✅ Successfully processed: ${request.method} ${request.url}`);
        
      } catch (error) {
        console.error(`❌ Failed to process: ${request.method} ${request.url}`, error);
        
        const queuedRequest = this.queue.find(r => r.id === request.id);
        if (queuedRequest) {
          queuedRequest.retryCount++;
          
          if (queuedRequest.retryCount >= MAX_RETRIES) {
            console.warn(`⚠️ Max retries reached for: ${request.method} ${request.url}`);
            this.removeFromQueue(request.id);
          } else {
            this.saveQueue();
          }
        }
      }
    }

    this.isProcessing = false;
    console.log(`✅ Queue processing complete. ${this.queue.length} requests remaining.`);
  }
}

export const offlineQueueService = new OfflineQueueService();
