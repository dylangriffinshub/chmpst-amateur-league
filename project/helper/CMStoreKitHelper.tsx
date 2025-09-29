import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { CHMPSTIAPModule } = NativeModules;

interface Product {
  productId: string;
  displayName: string;
  description: string;
  price: string;
  priceLocale: string;
  subscription: boolean;
}

interface PurchaseResult {
  success: boolean;
  productId: string;
  transactionId: string;
}

interface SubscriptionStatus {
  productId: string;
  isActive: boolean;
  expirationDate: number | null;
}

interface RestoreResult {
  success: boolean;
  restoredProducts: Array<{
    productId: string;
    transactionId: string;
    purchaseDate: number;
  }>;
}

class CMStoreKitHelper {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'ios' && CHMPSTIAPModule) {
      this.eventEmitter = new NativeEventEmitter(CHMPSTIAPModule);
    }
  }

  /**
   * Check if IAP is available (iOS only)
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && CHMPSTIAPModule != null;
        }

  /**
   * Load products from App Store
   * @param productIds Array of product IDs to load
   * @returns Promise with array of product information
   */
  async loadProducts(productIds: string[]): Promise<Product[]> {
    if (!this.isAvailable()) {
      throw new Error('IAP is only available on iOS');
  }

  try {
      console.log('[CMStoreKitHelper] Loading products:', productIds);
      console.log('[CMStoreKitHelper] Module available:', CHMPSTIAPModule);
      const products = await CHMPSTIAPModule.loadProducts(productIds);
      console.log('[CMStoreKitHelper] Products received:', products);
    return products;
  } catch (error: any) {
      console.error('[CMStoreKitHelper] Error loading products:', error);
      console.error('[CMStoreKitHelper] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
  }
  }

/**
   * Purchase a product
   * @param productId Product ID to purchase
 * @returns Promise with purchase result
 */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!this.isAvailable()) {
      throw new Error('IAP is only available on iOS');
  }

  try {
      const result = await CHMPSTIAPModule.purchaseProduct(productId);
      return result;
    } catch (error: any) {
      console.error('Error purchasing product:', error);
      throw error;
    }
  }

  /**
   * Restore previous purchases
   * @returns Promise with restored products
   */
  async restorePurchases(): Promise<RestoreResult> {
    if (!this.isAvailable()) {
      throw new Error('IAP is only available on iOS');
    }

    try {
      const result = await CHMPSTIAPModule.restorePurchases();
      return result;
  } catch (error: any) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
    }

  /**
   * Get subscription status for a product
   * @param productId Product ID to check
   * @returns Promise with subscription status
   */
  async getSubscriptionStatus(productId: string): Promise<SubscriptionStatus> {
    if (!this.isAvailable()) {
      throw new Error('IAP is only available on iOS');
  }

  try {
      const status = await CHMPSTIAPModule.getSubscriptionStatus(productId);
      return status;
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
    }

  /**
   * Add listener for purchase updates
   * @param callback Callback function to handle purchase updates
   * @returns Subscription object with remove() method
   */
  addPurchaseUpdateListener(callback: (data: any) => void) {
    if (!this.eventEmitter) {
      return { remove: () => {} };
    }

    const subscription = this.eventEmitter.addListener('iap-purchase-updated', callback);
    return subscription;
  }

  /**
   * Add listener for IAP errors
   * @param callback Callback function to handle errors
   * @returns Subscription object with remove() method
   */
  addErrorListener(callback: (error: any) => void) {
    if (!this.eventEmitter) {
      return { remove: () => {} };
    }

    const subscription = this.eventEmitter.addListener('iap-error', callback);
    return subscription;
  }
}

export default new CMStoreKitHelper();
