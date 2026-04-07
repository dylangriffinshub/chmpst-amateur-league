import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMRipple from '../components/CMRipple';
import CMGlobal from '../CMGlobal';
import CMStoreKitHelper from '../helper/CMStoreKitHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import { getAuth } from '@react-native-firebase/auth';
import { TIER_FEATURES } from '../helper/CMSubscriptionHelper';
import { Timestamp } from '@react-native-firebase/firestore';

type BillingCycle = 'monthly' | 'annual';

type StoreProduct = {
  productId: string;
  displayName: string;
  description: string;
  price: string;
  priceLocale: string;
  subscription: boolean;
};

type PlanId = 'core' | 'pro' | 'elite';
type SubscriptionTierId = 'tier1' | 'tier2' | 'tier4';

type PlanCard = {
  id: PlanId;
  subscriptionTierId: SubscriptionTierId;
  tag: string;
  title: string;
  accent: string;
  glow: string;
  features: string[];
};

const plans: PlanCard[] = [
  {
    id: 'core',
    subscriptionTierId: 'tier1',
    tag: 'Most Popular',
    title: 'Core',
    accent: '#7CFF5B',
    glow: 'rgba(124,255,91,0.22)',
    features: [
      'Scheduling & standings',
      'Team & roster management',
      'Basic stats',
      'Email support',
    ],
  },
  {
    id: 'pro',
    subscriptionTierId: 'tier2',
    tag: 'For Growing Leagues',
    title: 'Pro',
    accent: '#45B4FF',
    glow: 'rgba(69,180,255,0.2)',
    features: [
      'Everything in Core',
      'Advanced player stats',
      'AI game recaps',
      'Automated playoff seeding',
      'Priority support',
    ],
  },
  {
    id: 'elite',
    subscriptionTierId: 'tier4',
    tag: 'National Network Access',
    title: 'Elite',
    accent: '#FFC247',
    glow: 'rgba(255,194,71,0.2)',
    features: [
      'Everything in Pro',
      'Official league network membership',
      'Championship qualification pathway',
      'Early access to features',
    ],
  },
];

