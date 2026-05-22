import Foundation
import StoreKit
import React

@objc(CHMPSTIAPModule)
class CHMPSTIAPModule: RCTEventEmitter {
    
    private var products: [Product] = []
    private var updateListenerTask: Task<Void, Error>?
    
    override init() {
        super.init()
        // Start listening for transaction updates
        updateListenerTask = listenForTransactions()
    }
    
    deinit {
        updateListenerTask?.cancel()
    }
    
    // MARK: - React Native Module Setup
    
    @objc
    static override func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override func supportedEvents() -> [String]! {
        return ["iap-purchase-updated", "iap-error"]
    }
    
    // MARK: - Public Methods
    
    @objc
    func loadProducts(_ productIds: [String], resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        print("[CHMPSTIAP] loadProducts called with productIds: \(productIds)")
        Task {
            do {
                print("[CHMPSTIAP] Requesting products from StoreKit...")
                let storeProducts = try await Product.products(for: productIds)
                print("[CHMPSTIAP] StoreKit returned \(storeProducts.count) products")
                
                if storeProducts.isEmpty {
                    print("[CHMPSTIAP] WARNING: No products returned for IDs: \(productIds)")
                    print("[CHMPSTIAP] This usually means:")
                    print("[CHMPSTIAP] 1. Testing on simulator (IAP requires real device)")
                    print("[CHMPSTIAP] 2. Products not synced yet (wait a few minutes)")
                    print("[CHMPSTIAP] 3. Not signed in with sandbox test account")
                    print("[CHMPSTIAP] 4. Product IDs don't match App Store Connect")
                }
                
                self.products = storeProducts
                
                let productData = storeProducts.map { product in
                    // Format price using the product's display price
                    let priceString = product.displayPrice
                    let localeIdentifier = Locale.current.identifier
                    
                    print("[CHMPSTIAP] Product found: \(product.id) - \(product.displayName) - \(priceString)")
                    
                    return [
                        "productId": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "price": priceString,
                        "priceLocale": localeIdentifier,
                        "subscription": product.subscription != nil,
                    ]
                }
                
                DispatchQueue.main.async {
                    print("[CHMPSTIAP] Resolving with \(productData.count) products")
                    resolver(productData)
                }
            } catch {
                print("[CHMPSTIAP] ERROR loading products: \(error)")
                print("[CHMPSTIAP] Error details: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    rejecter("LOAD_PRODUCTS_ERROR", "Failed to load products: \(error.localizedDescription)", error)
                }
            }
        }
    }
    
    @objc
    func purchaseProduct(_ productId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        Task {
            guard let product = products.first(where: { $0.id == productId }) else {
                DispatchQueue.main.async {
                    rejecter("PRODUCT_NOT_FOUND", "Product not found. Please load products first.", nil)
                }
                return
            }
            
            do {
                let result = try await product.purchase()
                
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        // Transaction is verified, complete it
                        await transaction.finish()
                        
                        DispatchQueue.main.async {
                            resolver([
                                "success": true,
                                "productId": productId,
                                "transactionId": String(transaction.id)
                            ])
                        }
                    case .unverified(_, let error):
                        DispatchQueue.main.async {
                            rejecter("VERIFICATION_FAILED", "Transaction verification failed: \(error.localizedDescription)", error)
                        }
                    }
                case .userCancelled:
                    DispatchQueue.main.async {
                        rejecter("USER_CANCELLED", "User cancelled the purchase", nil)
                    }
                case .pending:
                    DispatchQueue.main.async {
                        rejecter("PURCHASE_PENDING", "Purchase is pending approval", nil)
                    }
                @unknown default:
                    DispatchQueue.main.async {
                        rejecter("UNKNOWN_ERROR", "Unknown purchase result", nil)
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    rejecter("PURCHASE_ERROR", "Purchase failed: \(error.localizedDescription)", error)
                }
            }
        }
    }
    
    @objc
    func restorePurchases(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        Task {
            Task {
                do {
                    try await AppStore.sync()
                    
                    // Get current entitlements
                    var restoredProducts: [[String: Any]] = []
                    
                    for await result in Transaction.currentEntitlements {
                        switch result {
                        case .verified(let transaction):
                            restoredProducts.append([
                                "productId": transaction.productID,
                                "transactionId": String(transaction.id),
                                "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000
                            ])
                        case .unverified:
                            break
                        }
                    }
                    
                    DispatchQueue.main.async {
                        resolver([
                            "success": true,
                            "restoredProducts": restoredProducts
                        ])
                    }
                } catch {
                    DispatchQueue.main.async {
                        rejecter("RESTORE_ERROR", "Failed to restore purchases: \(error.localizedDescription)", error)
                    }
                }
            }
        }
    }
    
    @objc
    func getSubscriptionStatus(_ productId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        Task {
            var status: [String: Any] = [
                "productId": productId,
                "isActive": false,
                "expirationDate": NSNull()
            ]
            
            for await result in Transaction.currentEntitlements {
                switch result {
                case .verified(let transaction):
                    if transaction.productID == productId {
                        status["isActive"] = true
                        if let expirationDate = transaction.expirationDate {
                            status["expirationDate"] = expirationDate.timeIntervalSince1970 * 1000
                        }
                        break
                    }
                case .unverified:
                    break
                }
            }
            
            DispatchQueue.main.async {
                resolver(status)
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(result)
                    
                    // Send event to React Native
                    self.sendEvent(withName: "iap-purchase-updated", body: [
                        "productId": transaction.productID,
                        "transactionId": String(transaction.id),
                        "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000
                    ])
                    
                    // Finish the transaction
                    await transaction.finish()
                } catch {
                    self.sendEvent(withName: "iap-error", body: [
                        "error": error.localizedDescription
                    ])
                }
            }
        }
    }
    
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
    
    enum StoreError: Error {
        case failedVerification
    }
}
