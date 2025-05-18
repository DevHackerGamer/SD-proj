import type { MetadataOptionsType } from '../components/managefields/ManageFieldsComponent';

type SubscriberCallback = (options: MetadataOptionsType) => void;

class MetadataService {
  private subscribers: SubscriberCallback[] = [];
  private cachedOptions: MetadataOptionsType | null = null;

  /**
   * Get metadata options from the server or cache
   * @param forceRefresh Force a refresh from the server
   */
  async getOptions(forceRefresh: boolean = false): Promise<MetadataOptionsType> {
    if (this.cachedOptions && !forceRefresh) {
      return this.cachedOptions;
    }

    try {
      console.log('[MetadataService] Fetching options from server...');
      
      // Use absolute URL to the backend server
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? '' // Empty for same-origin in production
        : 'http://localhost:5000'; // Explicit URL in development
      
      const response = await fetch(`${apiBaseUrl}/api/metadata/options`);
      
      // Log status for debugging
      console.log(`[MetadataService] Server response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch metadata options: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[MetadataService] Received data:', data);
      
      // Extract options property from the response or use the data directly
      const options = data.options || data;
      
      this.cachedOptions = options as MetadataOptionsType;
      this.notifySubscribers(this.cachedOptions);
      return this.cachedOptions;
    } catch (error) {
      console.error('[MetadataService] Error fetching metadata options:', error);
      
      // Fix default options to match MetadataOptionsType interface
      // Using empty object as base to prevent property mismatches
      const defaultOptions = {} as MetadataOptionsType;
      
      // Cache these default options to prevent further errors
      this.cachedOptions = defaultOptions;
      
      throw error;
    }
  }

  /**
   * Save metadata options to the server
   * @param options The options to save
   * @param noBackup Whether to skip creating a backup (defaults to true to prevent page reloads)
   */
  async saveOptions(options: MetadataOptionsType, noBackup: boolean = true): Promise<boolean> {
    try {
      console.log(`[MetadataService] Saving options with noBackup=${noBackup}`);
      
      // Use absolute URL to the backend server
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? '' // Empty for same-origin in production
        : 'http://localhost:5000'; // Explicit URL in development
      
      const response = await fetch(`${apiBaseUrl}/api/metadata/options?noBackup=${noBackup}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Prevent caching of this request
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save metadata options: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Update cache and notify subscribers
      this.cachedOptions = options;
      this.notifySubscribers(options);
      return true;
    } catch (error) {
      console.error('Error saving metadata options:', error);
      throw error;
    }
  }

  /**
   * Subscribe to metadata updates
   * @param callback Function to call when metadata is updated
   * @returns Unsubscribe function
   */
  subscribe(callback: SubscriberCallback): Function {
    this.subscribers.push(callback);
    
    // If we have cached options, notify the new subscriber immediately
    if (this.cachedOptions) {
      callback(this.cachedOptions);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of metadata updates
   * @param options Updated metadata options
   */
  private notifySubscribers(options: MetadataOptionsType): void {
    this.subscribers.forEach(callback => {
      try {
        callback(options);
      } catch (error) {
        console.error('Error in metadata subscriber callback:', error);
      }
    });
  }
}

// Export a singleton instance
export const metadataService = new MetadataService();