const CMPaywallScreen = ({ navigation }: CMNavigationProps) => {
  const isAdmin = CMGlobal.user?.role === 'admin';
  const paywallStage = CMConstants.featureFlags?.paywallStage || 'selection_only';
  const isSelectionOnlyStage = paywallStage === 'selection_only';
  const privacyPolicyUrl = CMConstants.legal?.privacyPolicyUrl;
  const termsOfUseUrl = CMConstants.legal?.termsOfUseUrl;
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [products, setProducts] = useState<Record<string, StoreProduct>>({});
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;

  const planLabel = useMemo(
    () => (billingCycle === 'annual' ? '/year' : '/month'),
    [billingCycle]
  );

  const allProductIds = useMemo(
    () => Object.values(CMConstants.storeKit.productIds).flatMap((productSet) => [productSet.monthly, productSet.annual]),
    []
  );

  useEffect(() => {
    if (isAdmin) {
      navigation.replace(CMConstants.screenName.editLeague, {
        isEdit: false,
      });
      return;
    }

    const loadProducts = async () => {
      if (isSelectionOnlyStage) {
        return;
      }

      if (!CMStoreKitHelper.isAvailable()) {
        return;
      }

      setLoadingProducts(true);
      try {
        const loadedProducts = await CMStoreKitHelper.loadProducts(allProductIds);
        const byId = loadedProducts.reduce<Record<string, StoreProduct>>((acc, product) => {
          acc[product.productId] = product;
          return acc;
        }, {});
        setProducts(byId);
      } catch (error: any) {
        CMAlertDlgHelper.showAlertWithOK(error?.message || 'Failed to load subscription plans from the App Store.');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, [allProductIds, isAdmin, isSelectionOnlyStage, navigation]);

  const getProductIdForPlan = (plan: PlanCard) => {
    return billingCycle === 'annual'
      ? CMConstants.storeKit.productIds[plan.id].annual
      : CMConstants.storeKit.productIds[plan.id].monthly;
  };

  const saveSubscription = async (plan: PlanCard, transactionId: string) => {
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    if (!currentUserId) {
      throw new Error('No authenticated user found.');
    }

    const durationDays = billingCycle === 'annual' ? 365 : 30;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);

    const maxTeams = TIER_FEATURES[plan.subscriptionTierId]?.maxTeams || 4;

    await new Promise<void>((resolve, reject) => {
      CMFirebaseHelper.addSubscriptionToUser(currentUserId, {
        subscriptionTier: plan.subscriptionTierId,
        subscriptionId: transactionId,
        paymentToken: transactionId,
        maxTeams,
        pay_date: Timestamp.fromDate(new Date()),
        expiration_date: Timestamp.fromDate(expirationDate),
      }, (response: any) => {
        if (response.isSuccess) {
          resolve();
        } else {
          reject(new Error(response.value || 'Failed to save subscription.'));
        }
      });
    });

    CMGlobal.user = {
      ...CMGlobal.user,
      paid: true,
      subscriptionTier: plan.subscriptionTierId,
      subscriptionId: transactionId,
      paymentToken: transactionId,
      maxTeams,
      pay_date: new Date(),
      expiration_date: expirationDate,
    };
  };

  const savePlanSelectionOnly = async (plan: PlanCard) => {
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    if (!currentUserId) {
      throw new Error('No authenticated user found.');
    }

    const maxTeams = TIER_FEATURES[plan.subscriptionTierId]?.maxTeams || 4;
    const now = new Date();

    await new Promise<void>((resolve, reject) => {
      CMFirebaseHelper.updateUser(
        currentUserId,
        {
          subscriptionTier: plan.subscriptionTierId,
          selectedPlanId: plan.id,
          selectedBillingCycle: billingCycle,
          subscriptionPendingApproval: true,
          pendingPaymentPlatform: 'apple',
          maxTeams,
          paid: false,
          updatedAt: Timestamp.fromDate(now),
        },
        (response: any) => {
          if (response?.isSuccess) {
            resolve();
          } else {
            reject(new Error(response?.value || 'Failed to save selected plan.'));
          }
        },
      );
    });

    CMGlobal.user = {
      ...CMGlobal.user,
      subscriptionTier: plan.subscriptionTierId,
      selectedPlanId: plan.id,
      selectedBillingCycle: billingCycle,
      subscriptionPendingApproval: true,
      pendingPaymentPlatform: 'apple',
      maxTeams,
      paid: false,
      updatedAt: now,
    };
  };

  const handleSelectPlan = async (plan: PlanCard) => {
    setSelectedPlanId(plan.id);

    if (isSelectionOnlyStage) {
      setProcessingPlanId(plan.id);
      try {
        await savePlanSelectionOnly(plan);
        CMAlertDlgHelper.showAlertWithOK('Plan selected. You can continue without payment for now. Apple subscription can be applied later.', () => {
          navigation.replace(CMConstants.screenName.editLeague, {
            isEdit: false,
          });
        });
      } catch (error: any) {
        CMAlertDlgHelper.showAlertWithOK(error?.message || 'Failed to save selected plan.');
      } finally {
        setProcessingPlanId(null);
      }
      return;
    }

    if (Platform.OS !== 'ios' || !CMStoreKitHelper.isAvailable()) {
      CMAlertDlgHelper.showAlertWithOK('In-app purchases are available only on iOS real devices with StoreKit configured.');
      return;
    }

    const productId = getProductIdForPlan(plan);
    if (!productId) {
      CMAlertDlgHelper.showAlertWithOK('This plan is not mapped to an App Store product yet.');
      return;
    }

    const product = products[productId];
    if (!product) {
      CMAlertDlgHelper.showAlertWithOK('This App Store product is not loaded yet. Please try again after products finish loading from Apple.');
      return;
    }

    setProcessingPlanId(plan.id);
    try {
      const purchase = await CMStoreKitHelper.purchaseProduct(productId);
      if (!purchase.success) {
        throw new Error('Purchase did not complete.');
      }

      await saveSubscription(plan, purchase.transactionId);

      CMAlertDlgHelper.showAlertWithOK('Subscription activated. You can now create your league.', () => {
        navigation.replace(CMConstants.screenName.editLeague, {
          isEdit: false,
        });
      });
    } catch (error: any) {
      const errorCode = error?.code || '';
      if (errorCode === 'USER_CANCELLED') {
        return;
      }
      CMAlertDlgHelper.showAlertWithOK(error?.message || 'Purchase failed. Please try again.');
    } finally {
      setProcessingPlanId(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS !== 'ios' || !CMStoreKitHelper.isAvailable()) {
      CMAlertDlgHelper.showAlertWithOK('Restore purchases is available only on iOS.');
      return;
    }

    setRestoring(true);
    try {
      const result = await CMStoreKitHelper.restorePurchases();
      if (!result.success || result.restoredProducts.length === 0) {
        CMAlertDlgHelper.showAlertWithOK('No previous subscriptions were restored.');
        return;
      }

      const restoredProduct = [...result.restoredProducts]
        .sort((a, b) => (b.purchaseDate || 0) - (a.purchaseDate || 0))
        .find((item) =>
          plans.some((plan) => {
            const productIds = CMConstants.storeKit.productIds[plan.id];
            return item.productId === productIds.monthly || item.productId === productIds.annual;
          }),
        );
      if (!restoredProduct) {
        CMAlertDlgHelper.showAlertWithOK('A purchase was restored, but it does not match a configured league plan.');
        return;
      }

      const restoredPlan = plans.find((plan) => {
        const productIds = CMConstants.storeKit.productIds[plan.id];
        return restoredProduct.productId === productIds.monthly || restoredProduct.productId === productIds.annual;
      });
      if (!restoredPlan) {
        CMAlertDlgHelper.showAlertWithOK('A purchase was restored, but it does not match a configured league plan.');
        return;
      }

      await saveSubscription(restoredPlan, restoredProduct.transactionId);
      CMAlertDlgHelper.showAlertWithOK('Purchase restored. You can now create your league.', () => {
        navigation.replace(CMConstants.screenName.editLeague, {
          isEdit: false,
        });
      });
    } catch (error: any) {
      CMAlertDlgHelper.showAlertWithOK(error?.message || 'Failed to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const openExternalUrl = async (url?: string) => {
    if (!url) {
      CMAlertDlgHelper.showAlertWithOK('This link is not configured yet.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        CMAlertDlgHelper.showAlertWithOK('Unable to open this link on the device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error: any) {
      CMAlertDlgHelper.showAlertWithOK(error?.message || 'Unable to open this link right now.');
    }
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), styles.safeArea]}>
      <ImageBackground
        source={require('../../assets/images/homeBG1.png')}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />

          <Text style={styles.title}>Choose Your League Plan</Text>
          <Text style={styles.subtitle}>
            {isSelectionOnlyStage
              ? 'Choose a plan now and continue without payment. Apple subscription can be finalized later.'
              : 'Built for competitive basketball leagues'}
          </Text>

          <View style={styles.billingToggle}>
            <TouchableOpacity
              style={[
                styles.billingButton,
                billingCycle === 'monthly' && styles.billingButtonActive,
              ]}
              onPress={() => setBillingCycle('monthly')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.billingButtonText,
                  { color: billingCycle === 'monthly' ? CMConstants.color.green : CMConstants.color.white },
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingButton,
                billingCycle === 'annual' && styles.billingButtonActive,
              ]}
              onPress={() => setBillingCycle('annual')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.billingButtonText,
                  { color: billingCycle === 'annual' ? CMConstants.color.green : CMConstants.color.white },
                ]}
              >
                Annual
              </Text>
            </TouchableOpacity>
          </View>

          {loadingProducts ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={CMConstants.color.green} />
              <Text style={styles.statusText}>Loading App Store plans...</Text>
            </View>
          ) : null}

          <View style={styles.cardsContainer}>
            {plans.map((plan) => {
              const productId = getProductIdForPlan(plan);
              const product = productId ? products[productId] : undefined;
              const currentPrice = product?.price || null;
              const isSelected = selectedPlanId === plan.id;
              const isProcessing = processingPlanId === plan.id;
              const isProductReady = isSelectionOnlyStage || !!product;

              return (
                <View
                  key={plan.id}
                  style={[
                    styles.planCard,
                    {
                      borderColor: plan.accent,
                      shadowColor: plan.accent,
                      backgroundColor: plan.glow,
                    },
                    isSelected && styles.planCardSelected,
                  ]}
                >
                  <View style={[styles.planTag, { backgroundColor: plan.accent }]}>
                    <Text style={styles.planTagText}>{plan.tag}</Text>
                  </View>

                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: plan.accent }]}>
                      {isSelectionOnlyStage ? 'Select Plan' : (loadingProducts ? 'Loading...' : (currentPrice || 'Unavailable'))}
                    </Text>
                    {!isSelectionOnlyStage && currentPrice ? <Text style={styles.priceSuffix}>{planLabel}</Text> : null}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.features}>
                    {plan.features.map((feature) => (
                      <Text key={feature} style={styles.featureText}>
                        {'\u2713'} {feature}
                      </Text>
                    ))}
                  </View>

                  <CMRipple
                    containerStyle={[
                      styles.selectButton,
                      {
                        borderColor: plan.accent,
                        backgroundColor: isSelected ? plan.glow : 'rgba(255,255,255,0.04)',
                        opacity: loadingProducts || restoring || !isProductReady ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => {
                      if (loadingProducts || restoring || !!processingPlanId) return;
                      handleSelectPlan(plan);
                    }}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color={plan.accent} />
                    ) : (
                      <Text style={[styles.selectButtonText, { color: plan.accent }]}>
                        {isSelectionOnlyStage
                          ? `Choose ${plan.title}`
                          : isProductReady
                            ? `Buy ${plan.title}`
                            : 'Not Available'}
                      </Text>
                    )}
                  </CMRipple>
                </View>
              );
            })}
          </View>

          <Text style={styles.footerText}>
            {isSelectionOnlyStage ? 'Plan selection only for now | Payment on hold' : 'Easy pricing | No hidden fees'}
          </Text>

          <View style={styles.legalBlock}>
            <Text style={styles.legalText}>
              Auto-renewable subscription. Payment will be charged to your Apple ID account at confirmation of purchase and will renew unless canceled at least 24 hours before the end of the current period.
            </Text>
            <View style={styles.legalLinksRow}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => openExternalUrl(termsOfUseUrl)}>
                <Text style={styles.legalLink}>Terms of Use</Text>
              </TouchableOpacity>
              <Text style={styles.legalDivider}>|</Text>
              <TouchableOpacity activeOpacity={0.85} onPress={() => openExternalUrl(privacyPolicyUrl)}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isSelectionOnlyStage && (
            <CMRipple
              containerStyle={[styles.restoreButton, restoring && styles.restoreButtonDisabled]}
              onPress={() => {
                if (restoring || !!processingPlanId) return;
                handleRestorePurchases();
              }}
            >
              {restoring ? (
                <ActivityIndicator color={CMConstants.color.white} />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              )}
            </CMRipple>
          )}

          <CMRipple
            containerStyle={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </CMRipple>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#050505',
  },
  background: {
    flex: 1,
    backgroundColor: '#050505',
  },
  backgroundImage: {
    resizeMode: 'cover',
    opacity: 0.28,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,5,0.9)',
  },
  content: {
    paddingHorizontal: CMConstants.space.small,
    paddingTop: CMConstants.space.small,
    paddingBottom: CMConstants.space.large,
  },
  logo: {
    width: 160,
    height: 54,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: CMConstants.space.small,
  },
  title: {
    color: CMConstants.color.white,
    fontSize: 34,
    fontFamily: CMConstants.font.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#B9B9B9',
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.regular,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: CMConstants.space.small,
  },
  billingToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: 248,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 4,
    marginBottom: CMConstants.space.normal,
  },
  billingButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  billingButtonActive: {
    backgroundColor: 'rgba(0,255,136,0.18)',
    borderWidth: 1,
    borderColor: CMConstants.color.green,
  },
  billingButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  billingButtonTextActive: {
    color: CMConstants.color.green,
  },
  cardsContainer: {
    gap: CMConstants.space.smallEx + 4,
  },
  planCard: {
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  planCardSelected: {
    transform: [{ scale: 1.01 }],
  },
  planTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  planTagText: {
    color: '#111111',
    fontSize: 11,
    fontFamily: CMConstants.font.bold,
    textTransform: 'uppercase',
  },
  planTitle: {
    color: CMConstants.color.white,
    fontSize: 38,
    fontFamily: CMConstants.font.bold,
    textTransform: 'uppercase',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  price: {
    fontSize: 28,
    fontFamily: CMConstants.font.bold,
  },
  priceSuffix: {
    color: '#D1D1D1',
    fontSize: CMConstants.fontSize.medium,
    fontFamily: CMConstants.font.regular,
    marginLeft: 4,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 14,
  },
  features: {
    gap: 9,
  },
  featureText: {
    color: '#F0F0F0',
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
    lineHeight: 20,
  },
  selectButton: {
    marginTop: 18,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  selectButtonText: {
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: CMConstants.space.small,
  },
  statusText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
    marginLeft: CMConstants.space.smallEx,
  },
  noticeText: {
    color: '#FFD27A',
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
    textAlign: 'center',
    marginTop: -CMConstants.space.smallEx,
    marginBottom: CMConstants.space.small,
    lineHeight: 18,
  },
  footerText: {
    color: '#B3B3B3',
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.regular,
    textAlign: 'center',
    marginTop: CMConstants.space.normal,
    marginBottom: CMConstants.space.small,
  },
  legalBlock: {
    marginTop: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.small,
    paddingHorizontal: 8,
  },
  legalText: {
    color: '#A7A7A7',
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  legalLink: {
    color: CMConstants.color.green,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: '#7E7E7E',
    marginHorizontal: 10,
    fontSize: CMConstants.fontSize.small,
  },
  mathButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(124,255,91,0.12)',
    borderWidth: 2,
    borderColor: '#7CFF5B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7CFF5B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  mathButtonText: {
    color: '#B8FF93',
    fontSize: 30,
    fontFamily: CMConstants.font.bold,
    textTransform: 'uppercase',
  },
  restoreButton: {
    marginTop: CMConstants.space.small,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.semiBold,
    textTransform: 'uppercase',
  },
  backButton: {
    alignSelf: 'center',
    marginTop: CMConstants.space.normal,
    paddingHorizontal: CMConstants.space.normal,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#D8D8D8',
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.semiBold,
  },
});

export default CMPaywallScreen;
