import CMGlobal from '../CMGlobal';
import CMAlertDlgHelper from './CMAlertDlgHelper';
import CMConstants from '../CMConstants';

/**
 * Subscription tier feature definitions
 */
export const TIER_FEATURES = {
  tier1: {
    maxTeams: 4,
    hasScoreboard: false,
    hasStatSheetScanner: false,
    hasManualEntry: true,
  },
  tier2: {
    maxTeams: 9,
    hasScoreboard: true,
    hasStatSheetScanner: false,
    hasManualEntry: true,
  },
  tier3: {
    maxTeams: 13,
    hasScoreboard: true,
    hasStatSheetScanner: true,
    hasManualEntry: true,
  },
  tier4: {
    maxTeams: 20,
    hasScoreboard: true,
    hasStatSheetScanner: true,
    hasManualEntry: true,
  },
};

/**
 * Get user's subscription tier features
 * @returns Tier features object or null if no subscription
 */
export const getUserTierFeatures = () => {
  const user = CMGlobal.user;
  if (!user) {
    return null;
  }

  // Admin users get all features
  if (user.role === 'admin') {
    return {
      maxTeams: 999,
      hasScoreboard: true,
      hasStatSheetScanner: true,
      hasManualEntry: true,
    };
  }

  const subscriptionTier = user.subscriptionTier;
  if (!subscriptionTier || !TIER_FEATURES[subscriptionTier as keyof typeof TIER_FEATURES]) {
    // No subscription or invalid tier - default to tier1 features
    return TIER_FEATURES.tier1;
  }

  return TIER_FEATURES[subscriptionTier as keyof typeof TIER_FEATURES];
};

/**
 * Check if user has access to scoreboard feature
 * @returns boolean - Always true, all users can access scoreboard
 */
export const hasScoreboardAccess = (): boolean => {
  // All users can access scoreboard - subscription removed
  return true;
};

/**
 * Check if user has access to stat sheet scanner feature
 * @returns boolean
 */
export const hasStatSheetScannerAccess = (): boolean => {
  const features = getUserTierFeatures();
  return features?.hasStatSheetScanner ?? false;
};

/**
 * Check if user has access to manual entry feature
 * @returns boolean (always true for all tiers)
 */
export const hasManualEntryAccess = (): boolean => {
  const features = getUserTierFeatures();
  return features?.hasManualEntry ?? true;
};

/**
 * Get user's maximum teams allowed
 * @returns number
 */
export const getUserMaxTeams = (): number => {
  const features = getUserTierFeatures();
  return features?.maxTeams ?? 4;
};

export type SubscriptionAccessState =
  | 'open'
  | 'admin'
  | 'active'
  | 'canceled_but_active'
  | 'grace_period'
  | 'billing_retry'
  | 'expired'
  | 'inactive';

const normalizeDate = (value: any): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasFutureDate = (value: any): boolean => {
  const date = normalizeDate(value);
  return !!date && date.getTime() > Date.now();
};

export const getSubscriptionAccessState = (): SubscriptionAccessState => {
  const policyStage = CMConstants.featureFlags?.subscriptionPolicyStage || 'grace_friendly';
  if (policyStage === 'open') {
    return 'open';
  }

  const user = CMGlobal.user;
  if (!user) {
    return 'inactive';
  }

  if (user.role === 'admin') {
    return 'admin';
  }

  const subscriptionStatus = `${user.subscriptionStatus || ''}`.toLowerCase();
  const autoRenewStatus = `${user.autoRenewStatus || user.auto_renew_status || ''}`.toLowerCase();
  const billingState = `${user.billingState || user.billing_status || ''}`.toLowerCase();
  const paid = Boolean(user.paid);
  const expirationDate = normalizeDate(user.expiration_date);
  const isExpired = !expirationDate || expirationDate.getTime() <= Date.now();

  if (!paid || isExpired) {
    return 'expired';
  }

  if (billingState.includes('grace') || subscriptionStatus.includes('grace') || hasFutureDate(user.gracePeriodExpiresDate)) {
    return 'grace_period';
  }

  if (billingState.includes('retry') || subscriptionStatus.includes('retry') || subscriptionStatus.includes('billing_retry')) {
    return 'billing_retry';
  }

  if (
    autoRenewStatus === 'off' ||
    autoRenewStatus === 'false' ||
    subscriptionStatus.includes('cancel') ||
    subscriptionStatus.includes('non_renewing')
  ) {
    return 'canceled_but_active';
  }

  return 'active';
};

export const canCreateLeagueUnderSubscriptionPolicy = () => {
  const policyStage = CMConstants.featureFlags?.subscriptionPolicyStage || 'grace_friendly';
  const state = getSubscriptionAccessState();

  if (policyStage === 'open') {
    return { allowed: true, state, message: '' };
  }

  if (policyStage === 'strict') {
    const allowed = state === 'admin' || state === 'active';
    return {
      allowed,
      state,
      message: allowed
        ? ''
        : 'An active subscription is required to create a new league.',
    };
  }

  // grace_friendly
  const allowedStates: SubscriptionAccessState[] = [
    'open',
    'admin',
    'active',
    'canceled_but_active',
    'grace_period',
  ];
  return {
    allowed: allowedStates.includes(state),
    state,
    message:
      state === 'billing_retry'
        ? 'Your subscription has a billing issue. Please update billing to create a new league.'
        : state === 'expired' || state === 'inactive'
          ? 'Your subscription is inactive or expired. Please renew to create a new league.'
          : '',
  };
};

/**
 * Check if user can access scoreboard and show upgrade message if not
 * @param navigation - Optional navigation object
 * @returns boolean - Always true, all users can access scoreboard
 */
export const checkScoreboardAccess = (navigation?: any): boolean => {
  // All users can access scoreboard - subscription removed
  return true;
};

/**
 * Check if user can access stat sheet scanner and show upgrade message if not
 * @param navigation - Optional navigation object
 * @returns boolean - true if has access, false otherwise
 */
export const checkStatSheetScannerAccess = (navigation?: any): boolean => {
  if (hasStatSheetScannerAccess()) {
    return true;
  }

  CMAlertDlgHelper.showAlertWithOK(
    'Stat Sheet Scanner Feature Unavailable\n\nThis feature is available in Enterprise tier and above. Please upgrade your subscription to access the stat sheet scanner feature.',
    () => {
      if (navigation) {
        navigation.goBack();
      }
    }
  );
  return false;
};

export default {
  getUserTierFeatures,
  hasScoreboardAccess,
  hasStatSheetScannerAccess,
  hasManualEntryAccess,
  getUserMaxTeams,
  getSubscriptionAccessState,
  canCreateLeagueUnderSubscriptionPolicy,
  checkScoreboardAccess,
  checkStatSheetScannerAccess,
};
