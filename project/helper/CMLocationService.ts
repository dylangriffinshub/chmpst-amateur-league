import CMConstants from '../CMConstants';
import CMGlobal from '../CMGlobal';
import { getAuth } from '@react-native-firebase/auth';

export interface CMLocationOption {
  label: string;
  value: string;
}

type BackendLocationRow = {
  name: string;
  code?: string;
};

const getBackendAuthToken = async (): Promise<string | null> => {
  try {
    const firebaseUser = getAuth().currentUser;
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken(true);
      return token || null;
    }

    const restApiAuth = (CMGlobal as any).restApiAuth;
    if (restApiAuth?.idToken) {
      return restApiAuth.idToken;
    }

    return null;
  } catch {
    return null;
  }
};

const fetchLocations = async (path: string): Promise<BackendLocationRow[]> => {
  const token = await getBackendAuthToken();
  if (!token) {
    throw new Error('Please sign in again to load locations.');
  }

  const baseUrl = CMConstants.api.baseUrl;
  const version = CMConstants.api.version;
  const response = await fetch(`${baseUrl}/api/${version}/locations${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load locations.');
  }

  return Array.isArray(payload.data) ? payload.data : [];
};

const mapRowsToOptions = (rows: BackendLocationRow[]): CMLocationOption[] =>
  rows.map((row) => ({
    label: row.name,
    value: row.code || row.name,
  }));

export const getCountryOptions = async (): Promise<CMLocationOption[]> => {
  const rows = await fetchLocations('/countries');
  return mapRowsToOptions(rows).map((option) => ({
    ...option,
    label: option.value === 'US' ? 'USA' : option.label,
  }));
};

export const getStateOptions = async (countryCode: string): Promise<CMLocationOption[]> => {
  const rows = await fetchLocations(`/countries/${countryCode}/states`);
  return mapRowsToOptions(rows);
};

export const getCityOptions = async (
  countryCode: string,
  stateCode: string,
): Promise<CMLocationOption[]> => {
  const rows = await fetchLocations(`/countries/${countryCode}/states/${stateCode}/cities`);
  return mapRowsToOptions(rows);
};

export const getCountryLabel = (countryCode: string) => {
  if (countryCode === 'US') {
    return 'USA';
  }

  if (countryCode === 'CA') {
    return 'Canada';
  }

  return countryCode;
};

export const resolveInitialCountryCode = (countryCode?: string, countryName?: string) => {
  if (countryCode) {
    return countryCode.toUpperCase();
  }

  const normalizedCountry = `${countryName || ''}`.trim().toLowerCase();
  if (normalizedCountry === 'usa' || normalizedCountry === 'united states') {
    return 'US';
  }

  if (normalizedCountry === 'canada') {
    return 'CA';
  }

  return '';
};

export default {
  getCountryOptions,
  getStateOptions,
  getCityOptions,
  getCountryLabel,
  resolveInitialCountryCode,
};
