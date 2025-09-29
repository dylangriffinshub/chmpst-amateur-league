import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateEmail,
  deleteUser,
  updatePassword,
  OAuthProvider,
  signInWithCredential,
  signInWithCustomToken,
} from '@react-native-firebase/auth';
import { Filter, getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from '@react-native-firebase/firestore';
import { getStorage, ref as storageRef, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { Timestamp } from '@react-native-firebase/firestore';
import CMGlobal from '../CMGlobal';
import { Platform } from 'react-native';
import appleAuth from '@invertase/react-native-apple-authentication';
import CMAlertDlgHelper from './CMAlertDlgHelper';
import CMLocalStorageHelper from './CMLocalStorageHelper';

/**
 * Get current user ID - works for both regular Firebase auth and Apple Sign In (REST API)
 * Returns CMGlobal.user.id for Apple Sign In users, or getAuth().currentUser?.uid for regular auth
 */
const getCurrentUserId = (): string | null => {
  // For Apple Sign In users, use CMGlobal.user.id
  if (CMGlobal.user?.id) {
    return CMGlobal.user.id;
  }
  // For regular Firebase auth users, use getAuth().currentUser?.uid
  return getAuth().currentUser?.uid || null;
};

/**
 * Get current user object - works for both regular Firebase auth and Apple Sign In
 */
const getCurrentUser = () => {
  // For Apple Sign In users, return mock user object
  if (CMGlobal.user?.id && !getAuth().currentUser) {
    return {
      uid: CMGlobal.user.id,
      email: CMGlobal.user.email,
      displayName: CMGlobal.user.name,
    };
  }
  // For regular Firebase auth users, return getAuth().currentUser
  return getAuth().currentUser;
};

const updateUser = (
  userId: string,
  data: { [name: string]: any },
  callback?: Function,
) => {
  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    callback && callback({ 
      isSuccess: false, 
      value: 'User update timed out. This is a WRITE operation - your Firebase may need to be upgraded.' 
    });
  }, 30000); // 30 second timeout

  // For Apple Sign In users, use Firestore REST API with idToken
  // Check if user is Apple Sign In user: has CMGlobal.user.id but no currentUser
  const hasFirebaseSession = !!getAuth().currentUser;
  const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
  
  // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
  let restApiAuth = (CMGlobal as any).restApiAuth;
  
  // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
  if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
    console.log('[Update User] Apple Sign In user detected, loading auth from AsyncStorage...');
    CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
      if (isSuccess && storedAuth && storedAuth.idToken) {
        restApiAuth = storedAuth;
        (CMGlobal as any).restApiAuth = storedAuth; // Store in CMGlobal for future use
        console.log('[Update User] Loaded restApiAuth from AsyncStorage');
        // Continue with update using the loaded token
        performRestApiUpdate(userId, data, restApiAuth, timeoutId, callback);
      } else {
        // No stored auth, fall back to React Native Firebase (will fail)
        console.warn('[Update User] Apple Sign In user but no stored auth token. Cannot update via REST API.');
        performRegularFirebaseUpdate(userId, data, timeoutId, callback);
      }
    });
    return; // Exit early, callback will be called from async operation
  }
  
  console.log('[Update User] Auth check:', {
    hasRestApiAuth: !!restApiAuth,
    hasIdToken: !!(restApiAuth?.idToken),
    hasFirebaseSession,
    isAppleSignInUser,
    userId,
    globalUserId: CMGlobal.user?.id
  });
  
  // If we detect Apple Sign In user and have restApiAuth, use REST API
  if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
    console.log('[Update User] Using Firestore REST API for Apple Sign In user');
    performRestApiUpdate(userId, data, restApiAuth, timeoutId, callback);
    return;
  }
  
  // Regular Firebase auth users
  console.log('[Update User] Using React Native Firebase (regular auth user)');
  performRegularFirebaseUpdate(userId, data, timeoutId, callback);
};

// Helper function to perform REST API update
const performRestApiUpdate = (
  userId: string,
  data: { [name: string]: any },
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback?: Function
) => {
    
    // Convert data to Firestore REST API format
    const fields: any = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value instanceof Date) {
        fields[key] = { timestampValue: value.toISOString() };
      } else if (value && typeof value === 'object' && value.toDate) {
        // Firestore Timestamp
        fields[key] = { timestampValue: value.toDate().toISOString() };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { integerValue: value.toString() };
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else {
        fields[key] = { stringValue: String(value) };
      }
    });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/users/${userId}`;
  
  console.log('[Update User] Calling Firestore REST API:', { url: firestoreUrl, userId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Update User] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API update failed');
    }
    
    console.log('[Update User] Firestore REST API update successful');
    
    // Update CMGlobal.user - preserve id and role if they exist in data
    const currentUserId = getCurrentUserId();
    if (currentUserId && userId == currentUserId) {
      // Merge with existing user data to preserve all fields
      CMGlobal.user = { 
        ...CMGlobal.user, 
        ...data,
        // Ensure id and role are preserved
        id: data.id || CMGlobal.user?.id || userId,
        role: data.role || CMGlobal.user?.role || 'coach'
      };
      console.log('[Update User] CMGlobal.user updated:', CMGlobal.user);
    }
    
    // Use setTimeout with a small delay to ensure UI is ready and loading state can be cleared
    setTimeout(() => {
      callback && callback({ isSuccess: true, value: 'Updated successfully!' });
    }, 100);
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Update User] Firestore REST API catch error:', error);
    let errorMessage = 'Failed to update user.';
    if (error.message) {
      errorMessage = `Failed to update user: ${error.message}`;
    }
    callback && callback({ isSuccess: false, value: errorMessage });
  });
};

// Helper function to perform regular Firebase update
const performRegularFirebaseUpdate = (
  userId: string,
  data: { [name: string]: any },
  timeoutId: NodeJS.Timeout,
  callback?: Function
) => {

  const db = getFirestore();
  updateDoc(doc(collection(db, 'users'), userId), data)
    .then(() => {
      clearTimeout(timeoutId);
      const currentUserId = getCurrentUserId();
      if (currentUserId && userId == currentUserId) {
        // Merge with existing user data to preserve all fields
        CMGlobal.user = { 
          ...CMGlobal.user, 
          ...data,
          // Ensure id and role are preserved
          id: data.id || CMGlobal.user?.id || userId,
          role: data.role || CMGlobal.user?.role || 'coach'
        };
      }
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback && callback({ isSuccess: true, value: 'Updated successfully!' });
      }, 0);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to update user.';
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to update user. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'failed-precondition') {
        errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
      } else if (error.message) {
        errorMessage = `Failed to update user: ${error.message}`;
      }
      callback && callback({ isSuccess: false, value: errorMessage });
    });
};

const getUser = (userId: string, callback: Function) => {
  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Request timed out. Please check your internet connection and try again.' });
    }, 0);
  }, 15000); // 15 second timeout

  // Check if user is Apple Sign In user (no Firebase session but has userId or CMGlobal.user.id)
  const hasFirebaseSession = !!getAuth().currentUser;
  // Also check CMGlobal.user.id to properly detect Apple Sign In users
  const isAppleSignInUser = (CMGlobal.user?.id && !hasFirebaseSession) || (!hasFirebaseSession && userId);
  
  // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
  let restApiAuth = (CMGlobal as any).restApiAuth;
  
  // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
  if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
    console.log('[Get User] Apple Sign In user detected, loading auth from AsyncStorage...');
    CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
      if (isSuccess && storedAuth && storedAuth.idToken) {
        restApiAuth = storedAuth;
        (CMGlobal as any).restApiAuth = storedAuth;
        console.log('[Get User] Loaded restApiAuth from AsyncStorage');
        performRestApiGetUser(userId, restApiAuth, timeoutId, callback);
      } else {
        console.warn('[Get User] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
        performRegularFirebaseGetUser(userId, timeoutId, callback);
      }
    });
    return; // Exit early, callback will be called from async operation
  }
  
  // If we detect Apple Sign In user and have restApiAuth, use REST API
  if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
    console.log('[Get User] Using Firestore REST API for Apple Sign In user');
    performRestApiGetUser(userId, restApiAuth, timeoutId, callback);
    return;
  }
  
  // Regular Firebase auth users
  console.log('[Get User] Using React Native Firebase (regular auth user)');
  performRegularFirebaseGetUser(userId, timeoutId, callback);
};

// Helper function to perform REST API get user
const performRestApiGetUser = (
  userId: string,
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/users/${userId}`;
  
  console.log('[Get User] Calling Firestore REST API to get user:', userId);
  
  fetch(firestoreUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
  })
  .then(async (response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Get User] Firestore REST API error:', errorData);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        if (response.status === 404) {
          callback({ isSuccess: false, value: 'Can not get user information.' });
        } else {
          callback({ isSuccess: false, value: 'Failed to load user information. Please try again.' });
        }
      }, 0);
      return;
    }
    
    const documentData = await response.json();
    console.log('[Get User] Firestore REST API get successful');
    
    // Convert Firestore REST API format to regular object
    const userData: any = { id: userId };
    
    if (documentData.fields) {
      Object.keys(documentData.fields).forEach(key => {
        const field = documentData.fields[key];
        if (field.stringValue !== undefined) {
          userData[key] = field.stringValue;
        } else if (field.integerValue !== undefined) {
          userData[key] = parseInt(field.integerValue);
        } else if (field.booleanValue !== undefined) {
          userData[key] = field.booleanValue;
        } else if (field.timestampValue !== undefined) {
          userData[key] = new Date(field.timestampValue);
        } else if (field.nullValue !== undefined) {
          userData[key] = null;
        } else if (field.arrayValue !== undefined) {
          // Handle arrays
          userData[key] = field.arrayValue.values.map((v: any) => {
            if (v.stringValue !== undefined) return v.stringValue;
            if (v.integerValue !== undefined) return parseInt(v.integerValue);
            if (v.booleanValue !== undefined) return v.booleanValue;
            return null;
          });
        }
      });
    }
    
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: true, value: userData });
    }, 0);
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Get User] Firestore REST API catch error:', error);
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to load user information. Please try again.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase get user
const performRegularFirebaseGetUser = (
  userId: string,
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  const db = getFirestore();
  getDoc(doc(collection(db, 'users'), userId))
    .then(documentSnapshot => {
      clearTimeout(timeoutId);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        if (documentSnapshot.exists()) {
          callback({ isSuccess: true, value: documentSnapshot.data() });
        } else {
          callback({ isSuccess: false, value: 'Can not get user information.' });
        }
      }, 0);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('getUser error:', error);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to load user information. Please try again.' });
      }, 0);
    });
};

const setTeam = (
  teamId: string,
  team: { [name: string]: any },
  callback: Function,
) => {
  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    callback({ 
      isSuccess: false, 
      value: 'Request timed out. Please check your internet connection and try again. If the problem persists, your Firebase may need to be upgraded.' 
    });
  }, 30000); // 30 second timeout

  // For Apple Sign In users, use Firestore REST API with idToken
  const hasFirebaseSession = !!getAuth().currentUser;
  const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
  
  // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
  let restApiAuth = (CMGlobal as any).restApiAuth;
  
  // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
  if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
    console.log('[Set Team] Apple Sign In user detected, loading auth from AsyncStorage...');
    CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
      if (isSuccess && storedAuth && storedAuth.idToken) {
        restApiAuth = storedAuth;
        (CMGlobal as any).restApiAuth = storedAuth;
        console.log('[Set Team] Loaded restApiAuth from AsyncStorage');
        performRestApiSetTeam(teamId, team, restApiAuth, timeoutId, callback);
      } else {
        console.warn('[Set Team] Apple Sign In user but no stored auth token. Cannot create team via REST API.');
        performRegularFirebaseSetTeam(teamId, team, timeoutId, callback);
      }
    });
    return; // Exit early, callback will be called from async operation
  }
  
  console.log('[Set Team] Auth check:', {
    hasRestApiAuth: !!restApiAuth,
    hasIdToken: !!(restApiAuth?.idToken),
    hasFirebaseSession,
    isAppleSignInUser,
    teamId
  });
  
  // If we detect Apple Sign In user and have restApiAuth, use REST API
  if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
    console.log('[Set Team] Using Firestore REST API for Apple Sign In user');
    performRestApiSetTeam(teamId, team, restApiAuth, timeoutId, callback);
    return;
  }
  
  // Regular Firebase auth users
  console.log('[Set Team] Using React Native Firebase (regular auth user)');
  performRegularFirebaseSetTeam(teamId, team, timeoutId, callback);
};

// Helper function to perform REST API set team
const performRestApiSetTeam = (
  teamId: string,
  team: { [name: string]: any },
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  // Convert team data to Firestore REST API format
  const fields: any = {};
  Object.keys(team).forEach(key => {
    const value = team[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map(v => ({ stringValue: String(v) })) } };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/teams/${teamId}`;
  
  console.log('[Set Team] Calling Firestore REST API:', { url: firestoreUrl, teamId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Set Team] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API set failed');
    }
    
    console.log('[Set Team] Firestore REST API set successful');
    callback({ isSuccess: true });
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Set Team] Firestore REST API catch error:', error);
    let errorMessage = 'Failed to save team.';
    if (error.message) {
      errorMessage = `Failed to save team: ${error.message}`;
    }
    callback({ isSuccess: false, value: errorMessage });
  });
};

// Helper function to perform regular Firebase set team
const performRegularFirebaseSetTeam = (
  teamId: string,
  team: { [name: string]: any },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  setDoc(doc(collection(getFirestore(), 'teams'), teamId), team)
    .then(() => {
      clearTimeout(timeoutId);
      callback({ isSuccess: true });
    })
    .catch(error => {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to save team.';
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create this team. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'failed-precondition') {
        errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
      } else if (error.message) {
        errorMessage = `Failed to save team: ${error.message}`;
      }
      callback({ isSuccess: false, value: errorMessage });
    });
};

// Helper function to perform REST API create league
const performRestApiCreateLeague = (
  leagueId: string,
  league: { [name: string]: any },
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  // Convert league data to Firestore REST API format
  const fields: any = {};
  Object.keys(league).forEach(key => {
    const value = league[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays - convert each element based on its type
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/league/${leagueId}`;
  
  console.log('[Create League] Calling Firestore REST API:', { url: firestoreUrl, leagueId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH', // PATCH creates if doesn't exist, updates if exists
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Create League] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API create failed');
    }
    
    console.log('[Create League] Firestore REST API create successful');
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: true, value: 'Created league successfully!' });
    }, 0);
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Create League] Firestore REST API catch error:', error);
    let errorMessage = 'Failed to create league.';
    if (error.message) {
      errorMessage = `Failed to create league: ${error.message}`;
    }
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: false, value: errorMessage });
    }, 0);
  });
};

// Helper function to perform regular Firebase create league
const performRegularFirebaseCreateLeague = (
  leagueId: string,
  league: { [name: string]: any },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  const db = getFirestore();
  setDoc(doc(collection(db, 'league'), leagueId), league)
    .then(() => {
      clearTimeout(timeoutId);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Created league successfully!' });
      }, 0);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to create league.';
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create a league. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'failed-precondition') {
        errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
      } else if (error.message) {
        errorMessage = `Failed to create league: ${error.message}`;
      }
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
    });
};

const setEvent = (
  eventId: string,
  event: { [name: string]: any },
  callback: Function,
) => {
  setDoc(doc(collection(getFirestore(), 'events'), eventId), event)
    .then(() => {
      callback({ isSuccess: true, value: 'Added successfully!' });
    })
    .catch(error => {
      callback({ isSuccess: false, value: 'Failed to save event.' });
    });
};

const updateLeague = (
  leagueId: string,
  data: { [name: string]: any },
  callback: Function,
) => {
  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ 
        isSuccess: false, 
        value: 'Request timed out. Please check your internet connection and try again. If the problem persists, your Firebase may need to be upgraded.' 
      });
    }, 0);
  }, 30000); // 30 second timeout

  // For Apple Sign In users, use Firestore REST API with idToken
  const hasFirebaseSession = !!getAuth().currentUser;
  const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
  
  // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
  let restApiAuth = (CMGlobal as any).restApiAuth;
  
  // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
  if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
    console.log('[Update League] Apple Sign In user detected, loading auth from AsyncStorage...');
    CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
      if (isSuccess && storedAuth && storedAuth.idToken) {
        restApiAuth = storedAuth;
        (CMGlobal as any).restApiAuth = storedAuth;
        console.log('[Update League] Loaded restApiAuth from AsyncStorage');
        performRestApiUpdateLeague(leagueId, data, restApiAuth, timeoutId, callback);
      } else {
        console.warn('[Update League] Apple Sign In user but no stored auth token. Cannot update league via REST API.');
        performRegularFirebaseUpdateLeague(leagueId, data, timeoutId, callback);
      }
    });
    return; // Exit early, callback will be called from async operation
  }
  
  console.log('[Update League] Auth check:', {
    hasRestApiAuth: !!restApiAuth,
    hasIdToken: !!(restApiAuth?.idToken),
    hasFirebaseSession,
    isAppleSignInUser,
    leagueId
  });
  
  // If we detect Apple Sign In user and have restApiAuth, use REST API
  if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
    console.log('[Update League] Using Firestore REST API for Apple Sign In user');
    performRestApiUpdateLeague(leagueId, data, restApiAuth, timeoutId, callback);
    return;
  }
  
  // Regular Firebase auth users
  console.log('[Update League] Using React Native Firebase (regular auth user)');
  performRegularFirebaseUpdateLeague(leagueId, data, timeoutId, callback);
};

// Helper function to perform REST API update league
const performRestApiUpdateLeague = (
  leagueId: string,
  data: { [name: string]: any },
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  // Convert league data to Firestore REST API format
  const fields: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays - convert each element based on its type
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/league/${leagueId}`;
  
  // Create updateMask to only update the fields we're changing (preserves other fields)
  const updateMask = Object.keys(fields).join(',');
  
  console.log('[Update League] Calling Firestore REST API:', { url: firestoreUrl, leagueId, fieldCount: Object.keys(fields).length, updateMask });
  
  fetch(`${firestoreUrl}?updateMask.fieldPaths=${updateMask.split(',').map(f => encodeURIComponent(f)).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Update League] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API update failed');
    }
    
    console.log('[Update League] Firestore REST API update successful');
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: true, value: 'Updated successfully!' });
    }, 0);
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Update League] Firestore REST API catch error:', error);
    let errorMessage = 'Failed to update league.';
    if (error.message) {
      errorMessage = `Failed to update league: ${error.message}`;
    }
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ isSuccess: false, value: errorMessage });
    }, 0);
  });
};

// Helper function to perform regular Firebase update league
const performRegularFirebaseUpdateLeague = (
  leagueId: string,
  data: { [name: string]: any },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  const db = getFirestore();
  updateDoc(doc(collection(db, 'league'), leagueId), data)
    .then(() => {
      clearTimeout(timeoutId);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Updated successfully!' });
      }, 0);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to update league.';
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to update this league. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'not-found') {
        errorMessage = 'League not found. It may have been deleted.';
      } else if (error.code === 'failed-precondition') {
        errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
      } else if (error.message) {
        errorMessage = `Failed to update league: ${error.message}`;
      }
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
    });
};

const saveGameStats = (
  gameId: string,
  gameStats: { [name: string]: any },
  callback: Function,
) => {
  setDoc(doc(collection(getFirestore(), 'gameStats'), gameId), gameStats)
    .then(() => {
      callback({ isSuccess: true, value: 'Game stats saved successfully!' });
    })
    .catch(error => {
      callback({ isSuccess: false, value: 'Failed to save game stats.' });
    });
};

// Helper function to perform REST API upload image
const performRestApiUploadImage = async (
  localUri: string,
  firebaseFilePathAndName: string,
  restApiAuth: { idToken: string }
): Promise<{ isSuccess: boolean; value: any }> => {
  try {
    // Read the file from local URI
    // For React Native, we need to use fetch to read the file as blob
    const response = await fetch(localUri);
    const blob = await response.blob();
    
    // Firebase Storage REST API endpoint
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o?name={path}
    // The bucket name is typically: {project-id}.appspot.com
    const bucket = 'statx-a9bfe.appspot.com';
    const encodedPath = encodeURIComponent(firebaseFilePathAndName);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`;
    
    console.log('[Upload Image] Uploading via REST API:', { uploadUrl, path: firebaseFilePathAndName });
    
    // Upload the file
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restApiAuth.idToken}`,
        'Content-Type': blob.type || 'image/jpeg',
      },
      body: blob,
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('[Upload Image] Firebase Storage REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firebase Storage REST API upload failed');
    }
    
    const uploadData = await uploadResponse.json();
    console.log('[Upload Image] Upload successful:', uploadData);
    
    // Get download URL
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token={downloadToken}
    const downloadToken = uploadData.downloadTokens || '';
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;
    
    console.log('[Upload Image] Download URL:', downloadUrl);
    
    return { isSuccess: true, value: downloadUrl };
  } catch (error: any) {
    console.error('[Upload Image] REST API upload error:', error);
    let errorMessage = 'Failed to upload image.';
    if (error.message) {
      errorMessage = `Image upload error: ${error.message}`;
    }
    return { isSuccess: false, value: { message: errorMessage, originalError: error } };
  }
};

// Helper function to perform regular Firebase upload image
const performRegularFirebaseUploadImage = async (
  localUri: string,
  firebaseFilePathAndName: string
): Promise<{ isSuccess: boolean; value: any }> => {
  try {
    const imageRef = storageRef(getStorage(), firebaseFilePathAndName);
    await putFile(imageRef, localUri, { contentType: 'image/jpg' });
    const url = await getDownloadURL(imageRef);
    return { isSuccess: true, value: url };
  } catch (error: any) {
    let errorMessage = 'Failed to upload image.';
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'You do not have permission to upload images.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Image upload was canceled.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'Unknown error occurred during image upload.';
    } else if (error.message) {
      errorMessage = `Image upload error: ${error.message}`;
    }
    return { isSuccess: false, value: { message: errorMessage, originalError: error } };
  }
};

// Helper function to perform REST API get leagues
const performRestApiGetLeagues = (
  restApiAuth: { idToken: string },
  callback: Function
) => {
  // Query Firestore REST API to get all leagues
  const queryUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents:runQuery`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'league' }]
    }
  };
  
  console.log('[Get Leagues] Calling Firestore REST API to get leagues');
  
  fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify(queryBody),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Get Leagues] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API query failed');
    }
    
    const queryData = await response.json();
    console.log('[Get Leagues] Firestore REST API query successful, documents:', queryData.length);
    
    // Convert Firestore REST API format to regular objects
    const leagues: { [name: string]: any }[] = [];
    
    if (queryData && Array.isArray(queryData)) {
      queryData.forEach((item: any) => {
        if (item.document) {
          const document = item.document;
          // Extract document ID from path (e.g., "projects/.../databases/.../documents/league/LEAGUE_ID")
          const pathParts = document.name.split('/');
          const leagueId = pathParts[pathParts.length - 1];
          
          // Convert Firestore REST API format to regular object
          const leagueData: any = { id: leagueId };
          
          if (document.fields) {
            Object.keys(document.fields).forEach(key => {
              const field = document.fields[key];
              if (field.stringValue !== undefined) {
                leagueData[key] = field.stringValue;
              } else if (field.integerValue !== undefined) {
                leagueData[key] = parseInt(field.integerValue);
              } else if (field.booleanValue !== undefined) {
                leagueData[key] = field.booleanValue;
              } else if (field.timestampValue !== undefined) {
                leagueData[key] = new Date(field.timestampValue);
              } else if (field.nullValue !== undefined) {
                leagueData[key] = null;
              } else if (field.arrayValue !== undefined) {
                // Handle arrays
                leagueData[key] = field.arrayValue.values.map((v: any) => {
                  if (v.stringValue !== undefined) return v.stringValue;
                  if (v.integerValue !== undefined) return parseInt(v.integerValue);
                  if (v.booleanValue !== undefined) return v.booleanValue;
                  return null;
                });
              }
            });
          }
          
          leagues.push(leagueData);
        }
      });
    }
    
    console.log('[Get Leagues] Converted', leagues.length, 'leagues from REST API format');
    callback({ isSuccess: true, value: leagues });
  })
  .catch(error => {
    console.error('[Get Leagues] Firestore REST API catch error:', error);
    callback({ isSuccess: false, value: 'Failed to load leagues.' });
  });
};

// Helper function to perform regular Firebase get leagues
const performRegularFirebaseGetLeagues = (callback: Function) => {
  getDocs(collection(getFirestore(), 'league'))
    .then(querySnapshot => {
      const leagues: { [name: string]: any }[] = [];
      querySnapshot.forEach((documentSnapshot: any) => {
        // Include the document ID in the league data
        leagues.push({ id: documentSnapshot.id, ...documentSnapshot.data() });
      });
      callback({ isSuccess: true, value: leagues });
    })
    .catch(error => {
      console.error('[Get Leagues] Regular Firebase error:', error);
      callback({ isSuccess: false, value: 'Failed to load leagues.' });
    });
};

// Helper function to query documents via REST API
const queryDocuments = async (
  collectionId: string,
  whereClause: { field: string; op: string; value: any },
  restApiAuth: { idToken: string }
): Promise<{ id: string; data: any }[]> => {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents:runQuery`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: whereClause.field },
          op: whereClause.op,
          value: { stringValue: whereClause.value }
        }
      }
    }
  };
  
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify(queryBody),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query ${collectionId}`);
  }
  
  const queryData = await response.json();
  const documents: { id: string; data: any }[] = [];
  
  if (queryData && Array.isArray(queryData)) {
    queryData.forEach((item: any) => {
      if (item.document) {
        const pathParts = item.document.name.split('/');
        const docId = pathParts[pathParts.length - 1];
        const docData: any = {};
        
        if (item.document.fields) {
          Object.keys(item.document.fields).forEach(key => {
            const field = item.document.fields[key];
            if (field.stringValue !== undefined) {
              docData[key] = field.stringValue;
            } else if (field.integerValue !== undefined) {
              docData[key] = parseInt(field.integerValue);
            } else if (field.booleanValue !== undefined) {
              docData[key] = field.booleanValue;
            } else if (field.arrayValue !== undefined) {
              docData[key] = field.arrayValue.values.map((v: any) => {
                if (v.stringValue !== undefined) return v.stringValue;
                if (v.integerValue !== undefined) return parseInt(v.integerValue);
                return null;
              });
            }
          });
        }
        
        documents.push({ id: docId, data: docData });
      }
    });
  }
  
  return documents;
};

// Helper function to delete documents by query via REST API
const deleteDocumentsByQuery = async (
  collectionId: string,
  whereClause: { field: string; op: string; value: any },
  restApiAuth: { idToken: string }
): Promise<void> => {
  const documents = await queryDocuments(collectionId, whereClause, restApiAuth);
  
  for (const doc of documents) {
    await deleteDocument(collectionId, doc.id, restApiAuth);
  }
  
  console.log(`[Delete League] Deleted ${documents.length} documents from ${collectionId}`);
};

// Helper function to delete a single document via REST API
const deleteDocument = async (
  collectionId: string,
  documentId: string,
  restApiAuth: { idToken: string }
): Promise<void> => {
  const deleteUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/${collectionId}/${documentId}`;
  
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
  });
  
  if (!response.ok && response.status !== 404) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Failed to delete ${collectionId}/${documentId}`);
  }
};

// Helper function to update team to remove league reference via REST API
const updateTeamRemoveLeagueReference = async (
  teamId: string,
  leagueId: string,
  restApiAuth: { idToken: string }
): Promise<void> => {
  // First get the team
  const teamUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/teams/${teamId}`;
  const teamResponse = await fetch(teamUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
  });
  
  if (!teamResponse.ok) {
    console.warn(`[Delete League] Team ${teamId} not found, skipping update`);
    return;
  }
  
  const teamDoc = await teamResponse.json();
  
  // Extract current data
  const leaguesId: string[] = [];
  
  if (teamDoc.fields?.leaguesId?.arrayValue?.values) {
    teamDoc.fields.leaguesId.arrayValue.values.forEach((v: any) => {
      if (v.stringValue && v.stringValue !== leagueId) {
        leaguesId.push(v.stringValue);
      }
    });
  }
  
  // Get current leagueStats and remove the leagueId key
  const leagueStatsFields: any = {};
  if (teamDoc.fields?.leagueStats?.mapValue?.fields) {
    Object.keys(teamDoc.fields.leagueStats.mapValue.fields).forEach(key => {
      if (key !== leagueId) {
        leagueStatsFields[key] = teamDoc.fields.leagueStats.mapValue.fields[key];
      }
    });
  }
  
  // Update the team
  const fields: any = {
    leaguesId: {
      arrayValue: {
        values: leaguesId.map(id => ({ stringValue: id }))
      }
    },
    leagueStats: {
      mapValue: {
        fields: leagueStatsFields
      }
    }
  };
  
  const updateResponse = await fetch(teamUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  });
  
  if (!updateResponse.ok) {
    throw new Error(`Failed to update team ${teamId}`);
  }
};

// Helper function to update users to remove league reference via REST API
const updateUsersRemoveLeagueReference = async (
  leagueId: string,
  restApiAuth: { idToken: string }
): Promise<void> => {
  const users = await queryDocuments('users', { field: 'leagueId', op: 'EQUAL', value: leagueId }, restApiAuth);
  
  for (const user of users) {
    const userUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/users/${user.id}`;
    await fetch(userUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restApiAuth.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          leagueId: { nullValue: null }
        }
      }),
    });
  }
  
  console.log(`[Delete League] Updated ${users.length} users`);
};

// Helper function to perform REST API delete league with associated data
const performRestApiDeleteLeagueWithAssociatedData = async (
  leagueId: string,
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  try {
    // 1. Get the league data first to access teamsId
    console.log('[Delete League] Fetching league data via REST API...');
    const leagueUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/league/${leagueId}`;
    
    const leagueResponse = await fetch(leagueUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restApiAuth.idToken}`,
      },
    });
    
    if (!leagueResponse.ok) {
      if (leagueResponse.status === 404) {
        clearTimeout(timeoutId);
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ isSuccess: false, value: 'League not found.' });
        }, 0);
        return;
      }
      const errorData = await leagueResponse.json();
      throw new Error(errorData.error?.message || 'Failed to fetch league data');
    }
    
    const leagueDoc = await leagueResponse.json();
    
    // Convert Firestore REST API format to get teamsId
    const teamsId: string[] = [];
    if (leagueDoc.fields?.teamsId?.arrayValue?.values) {
      leagueDoc.fields.teamsId.arrayValue.values.forEach((v: any) => {
        if (v.stringValue) {
          teamsId.push(v.stringValue);
        }
      });
    }
    
    console.log('[Delete League] League teams to process:', teamsId);
    
    // 2. Delete all matches associated with this league
    console.log('[Delete League] Deleting matches...');
    await deleteDocumentsByQuery('matches', { field: 'leagueId', op: 'EQUAL', value: leagueId }, restApiAuth);
    
    // 3. Delete all player stats associated with this league
    console.log('[Delete League] Deleting player stats...');
    await deleteDocumentsByQuery('playerStats', { field: 'leagueId', op: 'EQUAL', value: leagueId }, restApiAuth);
    
    // 4. Delete all player average stats associated with this league
    console.log('[Delete League] Deleting player average stats...');
    await deleteDocumentsByQuery('playerAverageStats', { field: 'leagueId', op: 'EQUAL', value: leagueId }, restApiAuth);
    
    // 5. Delete all events associated with teams in this league
    if (teamsId.length > 0) {
      console.log('[Delete League] Deleting events...');
      // Firestore REST API doesn't support 'in' operator directly, so we need to delete each team's events
      for (const teamId of teamsId) {
        await deleteDocumentsByQuery('events', { field: 'teamId', op: 'EQUAL', value: teamId }, restApiAuth);
      }
    }
    
    // 6. Delete all players associated with teams in this league
    if (teamsId.length > 0) {
      console.log('[Delete League] Deleting players...');
      for (const teamId of teamsId) {
        await deleteDocumentsByQuery('players', { field: 'teamId', op: 'EQUAL', value: teamId }, restApiAuth);
      }
    }
    
    // 7. Update teams to remove league references and league stats
    if (teamsId.length > 0) {
      console.log('[Delete League] Updating teams...');
      for (const teamId of teamsId) {
        await updateTeamRemoveLeagueReference(teamId, leagueId, restApiAuth);
      }
    }
    
    // 8. Update users to remove league references
    console.log('[Delete League] Updating users...');
    await updateUsersRemoveLeagueReference(leagueId, restApiAuth);
    
    // 9. Delete promo codes associated with this league
    console.log('[Delete League] Deleting promo codes...');
    const promoCodes = await queryDocuments('promoCodes', { field: 'leagueId', op: 'EQUAL', value: leagueId }, restApiAuth);
    for (const promoCode of promoCodes) {
      await deleteDocument('promoCodes', promoCode.id, restApiAuth);
    }
    
    // 10. Finally, delete the league document itself
    console.log('[Delete League] Deleting league document...');
    await deleteDocument('league', leagueId, restApiAuth);
    
    console.log('[Delete League] League and all associated data deleted successfully!');
    clearTimeout(timeoutId);
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ 
        isSuccess: true, 
        value: 'League and all associated data deleted successfully!' 
      });
    }, 0);
    
  } catch (error: any) {
    console.error('[Delete League] Error during REST API league deletion:', error);
    clearTimeout(timeoutId);
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    setTimeout(() => {
      callback({ 
        isSuccess: false, 
        value: `Failed to delete league and associated data: ${error.message || 'Unknown error'}. Some data may have been partially deleted.` 
      });
    }, 0);
  }
};

// Helper function to perform regular Firebase delete league with associated data
const performRegularFirebaseDeleteLeagueWithAssociatedData = (
  leagueId: string,
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  // Get the league data first to access teamsId
  getDoc(doc(collection(getFirestore(), 'league'), leagueId))
    .then(async (leagueDoc) => {
      if (!leagueDoc.exists()) {
        clearTimeout(timeoutId);
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ isSuccess: false, value: 'League not found.' });
        }, 0);
        return;
      }

      const leagueData = leagueDoc.data() as any;
      const teamsId = leagueData?.teamsId || [];
      
      console.log('League teams to process:', teamsId);

      try {
        // 1. Delete all matches associated with this league
        console.log('Deleting matches...');
        const matchesQuery = query(collection(getFirestore(), 'matches'), where('leagueId', '==', leagueId));
        const matchesSnapshot = await getDocs(matchesQuery);
        
        const matchDeletionPromises = matchesSnapshot.docs.map((matchDoc: any) => deleteDoc(matchDoc.ref));
        await Promise.all(matchDeletionPromises);
        console.log(`Deleted ${matchesSnapshot.size} matches`);

        // 2. Delete all player stats associated with this league
        console.log('Deleting player stats...');
        const playerStatsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', leagueId));
        const playerStatsSnapshot = await getDocs(playerStatsQuery);
        
        const playerStatsDeletionPromises = playerStatsSnapshot.docs.map((playerStatDoc: any) => deleteDoc(playerStatDoc.ref));
        await Promise.all(playerStatsDeletionPromises);
        console.log(`Deleted ${playerStatsSnapshot.size} player stats`);

        // 3. Delete all player average stats associated with this league
        console.log('Deleting player average stats...');
        const playerAverageStatsQuery = query(collection(getFirestore(), 'playerAverageStats'), where('leagueId', '==', leagueId));
        const playerAverageStatsSnapshot = await getDocs(playerAverageStatsQuery);
        
        const playerAverageStatsDeletionPromises = playerAverageStatsSnapshot.docs.map((playerAverageStatDoc: any) => deleteDoc(playerAverageStatDoc.ref));
        await Promise.all(playerAverageStatsDeletionPromises);
        console.log(`Deleted ${playerAverageStatsSnapshot.size} player average stats`);

        // 4. Delete all events associated with teams in this league
        console.log('Deleting events...');
        if (teamsId.length > 0) {
          const eventsQuery = query(collection(getFirestore(), 'events'), where('teamId', 'in', teamsId));
          const eventsSnapshot = await getDocs(eventsQuery);
          
          const eventsDeletionPromises = eventsSnapshot.docs.map((eventDoc: { ref: any; }) => deleteDoc(eventDoc.ref));
          await Promise.all(eventsDeletionPromises);
          console.log(`Deleted ${eventsSnapshot.size} events`);
        }

        // 5. Delete all players associated with teams in this league
        console.log('Deleting players...');
        if (teamsId.length > 0) {
          const playersQuery = query(collection(getFirestore(), 'players'), where('teamId', 'in', teamsId));
          const playersSnapshot = await getDocs(playersQuery);
          
          const playersDeletionPromises = playersSnapshot.docs.map((playerDoc: any) => deleteDoc(playerDoc.ref));
          await Promise.all(playersDeletionPromises);
          console.log(`Deleted ${playersSnapshot.size} players`);
        }

        // 6. Update teams to remove league references and league stats
        console.log('Updating teams...');
        if (teamsId.length > 0) {
          const teamUpdatePromises = teamsId.map(async (teamId: string) => {
            const db = getFirestore();
            const teamDoc = await getDoc(doc(collection(db, 'teams'), teamId));
            if (teamDoc.exists()) {
              const teamData = teamDoc.data() as any;
              const updatedLeaguesId = (teamData?.leaguesId || []).filter((id: string) => id !== leagueId);
              const updatedLeagueStats = { ...teamData?.leagueStats };
              delete updatedLeagueStats[leagueId];
              
              await updateDoc(doc(collection(db, 'teams'), teamId), {
                leaguesId: updatedLeaguesId,
                leagueStats: updatedLeagueStats
              });
            }
          });
          await Promise.all(teamUpdatePromises);
          console.log(`Updated ${teamsId.length} teams`);
        }

        // 7. Update users to remove league references
        console.log('Updating users...');
        const usersQuery = query(collection(getFirestore(), 'users'), where('leagueId', '==', leagueId));
        const usersSnapshot = await getDocs(usersQuery);
        
        const userUpdatePromises = usersSnapshot.docs.map((userDoc: any) => 
          updateDoc(userDoc.ref, { leagueId: null })
        );
        await Promise.all(userUpdatePromises);
        console.log(`Updated ${usersSnapshot.size} users`);

        // 8. Delete promo codes associated with this league (if any)
        console.log('Deleting promo codes...');
        const promoCodesSnapshot = await getDocs(collection(getFirestore(), 'promoCodes'));
        
        const promoCodesToDelete = promoCodesSnapshot.docs.filter((doc: any) => {
          const data = doc.data();
          // Check if promo code is related to this league (you might need to adjust this logic based on your promo code structure)
          return data.leagueId === leagueId;
        });
        
        const promoCodesDeletionPromises = promoCodesToDelete.map((promoCodeDoc: any)  => deleteDoc(promoCodeDoc.ref));
        await Promise.all(promoCodesDeletionPromises);
        console.log(`Deleted ${promoCodesToDelete.length} promo codes`);

        // 9. Finally, delete the league document itself
        console.log('Deleting league document...');
        const db = getFirestore();
        await deleteDoc(doc(collection(db, 'league'), leagueId));
        console.log('League document deleted');

        console.log('League and all associated data deleted successfully!');
        clearTimeout(timeoutId);
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ 
            isSuccess: true, 
            value: 'League and all associated data deleted successfully!' 
          });
        }, 0);

      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error during comprehensive league deletion:', error);
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ 
            isSuccess: false, 
            value: 'Failed to delete league and associated data. Some data may have been partially deleted.' 
          });
        }, 0);
      }
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('Error fetching league for deletion:', error);
      let errorMessage = 'Failed to load league for deletion.';
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'permission-denied') {
          errorMessage = 'You do not have permission to access this league. Please check your Firebase security rules.';
        } else if (error.code === 'unavailable') {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.code === 'failed-precondition') {
          errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
        }
      }
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
    });
};

// Helper function to perform REST API create player
const performRestApiCreatePlayer = (
  playerId: string,
  data: { [name: string]: any },
  restApiAuth: { idToken: string },
  callback?: Function
) => {
  // Convert player data to Firestore REST API format
  const fields: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays - convert each element based on its type
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/players/${playerId}`;
  
  console.log('[Create Player] Calling Firestore REST API:', { url: firestoreUrl, playerId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH', // PATCH creates if doesn't exist, updates if exists
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Create Player] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API create failed');
    }
    
    console.log('[Create Player] Firestore REST API create successful');
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    if (callback) {
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Created successfully!' });
      }, 0);
    }
  })
  .catch(error => {
    console.error('[Create Player] Firestore REST API catch error:', error);
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    if (callback) {
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to create.' });
      }, 0);
    }
  });
};

// Helper function to perform regular Firebase create player
const performRegularFirebaseCreatePlayer = (
  playerId: string,
  data: { [name: string]: any },
  callback?: Function
) => {
  const db = getFirestore();
  setDoc(doc(collection(db, 'players'), playerId), data)
    .then(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      if (callback) {
        setTimeout(() => {
          callback({ isSuccess: true, value: 'Created successfully!' });
        }, 0);
      }
    })
    .catch(error => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      if (callback) {
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Failed to create.' });
        }, 0);
      }
    });
};

// Helper function to perform REST API update player
const performRestApiUpdatePlayer = (
  playerId: string,
  data: { [name: string]: any },
  restApiAuth: { idToken: string },
  callback?: Function
) => {
  // Convert player data to Firestore REST API format
  const fields: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays - convert each element based on its type
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/players/${playerId}`;
  
  console.log('[Update Player] Calling Firestore REST API:', { url: firestoreUrl, playerId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Update Player] Firestore REST API error:', errorData);
      throw new Error(errorData.error?.message || 'Firestore REST API update failed');
    }
    
    console.log('[Update Player] Firestore REST API update successful');
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    if (callback) {
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Updated successfully!' });
      }, 0);
    }
  })
  .catch(error => {
    console.error('[Update Player] Firestore REST API catch error:', error);
    // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
    if (callback) {
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to update.' });
      }, 0);
    }
  });
};

// Helper function to perform regular Firebase update player
const performRegularFirebaseUpdatePlayer = (
  playerId: string,
  data: { [name: string]: any },
  callback?: Function
) => {
  const db = getFirestore();
  updateDoc(doc(collection(db, 'players'), playerId), data)
    .then(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      if (callback) {
        setTimeout(() => {
          callback({ isSuccess: true, value: 'Updated successfully!' });
        }, 0);
      }
    })
    .catch(error => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      if (callback) {
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Failed to update.' });
        }, 0);
      }
    });
};

// Helper function to perform REST API join leagues
const performRestApiJoinLeagues = (
  inviteId: string,
  teamId: string,
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  // Query leagues by inviteId using Firestore REST API
  const queryUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents:runQuery`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'league' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'inviteId' },
          op: 'EQUAL',
          value: { stringValue: inviteId }
        }
      }
    }
  };
  
  console.log('[Join Leagues] Calling Firestore REST API to query leagues by inviteId:', inviteId);
  
  fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify(queryBody),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      clearTimeout(timeoutId);
      console.error('[Join Leagues] Firestore REST API query error:', errorData);
      let errorMessage = 'Failed to join league.';
      if (errorData.error?.message) {
        errorMessage = `Failed to join league: ${errorData.error.message}`;
      }
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
      return;
    }
    
    const queryData = await response.json();
    console.log('[Join Leagues] Firestore REST API query successful, documents:', queryData.length);
    
    // Convert Firestore REST API format to regular objects
    const leagues: { id: string; data: any }[] = [];
    if (queryData && Array.isArray(queryData)) {
      queryData.forEach((item: any) => {
        if (item.document) {
          const document = item.document;
          // Extract document ID from path
          const pathParts = document.name.split('/');
          const leagueId = pathParts[pathParts.length - 1];
          
          // Convert Firestore REST API format to regular object
          const leagueData: any = { id: leagueId };
          
          if (document.fields) {
            Object.keys(document.fields).forEach(key => {
              const field = document.fields[key];
              if (field.stringValue !== undefined) {
                leagueData[key] = field.stringValue;
              } else if (field.integerValue !== undefined) {
                leagueData[key] = parseInt(field.integerValue);
              } else if (field.booleanValue !== undefined) {
                leagueData[key] = field.booleanValue;
              } else if (field.timestampValue !== undefined) {
                leagueData[key] = new Date(field.timestampValue);
              } else if (field.nullValue !== undefined) {
                leagueData[key] = null;
              } else if (field.arrayValue !== undefined) {
                // Handle arrays
                leagueData[key] = field.arrayValue.values.map((v: any) => {
                  if (v.stringValue !== undefined) return v.stringValue;
                  if (v.integerValue !== undefined) return parseInt(v.integerValue);
                  if (v.booleanValue !== undefined) return v.booleanValue;
                  return null;
                });
              }
            });
          }
          
          leagues.push({ id: leagueId, data: leagueData });
        }
      });
    }
    
    if (leagues.length === 0) {
      clearTimeout(timeoutId);
      setTimeout(() => {
        callback({
          isSuccess: false,
          value: 'No league found with the invite code.',
        });
      }, 0);
      return;
    }
    
    const totalLeagues = leagues.length;
    let joined = 0;
    let failed = 0;
    let skipped = 0;
    let skipReasons: string[] = [];
    
    // Process each league
    leagues.forEach(({ id: leagueId, data: league }) => {
      let teamsId = league.teamsId ?? [];
      
      // Check if team is already in the league
      if (teamsId.indexOf(teamId) >= 0) {
        skipped++;
        skipReasons.push('already in league');
        checkComplete();
        return;
      }
      
      // Check if league is full
      if (teamsId.length >= (league.maxTeamSize || 0)) {
        skipped++;
        skipReasons.push('league is full');
        checkComplete();
        return;
      }
      
      // Team can join - add to league
      // Use updateLeague which already handles REST API for Apple Sign In users
      updateLeague(
        leagueId,
        { teamsId: teamsId.concat(teamId) },
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            joined++;
          } else {
            failed++;
          }
          checkComplete();
        }
      );
    });
    
    // Helper function to check if all leagues have been processed
    function checkComplete() {
      const totalProcessed = joined + failed + skipped;
      if (totalProcessed === totalLeagues) {
        clearTimeout(timeoutId);
        setTimeout(() => {
          if (joined > 0) {
            callback({
              isSuccess: true,
              value: `Joined ${joined} league${
                joined >= 2 ? 's' : ''
              } successfully!`,
            });
          } else if (skipped > 0 && failed === 0) {
            // All leagues were skipped (already in or full)
            if (skipReasons.includes('already in league')) {
              callback({
                isSuccess: false,
                value: 'You are already in this league.',
              });
            } else if (skipReasons.includes('league is full')) {
              callback({
                isSuccess: false,
                value: 'This league is full and cannot accept more teams.',
              });
            } else {
              callback({
                isSuccess: false,
                value: 'Unable to join league. The league may be full or you may already be a member.',
              });
            }
          } else {
            callback({
              isSuccess: false,
              value: 'Failed to join league. Please try again.',
            });
          }
        }, 0);
      }
    }
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('[Join Leagues] Firestore REST API catch error:', error);
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to join league. Please try again.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase join leagues
const performRegularFirebaseJoinLeagues = (
  inviteId: string,
  teamId: string,
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
  const db = getFirestore();
  const leaguesRef = collection(db, 'league');
  const q = query(leaguesRef, where('inviteId', '==', inviteId));
  
  getDocs(q)
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        clearTimeout(timeoutId);
        setTimeout(() => {
          callback({
            isSuccess: false,
            value: 'No league found with the invite code.',
          });
        }, 0);
        return;
      }
      
      const totalLeagues = querySnapshot.size;
      let joined = 0;
      let failed = 0;
      let skipped = 0;
      let skipReasons: string[] = [];
      
      querySnapshot.forEach((documentSnapshot: any) => {
        const league = documentSnapshot.data();
        const leagueId = documentSnapshot.id;
        let teamsId = league.teamsId ?? [];
        
        // Check if team is already in the league
        if (teamsId.indexOf(teamId) >= 0) {
          skipped++;
          skipReasons.push('already in league');
          checkComplete();
          return;
        }
        
        // Check if league is full
        if (teamsId.length >= (league.maxTeamSize || 0)) {
          skipped++;
          skipReasons.push('league is full');
          checkComplete();
          return;
        }
        
        // Team can join - add to league
        teamsId = teamsId.concat(teamId);
        updateLeague(
          leagueId,
          { teamsId: teamsId },
          (response: { [name: string]: any }) => {
            if (response.isSuccess) {
              joined++;
            } else {
              failed++;
            }
            checkComplete();
          },
        );
      });
      
      // Helper function to check if all leagues have been processed
      function checkComplete() {
        const totalProcessed = joined + failed + skipped;
        if (totalProcessed === totalLeagues) {
          clearTimeout(timeoutId);
          setTimeout(() => {
            if (joined > 0) {
              callback({
                isSuccess: true,
                value: `Joined ${joined} league${
                  joined >= 2 ? 's' : ''
                } successfully!`,
              });
            } else if (skipped > 0 && failed === 0) {
              // All leagues were skipped (already in or full)
              if (skipReasons.includes('already in league')) {
                callback({
                  isSuccess: false,
                  value: 'You are already in this league.',
                });
              } else if (skipReasons.includes('league is full')) {
                callback({
                  isSuccess: false,
                  value: 'This league is full and cannot accept more teams.',
                });
              } else {
                callback({
                  isSuccess: false,
                  value: 'Unable to join league. The league may be full or you may already be a member.',
                });
              }
            } else {
              callback({
                isSuccess: false,
                value: 'Failed to join league. Please try again.',
              });
            }
          }, 0);
        }
      }
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('[Join Leagues] Regular Firebase error:', error);
      let errorMessage = 'Failed to join league.';
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to join this league.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = `Failed to join: ${error.message}`;
      }
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
    });
};

// Helper function to perform REST API get teams by coach
const performRestApiGetTeamsByCoach = (
  coachId: string,
  restApiAuth: { idToken: string },
  callback: Function
) => {
  // Query teams by coachId using Firestore REST API
  const queryUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents:runQuery`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'teams' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'coachId' },
          op: 'EQUAL',
          value: { stringValue: coachId }
        }
      }
    }
  };
  
  console.log('[Get Teams By Coach] Calling Firestore REST API to query teams by coachId:', coachId);
  
  fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify(queryBody),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Get Teams By Coach] Firestore REST API query error:', errorData);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to load teams.' });
      }, 0);
      return;
    }
    
    const queryData = await response.json();
    console.log('[Get Teams By Coach] Firestore REST API query successful, documents:', queryData.length);
    
    // Convert Firestore REST API format to regular objects
    const teams: any[] = [];
    if (queryData && Array.isArray(queryData)) {
      queryData.forEach((item: any) => {
        if (item.document) {
          const document = item.document;
          // Extract document ID from path
          const pathParts = document.name.split('/');
          const teamId = pathParts[pathParts.length - 1];
          
          // Convert Firestore REST API format to regular object
          const teamData: any = { id: teamId };
          
          if (document.fields) {
            Object.keys(document.fields).forEach(key => {
              const field = document.fields[key];
              if (field.stringValue !== undefined) {
                teamData[key] = field.stringValue;
              } else if (field.integerValue !== undefined) {
                teamData[key] = parseInt(field.integerValue);
              } else if (field.booleanValue !== undefined) {
                teamData[key] = field.booleanValue;
              } else if (field.timestampValue !== undefined) {
                teamData[key] = new Date(field.timestampValue);
              } else if (field.nullValue !== undefined) {
                teamData[key] = null;
              } else if (field.arrayValue !== undefined) {
                // Handle arrays
                teamData[key] = field.arrayValue.values.map((v: any) => {
                  if (v.stringValue !== undefined) return v.stringValue;
                  if (v.integerValue !== undefined) return parseInt(v.integerValue);
                  if (v.booleanValue !== undefined) return v.booleanValue;
                  return null;
                });
              }
            });
          }
          
          teams.push(teamData);
        }
      });
    }
    
    console.log('[Get Teams By Coach] Converted', teams.length, 'teams from REST API format');
    setTimeout(() => {
      callback({ isSuccess: true, value: teams });
    }, 0);
  })
  .catch(error => {
    console.error('[Get Teams By Coach] Firestore REST API catch error:', error);
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to load teams.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase get teams by coach
const performRegularFirebaseGetTeamsByCoach = (
  coachId: string,
  callback: Function
) => {
  const db = getFirestore();
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where('coachId', '==', coachId));
  
  getDocs(q)
    .then(querySnapshot => {
      const teams: any[] = [];
      querySnapshot.forEach((doc: any) => {
        if (doc.exists()) {
          teams.push({ id: doc.id, ...doc.data() });
        }
      });
      setTimeout(() => {
        callback({ isSuccess: true, value: teams });
      }, 0);
    })
    .catch(error => {
      console.log('Error getting teams by coach:', error);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to load teams.' });
      }, 0);
    });
};

// Helper function to perform REST API set match (create)
const performRestApiSetMatch = (
  matchId: string,
  match: { [name: string]: any },
  restApiAuth: { idToken: string },
  callback: Function
) => {
  // Convert match data to Firestore REST API format
  const fields: any = {};
  Object.keys(match).forEach(key => {
    const value = match[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/matches/${matchId}`;
  
  console.log('[Set Match] Calling Firestore REST API:', { url: firestoreUrl, matchId, fieldCount: Object.keys(fields).length });
  
  fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Set Match] Firestore REST API error:', errorData);
      let errorMessage = 'Failed to create match.';
      if (errorData.error?.message) {
        errorMessage = `Failed to create match: ${errorData.error.message}`;
      }
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
      return;
    }
    
    console.log('[Set Match] Firestore REST API create successful');
    setTimeout(() => {
      callback({ isSuccess: true, value: 'Match created successfully!' });
    }, 0);
  })
  .catch(error => {
    console.error('[Set Match] Firestore REST API catch error:', error);
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to create match.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase set match (create)
const performRegularFirebaseSetMatch = (
  matchId: string,
  match: { [name: string]: any },
  callback: Function
) => {
  const db = getFirestore();
  setDoc(doc(collection(db, 'matches'), matchId), match)
    .then(() => {
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Match created successfully!' });
      }, 0);
    })
    .catch(error => {
      console.error('[Set Match] Regular Firebase error:', error);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to create match.' });
      }, 0);
    });
};

// Helper function to perform REST API update match
const performRestApiUpdateMatch = (
  matchId: string,
  updates: { [name: string]: any },
  restApiAuth: { idToken: string },
  callback: Function
) => {
  // Convert updates to Firestore REST API format
  const fields: any = {};
  Object.keys(updates).forEach(key => {
    const value = updates[key];
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (value && typeof value === 'object' && value.toDate) {
      // Firestore Timestamp
      fields[key] = { timestampValue: value.toDate().toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      // Handle arrays
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: v.toString() };
            if (typeof v === 'boolean') return { booleanValue: v };
            return { stringValue: String(v) };
          })
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/matches/${matchId}`;
  
  // Create updateMask to only update the fields we're changing (preserves other fields)
  const updateMask = Object.keys(fields).join(',');
  
  console.log('[Update Match] Calling Firestore REST API:', { url: firestoreUrl, matchId, fieldCount: Object.keys(fields).length, updateMask });
  
  fetch(`${firestoreUrl}?updateMask.fieldPaths=${updateMask.split(',').map(f => encodeURIComponent(f)).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
    body: JSON.stringify({ fields }),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Update Match] Firestore REST API error:', errorData);
      let errorMessage = 'Failed to update match.';
      if (errorData.error?.message) {
        errorMessage = `Failed to update match: ${errorData.error.message}`;
      }
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
      return;
    }
    
    console.log('[Update Match] Firestore REST API update successful');
    setTimeout(() => {
      callback({ isSuccess: true, value: 'Match updated successfully!' });
    }, 0);
  })
  .catch(error => {
    console.error('[Update Match] Firestore REST API catch error:', error);
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to update match.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase update match
const performRegularFirebaseUpdateMatch = (
  matchId: string,
  updates: { [name: string]: any },
  callback: Function
) => {
  const db = getFirestore();
  updateDoc(doc(collection(db, 'matches'), matchId), updates)
    .then(() => {
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Match updated successfully!' });
      }, 0);
    })
    .catch(error => {
      console.error('[Update Match] Regular Firebase error:', error);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to update match.' });
      }, 0);
    });
};

// Helper function to perform REST API delete match
const performRestApiDeleteMatch = (
  matchId: string,
  restApiAuth: { idToken: string },
  callback: Function
) => {
  const deleteUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/matches/${matchId}`;
  
  console.log('[Delete Match] Calling Firestore REST API:', { url: deleteUrl, matchId });
  
  fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${restApiAuth.idToken}`,
    },
  })
  .then(async (response) => {
    if (!response.ok && response.status !== 404) {
      const errorData = await response.json();
      console.error('[Delete Match] Firestore REST API error:', errorData);
      let errorMessage = 'Failed to delete match.';
      if (errorData.error?.message) {
        errorMessage = `Failed to delete match: ${errorData.error.message}`;
      }
      setTimeout(() => {
        callback({ isSuccess: false, value: errorMessage });
      }, 0);
      return;
    }
    
    console.log('[Delete Match] Firestore REST API delete successful');
    setTimeout(() => {
      callback({ isSuccess: true, value: 'Match deleted successfully!' });
    }, 0);
  })
  .catch(error => {
    console.error('[Delete Match] Firestore REST API catch error:', error);
    setTimeout(() => {
      callback({ isSuccess: false, value: 'Failed to delete match.' });
    }, 0);
  });
};

// Helper function to perform regular Firebase delete match
const performRegularFirebaseDeleteMatch = (
  matchId: string,
  callback: Function
) => {
  const db = getFirestore();
  deleteDoc(doc(collection(db, 'matches'), matchId))
    .then(() => {
      setTimeout(() => {
        callback({ isSuccess: true, value: 'Match deleted successfully!' });
      }, 0);
    })
    .catch(error => {
      console.error('[Delete Match] Regular Firebase error:', error);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to delete match.' });
      }, 0);
    });
};

// Helper function to perform REST API delete match with associated data
const performRestApiDeleteMatchWithAssociatedData = async (
  matchId: string,
  restApiAuth: { idToken: string },
  callback: Function
) => {
  try {
    // 1. Get the match data first
    const matchUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/matches/${matchId}`;
    const matchResponse = await fetch(matchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${restApiAuth.idToken}`,
      },
    });

    if (!matchResponse.ok) {
      if (matchResponse.status === 404) {
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Match not found.' });
        }, 0);
        return;
      }
      throw new Error('Failed to fetch match data');
    }

    const matchDoc = await matchResponse.json();
    const matchData: { [key: string]: any } = {};
    
    // Convert Firestore REST API format to regular object
    if (matchDoc.fields) {
      Object.keys(matchDoc.fields).forEach(key => {
        const field = matchDoc.fields[key];
        if (field.stringValue !== undefined) {
          matchData[key] = field.stringValue;
        } else if (field.integerValue !== undefined) {
          matchData[key] = parseInt(field.integerValue);
        } else if (field.booleanValue !== undefined) {
          matchData[key] = field.booleanValue;
        } else if (field.timestampValue !== undefined) {
          matchData[key] = new Date(field.timestampValue);
        }
      });
    }

    const leagueId: string | undefined = matchData?.leagueId;
    const teamAId: string | undefined = matchData?.teamAId;
    const teamBId: string | undefined = matchData?.teamBId;
    const topScorePlayerId: string | undefined = matchData?.topScorePlayerId;

    // 2. Delete all player stats associated with this match
    console.log('[Delete Match] Deleting player stats via REST API...');
    await deleteDocumentsByQuery('playerStats', { field: 'matchId', op: 'EQUAL', value: matchId }, restApiAuth);

    // 3. Update team league stats using updateTeam (which supports both user types)
    console.log('[Delete Match] Updating team league stats...');
    if (leagueId && teamAId && teamBId) {
      const teamUpdatePromises = [teamAId, teamBId].map(async (teamId: string) => {
        // Get team data via REST API
        const teamUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/teams/${teamId}`;
        const teamResponse = await fetch(teamUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${restApiAuth.idToken}`,
          },
        });

        if (!teamResponse.ok) {
          console.warn(`[Delete Match] Team ${teamId} not found, skipping update`);
          return;
        }

        const teamDoc = await teamResponse.json();
        const teamData: any = { id: teamId };
        
        // Convert Firestore REST API format to regular object
        if (teamDoc.fields) {
          Object.keys(teamDoc.fields).forEach(key => {
            const field = teamDoc.fields[key];
            if (field.stringValue !== undefined) {
              teamData[key] = field.stringValue;
            } else if (field.integerValue !== undefined) {
              teamData[key] = parseInt(field.integerValue);
            } else if (field.mapValue !== undefined) {
              // Handle nested objects (like leagueStats)
              const mapData: any = {};
              if (field.mapValue.fields) {
                Object.keys(field.mapValue.fields).forEach(mapKey => {
                  const mapField = field.mapValue.fields[mapKey];
                  if (mapField.mapValue?.fields) {
                    // Nested map (leagueStats[leagueId])
                    const nestedMap: any = {};
                    Object.keys(mapField.mapValue.fields).forEach(nestedKey => {
                      const nestedField = mapField.mapValue.fields[nestedKey];
                      if (nestedField.integerValue !== undefined) {
                        nestedMap[nestedKey] = parseInt(nestedField.integerValue);
                      }
                    });
                    mapData[mapKey] = nestedMap;
                  }
                });
              }
              teamData[key] = mapData;
            }
          });
        }

        const leagueStats = teamData?.leagueStats || {};
        const currentLeagueStats = leagueStats[leagueId] || { games: 0, wins: 0, losses: 0 };
        
        // Decrease games count
        const newGames = Math.max(0, currentLeagueStats.games - 1);
        
        // Determine if this team won or lost
        const teamAScore = matchData?.teamAScore || 0;
        const teamBScore = matchData?.teamBScore || 0;
        const isTeamA = teamId === teamAId;
        const teamWon = isTeamA ? teamAScore > teamBScore : teamBScore > teamAScore;
        
        // Update wins/losses
        let newWins = currentLeagueStats.wins;
        let newLosses = currentLeagueStats.losses;
        
        if (newGames > 0) {
          if (teamWon) {
            newWins = Math.max(0, newWins - 1);
          } else {
            newLosses = Math.max(0, newLosses - 1);
          }
        } else {
          newWins = 0;
          newLosses = 0;
        }
        
        const updatedLeagueStats = {
          ...leagueStats,
          [leagueId]: {
            games: newGames,
            wins: newWins,
            losses: newLosses
          }
        };
        
        // Update team via REST API
        const teamUpdateUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/teams/${teamId}`;
        
        // Convert leagueStats to Firestore REST API format
        const leagueStatsFields: any = {};
        Object.keys(updatedLeagueStats).forEach(leagueKey => {
          const leagueStat = updatedLeagueStats[leagueKey];
          leagueStatsFields[leagueKey] = {
            mapValue: {
              fields: {
                games: { integerValue: leagueStat.games.toString() },
                wins: { integerValue: leagueStat.wins.toString() },
                losses: { integerValue: leagueStat.losses.toString() }
              }
            }
          };
        });
        
        const updateFields = {
          leagueStats: {
            mapValue: {
              fields: leagueStatsFields
            }
          }
        };
        
        const updateMask = 'leagueStats';
        
        return fetch(`${teamUpdateUrl}?updateMask.fieldPaths=${encodeURIComponent(updateMask)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${restApiAuth.idToken}`,
          },
          body: JSON.stringify({ fields: updateFields }),
        }).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json();
            console.warn(`[Delete Match] Failed to update team ${teamId}:`, errorData);
            throw new Error(errorData.error?.message || 'Failed to update team');
          }
          console.log(`[Delete Match] Updated league stats for team: ${teamId}`);
        }).catch(error => {
          console.warn(`[Delete Match] Error updating team ${teamId}:`, error);
        });
      });
      
      await Promise.all(teamUpdatePromises);
      console.log(`[Delete Match] Updated league stats for teams: ${teamAId}, ${teamBId}`);
    }

    // 4. Finally, delete the match document itself
    console.log('[Delete Match] Deleting match document via REST API...');
    await deleteDocument('matches', matchId, restApiAuth);
    console.log('[Delete Match] Match and all associated data deleted successfully!');
    
    setTimeout(() => {
      callback({ 
        isSuccess: true, 
        value: 'Match and all associated data deleted successfully!' 
      });
    }, 0);
  } catch (error: any) {
    console.error('[Delete Match] Error during comprehensive match deletion:', error);
    setTimeout(() => {
      callback({ 
        isSuccess: false, 
        value: `Failed to delete match and associated data: ${error.message || 'Unknown error'}. Some data may have been partially deleted.` 
      });
    }, 0);
  }
};

// Helper function to perform regular Firebase delete match with associated data
const performRegularFirebaseDeleteMatchWithAssociatedData = async (
  matchId: string,
  callback: Function
) => {
  try {
    // Get the match data first
    const db = getFirestore();
    const matchDoc = await getDoc(doc(collection(db, 'matches'), matchId));
    
    if (!matchDoc.exists()) {
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Match not found.' });
      }, 0);
      return;
    }

    const matchData = matchDoc.data() as { [key: string]: any };
    const leagueId: string | undefined = matchData?.leagueId;
    const teamAId: string | undefined = matchData?.teamAId;
    const teamBId: string | undefined = matchData?.teamBId;
    const topScorePlayerId: string | undefined = matchData?.topScorePlayerId;

    // 1. Delete all player stats associated with this match
    console.log('[Delete Match] Deleting player stats...');
    const playerStatsSnapshot = await getDocs(query(collection(db, 'playerStats'), where('matchId', '==', matchId)));
    const playerStatsDeletionPromises = playerStatsSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
    await Promise.all(playerStatsDeletionPromises);
    console.log(`[Delete Match] Deleted ${playerStatsSnapshot.size} player stats`);

    // 2. Update team league stats
    console.log('[Delete Match] Updating team league stats...');
    if (leagueId && teamAId && teamBId) {
      const teamUpdatePromises = [teamAId, teamBId].map(async (teamId: string) => {
        const teamDoc = await getDoc(doc(collection(db, 'teams'), teamId));
        if (teamDoc.exists()) {
          const teamData = teamDoc.data() as any;
          const leagueStats = teamData?.leagueStats || {};
          const currentLeagueStats = leagueStats[leagueId] || { games: 0, wins: 0, losses: 0 };
          
          const newGames = Math.max(0, currentLeagueStats.games - 1);
          const teamAScore: number = matchData?.teamAScore || 0;
          const teamBScore: number = matchData?.teamBScore || 0;
          const isTeamA = teamId === teamAId;
          const teamWon = isTeamA ? teamAScore > teamBScore : teamBScore > teamAScore;
          
          let newWins = currentLeagueStats.wins;
          let newLosses = currentLeagueStats.losses;
          
          if (newGames > 0) {
            if (teamWon) {
              newWins = Math.max(0, newWins - 1);
            } else {
              newLosses = Math.max(0, newLosses - 1);
            }
          } else {
            newWins = 0;
            newLosses = 0;
          }
          
          const updatedLeagueStats = {
            ...leagueStats,
            [leagueId]: {
              games: newGames,
              wins: newWins,
              losses: newLosses
            }
          };
          
          await updateDoc(doc(collection(db, 'teams'), teamId), {
            leagueStats: updatedLeagueStats
          });
        }
      });
      await Promise.all(teamUpdatePromises);
      console.log(`[Delete Match] Updated league stats for teams: ${teamAId}, ${teamBId}`);
    }

    // 3. Finally, delete the match document itself
    console.log('[Delete Match] Deleting match document...');
    await deleteDoc(doc(collection(db, 'matches'), matchId));
    console.log('[Delete Match] Match and all associated data deleted successfully!');
    
    setTimeout(() => {
      callback({ 
        isSuccess: true, 
        value: 'Match and all associated data deleted successfully!' 
      });
    }, 0);
  } catch (error: any) {
    console.error('[Delete Match] Error during comprehensive match deletion:', error);
    setTimeout(() => {
      callback({ 
        isSuccess: false, 
        value: `Failed to delete match and associated data: ${error.message || 'Unknown error'}. Some data may have been partially deleted.` 
      });
    }, 0);
  }
};

export default {
  uploadImage: async (localUri: string, firebaseFilePathAndName: string) => {
    try {
      // Check if user is Apple Sign In user
      const hasFirebaseSession = !!getAuth().currentUser;
      const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
      
      // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
      let restApiAuth = (CMGlobal as any).restApiAuth;
      
      // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
      if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
        console.log('[Upload Image] Apple Sign In user detected, loading auth from AsyncStorage...');
        return new Promise((resolve) => {
          CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
            if (isSuccess && storedAuth && storedAuth.idToken) {
              restApiAuth = storedAuth;
              (CMGlobal as any).restApiAuth = storedAuth;
              console.log('[Upload Image] Loaded restApiAuth from AsyncStorage');
              performRestApiUploadImage(localUri, firebaseFilePathAndName, restApiAuth)
                .then(resolve)
                .catch((error: any) => {
                  resolve({ isSuccess: false, value: { message: error.message || 'Failed to upload image', originalError: error } });
                });
            } else {
              console.warn('[Upload Image] Apple Sign In user but no stored auth token. Cannot upload via REST API.');
              // Fallback to regular Firebase (will likely fail)
              performRegularFirebaseUploadImage(localUri, firebaseFilePathAndName)
                .then(resolve)
                .catch((error: any) => {
                  resolve({ isSuccess: false, value: { message: error.message || 'Failed to upload image', originalError: error } });
                });
            }
          });
        });
      }
      
      console.log('[Upload Image] Auth check:', {
        hasRestApiAuth: !!restApiAuth,
        hasIdToken: !!(restApiAuth?.idToken),
        hasFirebaseSession,
        isAppleSignInUser
      });
      
      // If we detect Apple Sign In user and have restApiAuth, use REST API
      if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
        console.log('[Upload Image] Using Firebase Storage REST API for Apple Sign In user');
        return await performRestApiUploadImage(localUri, firebaseFilePathAndName, restApiAuth);
      }
      
      // Regular Firebase auth users
      console.log('[Upload Image] Using React Native Firebase Storage (regular auth user)');
      return await performRegularFirebaseUploadImage(localUri, firebaseFilePathAndName);
    } catch (error: any) {
      let errorMessage = 'Failed to upload image.';
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You do not have permission to upload images.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Image upload was canceled.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'Unknown error occurred during image upload.';
      } else if (error.message) {
        errorMessage = `Image upload error: ${error.message}`;
      }
      return { isSuccess: false, value: { message: errorMessage, originalError: error } };
    }
  },

  register: (email: string, password: string, callback: Function) => {
    createUserWithEmailAndPassword(getAuth(), email, password)
      .then(() => {
        callback({ isSuccess: true, value: getAuth().currentUser });
      })
      .catch(error => {
        let message = '';
        switch (error.code) {
          case 'auth/email-already-in-use': {
            message = 'Email address is already in use.';
            break;
          }
          case 'auth/invalid-email': {
            message = 'Email address is invalid.';
            break;
          }
          default: {
            message = 'You can not register now.';
          }
        }
        callback({ isSuccess: false, value: message });
      });
  },

  login: (email: string, password: string, callback: Function) => {
    signInWithEmailAndPassword(getAuth(), email, password)
      .then(() => {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
          callback({ isSuccess: false, value: 'Failed to authenticate. Please try again.' });
          return;
        }
        
        getUser(
          currentUser.uid,
          (response: { [name: string]: any }) => {
            if (response.isSuccess) {
              CMGlobal.user = response.value;
              callback({ isSuccess: true, value: currentUser });
            } else {
              // Sign out if we can't get user data to prevent inconsistent state
              getAuth().signOut().catch(() => {});
              callback({
                isSuccess: false,
                value: response.value || 'Failed to load user information. Please try again.',
              });
            }
          },
        );
      })
      .catch(error => {
        console.error('Login error:', error);
        let message = '';
        switch (error.code) {
          case 'auth/user-not-found': {
            message = 'No account with your email.';
            break;
          }
          case 'auth/wrong-password': {
            message = 'Password is wrong.';
            break;
          }
          case 'auth/network-request-failed': {
            message = 'Network error. Please check your internet connection and try again.';
            break;
          }
          case 'auth/too-many-requests': {
            message = 'Too many failed attempts. Please try again later.';
            break;
          }
          default: {
            message = 'You can not login now. Please try again.';
          }
        }
        callback({ isSuccess: false, value: message });
      });
  },

  forgotPassword: (email: string, callback: Function) => {
    sendPasswordResetEmail(getAuth(), email)
      .then(() => {
        callback({
          isSuccess: true,
          value: 'Password reset link has been sent to your email.',
        });
      })
      .catch(error => {
        console.log(error.code);
        let message = '';
        switch (error.code) {
          case 'auth/user-not-found': {
            message = 'No account with your email.';
            break;
          }
          default: {
            message = 'You can not reset password now.';
          }
        }
        callback({ isSuccess: false, value: message });
      });
  },

  /**
   * Sign in with Apple
   * Handles both registration (if new user) and login (if existing user)
   * @param callback - Callback function with response
   */
  signInWithApple: async (callback: Function) => {
    try {
      // Ensure callback is a function
      if (typeof callback !== 'function') {
        CMAlertDlgHelper.showAlertWithOK('Internal Error: Callback is not a function');
        return;
      }

      if (Platform.OS !== 'ios') {
        callback({ isSuccess: false, value: 'Apple Sign In is only available on iOS.' });
        return;
      }

      // Check if appleAuth is available (already imported at top of file)
      if (!appleAuth) {
        const errorMsg = 'Apple Sign In module not found. Please ensure @invertase/react-native-apple-authentication is installed and run "cd ios && pod install".';
        CMAlertDlgHelper.showAlertWithOK(errorMsg);
        callback({ isSuccess: false, value: errorMsg });
        return;
      }

      if (typeof appleAuth.performRequest !== 'function') {
        const errorMsg = 'Apple Sign In is not properly configured. Please run "cd ios && pod install" to link the native module.';
        CMAlertDlgHelper.showAlertWithOK(errorMsg);
        callback({ isSuccess: false, value: errorMsg });
        return;
      }

      // Check if Apple Sign In is supported on this device
      if (!appleAuth.isSupported) {
        const errorMsg = 'Apple Sign In is not supported on this device.';
        CMAlertDlgHelper.showAlertWithOK(errorMsg);
        callback({ isSuccess: false, value: errorMsg });
        return;
      }

      // Generate a random nonce for security
      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Request Apple authentication using performRequest
      let appleAuthRequestResponse;
      try {
        appleAuthRequestResponse = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN, // LOGIN works for both new and existing users
          requestedScopes: [
            appleAuth.Scope.FULL_NAME,
            appleAuth.Scope.EMAIL,
          ],
          nonce: nonce,
        });
      } catch (authError: any) {
        // Log to console for debugging
        console.error('[Apple Sign In] performRequest error:', authError);
        console.error('[Apple Sign In] Error code:', authError.code);
        console.error('[Apple Sign In] Error message:', authError.message);
        console.error('[Apple Sign In] Full error:', JSON.stringify(authError, null, 2));
        
        // Handle specific Apple error codes
        if (authError.code === '1001' || authError.code === appleAuth.Error?.CANCELED) {
          const errorMsg = 'Apple Sign In was cancelled.';
          console.log('[Apple Sign In] User cancelled - this is normal if user taps cancel');
          // Don't show alert for cancellation - it's user action
          callback({ isSuccess: false, value: errorMsg });
          return;
        } else if (authError.code === '1000') {
          const errorMsg = 'Apple Sign In failed. Please ensure "Sign In with Apple" capability is enabled in Xcode under Signing & Capabilities.';
          console.error('[Apple Sign In] Configuration error:', errorMsg);
          CMAlertDlgHelper.showAlertWithOK(`Error Code: ${authError.code}\n${errorMsg}`);
          callback({ isSuccess: false, value: errorMsg });
          return;
        } else if (authError.message) {
          const errorMsg = `Apple Sign In error: ${authError.message}`;
          console.error('[Apple Sign In] Error:', errorMsg);
          CMAlertDlgHelper.showAlertWithOK(`Error Code: ${authError.code || 'Unknown'}\n${errorMsg}`);
          callback({ isSuccess: false, value: errorMsg });
          return;
        } else {
          const errorMsg = 'Apple Sign In failed. Please check your Xcode configuration.';
          console.error('[Apple Sign In] Unknown error:', errorMsg);
          CMAlertDlgHelper.showAlertWithOK(`Error Code: ${authError.code || 'Unknown'}\n${errorMsg}`);
          callback({ isSuccess: false, value: errorMsg });
          return;
        }
      }

      // Check if authentication was successful
      if (!appleAuthRequestResponse || !appleAuthRequestResponse.identityToken) {
        const errorMsg = 'Apple Sign In was cancelled or failed. No identity token received.';
        console.error('[Apple Sign In] No identity token:', {
          hasResponse: !!appleAuthRequestResponse,
          hasIdentityToken: !!appleAuthRequestResponse?.identityToken,
          response: appleAuthRequestResponse
        });
        CMAlertDlgHelper.showAlertWithOK(errorMsg);
        callback({ isSuccess: false, value: errorMsg });
        return;
      }
      
      console.log('[Apple Sign In] Apple authentication successful:', {
        hasIdentityToken: !!appleAuthRequestResponse.identityToken,
        hasEmail: !!appleAuthRequestResponse.email,
        hasFullName: !!appleAuthRequestResponse.fullName,
        user: appleAuthRequestResponse.user || 'N/A'
      });

      // Create Apple credential for Firebase
      const { identityToken } = appleAuthRequestResponse;
      const fullName = appleAuthRequestResponse.fullName
        ? `${appleAuthRequestResponse.fullName.givenName || ''} ${appleAuthRequestResponse.fullName.familyName || ''}`.trim()
        : '';
      
      // Validate identity token
      if (!identityToken || typeof identityToken !== 'string') {
        const errorMsg = 'Invalid identity token received from Apple. Please try again.';
        console.error('[Apple Sign In] Invalid identity token:', {
          hasToken: !!identityToken,
          tokenType: typeof identityToken,
          tokenLength: identityToken?.length || 0
        });
        CMAlertDlgHelper.showAlertWithOK(errorMsg);
        callback({ isSuccess: false, value: errorMsg });
        return;
      }
      
      console.log('[Apple Sign In] Creating Firebase credential with nonce length:', nonce.length);

      // Use Firebase REST API to sign in with Apple
      // This bypasses both React Native Firebase and native SDK limitations
      try {
        console.log('[Apple Sign In] Using Firebase REST API to sign in...');
        
        // Get Firebase API key from GoogleService-Info.plist (via React Native Firebase)
        const auth = getAuth();
        const apiKey = 'AIzaSyDO1HYPPRbxEhSBLsiwEQAV9ZN0Mpw1HHk'; // From GoogleService-Info.plist
        
        // Firebase Identity Toolkit REST API endpoint
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
        
        // Prepare the request body
        const requestBody = {
          requestUri: 'https://statx-a9bfe.firebaseapp.com/__/auth/handler',
          postBody: `id_token=${encodeURIComponent(identityToken)}&providerId=apple.com&nonce=${encodeURIComponent(nonce)}`,
          returnSecureToken: true,
          returnIdpCredential: true,
        };
        
        console.log('[Apple Sign In] Calling Firebase REST API...');
        
        // Make the REST API call
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
          const errorMsg = data.error?.message || 'Firebase REST API sign-in failed';
          const errorCode = data.error?.code || 'UNKNOWN';
          console.error('[Apple Sign In] Firebase REST API error:', errorCode, errorMsg);
          CMAlertDlgHelper.showAlertWithOK(`Firebase Sign In Error (${errorCode}):\n${errorMsg}\n\nPlease ensure:\n1. Apple Sign In is enabled in Firebase Console\n2. Service ID matches in both consoles\n3. OAuth redirect URI is configured correctly`);
          callback({ isSuccess: false, value: errorMsg });
          return;
        }
        
        console.log('[Apple Sign In] Firebase REST API sign in successful');
        
        // The REST API response contains user info and idToken
        if (!data.idToken) {
          throw new Error('No ID token received from Firebase REST API');
        }
        
        const userId = data.localId || data.uid;
        const email = data.email || '';
        const idToken = data.idToken;
        
        console.log('[Apple Sign In] User authenticated via REST API:', {
          userId: userId,
          email: email
        });
        
        // IMPORTANT: Check Firestore first to see if a user with this email already exists
        // This prevents creating duplicate users when email exists in Authentication but user document doesn't exist
        // or when email exists in Firestore but with a different userId
        console.log('[Apple Sign In] Checking Firestore for existing user with email:', email);
        
        // Query Firestore REST API to find user by email
        const queryUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents:runQuery`;
        
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'email' },
                op: 'EQUAL',
                value: { stringValue: email }
              }
            },
            limit: 1
          }
        };
        
        let existingUserFound = false;
        let existingUserId = userId; // Default to the userId from Firebase Auth
        let existingUserData: any = null;
        
        try {
          const queryResponse = await fetch(queryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify(queryBody),
          });
          
          if (queryResponse.ok) {
            const queryData = await queryResponse.json();
            console.log('[Apple Sign In] Firestore query response:', queryData);
            
            // Check if we found any documents
            if (queryData && Array.isArray(queryData) && queryData.length > 0 && queryData[0].document) {
              const document = queryData[0].document;
              existingUserFound = true;
              
              // Extract user ID from document path (e.g., "projects/.../databases/.../documents/users/USER_ID")
              const pathParts = document.name.split('/');
              existingUserId = pathParts[pathParts.length - 1];
              
              // Convert Firestore REST API format to regular object
              if (document.fields) {
                existingUserData = {};
                Object.keys(document.fields).forEach(key => {
                  const field = document.fields[key];
                  if (field.stringValue !== undefined) {
                    existingUserData[key] = field.stringValue;
                  } else if (field.integerValue !== undefined) {
                    existingUserData[key] = parseInt(field.integerValue);
                  } else if (field.booleanValue !== undefined) {
                    existingUserData[key] = field.booleanValue;
                  } else if (field.timestampValue !== undefined) {
                    existingUserData[key] = new Date(field.timestampValue);
                  } else if (field.nullValue !== undefined) {
                    existingUserData[key] = null;
                  }
                });
              }
              
              console.log('[Apple Sign In] Existing user found in Firestore:', {
                userId: existingUserId,
                email: existingUserData?.email,
                name: existingUserData?.name
              });
            } else {
              console.log('[Apple Sign In] No existing user found in Firestore with this email');
            }
          } else {
            console.warn('[Apple Sign In] Firestore query failed, will proceed with userId from Firebase Auth');
          }
        } catch (queryError: any) {
          console.warn('[Apple Sign In] Error querying Firestore for existing user:', queryError);
          // Continue with userId from Firebase Auth if query fails
        }
        
        // If we found an existing user, use their data instead of creating new
        if (existingUserFound && existingUserData) {
          console.log('[Apple Sign In] Loading existing user data from Firestore');
          CMGlobal.user = existingUserData;
          
          // Store the idToken for future use
          const storedAuth = {
            idToken: idToken,
            refreshToken: data.refreshToken || '',
            userId: existingUserId, // Use the existing user's ID
            email: email,
          };
          (CMGlobal as any).restApiAuth = storedAuth;
          CMLocalStorageHelper.setAppleSignInAuth(storedAuth);
          
          // Save user credentials locally for auto-login (like regular users)
          CMLocalStorageHelper.setUserCredentials({
            isAppleSignIn: true,
            userId: existingUserId,
            email: email,
            name: existingUserData.name || fullName || 'User'
          });
          
          const mockUser = {
            uid: existingUserId,
            email: email,
            displayName: existingUserData.name || fullName || 'User',
            getIdToken: async () => idToken,
          };
          
          callback({ 
            isSuccess: true, 
            value: mockUser, 
            isNewUser: false
          });
          return;
        }
        
        // No existing user found - create new user
        console.log('[Apple Sign In] No existing user found, creating new user profile');
        
        // New user - create user profile using Firestore REST API with authenticated idToken
        // Extract name from Apple Sign In response - use givenName, familyName, or email prefix as fallback
        let userName = fullName;
        if (!userName || userName.trim() === '') {
          // Try to get name from email if fullName is not provided
          if (email) {
            const emailPrefix = email.split('@')[0];
            userName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
          } else {
            userName = 'User';
          }
        }
        
        const userData = {
          id: userId,
          email: email || appleAuthRequestResponse.email || '',
          name: userName.trim(),
          role: 'coach',
        };
        
        console.log('[Apple Sign In] User name extracted:', { fullName, userName: userData.name, email });

        console.log('[Apple Sign In] Saving new user to Firestore via REST API:', { userId: userId, email: userData.email });
        
        // Use Firestore REST API to write with the authenticated idToken
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/users/${userId}`;
        
        try {
          const requestBody = {
            fields: {
              id: { stringValue: userData.id },
              email: { stringValue: userData.email },
              name: { stringValue: userData.name },
              role: { stringValue: userData.role },
            }
          };
          
          console.log('[Apple Sign In] Creating user document via REST API:', {
            url: firestoreUrl,
            userId: userId,
            userData: userData,
            requestBody: JSON.stringify(requestBody, null, 2)
          });
          
          const firestoreResponse = await fetch(firestoreUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify(requestBody),
          });
          
          const responseText = await firestoreResponse.text();
          console.log('[Apple Sign In] Firestore REST API response status:', firestoreResponse.status, firestoreResponse.statusText);
          console.log('[Apple Sign In] Firestore REST API response body:', responseText);
          
          if (!firestoreResponse.ok) {
            let firestoreError;
            try {
              firestoreError = JSON.parse(responseText);
            } catch (e) {
              firestoreError = { error: { message: responseText } };
            }
            console.error('[Apple Sign In] Firestore REST API error response:', firestoreError);
            throw new Error(firestoreError.error?.message || `Firestore REST API write failed with status ${firestoreResponse.status}`);
          }
          
          // Verify the document was created by reading it back
          try {
            const verifyResponse = await fetch(firestoreUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
            });
            
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              console.log('[Apple Sign In] User document verified in Firestore:', verifyData);
            } else {
              console.warn('[Apple Sign In] Could not verify user document creation (status:', verifyResponse.status, ')');
            }
          } catch (verifyError) {
            console.warn('[Apple Sign In] Error verifying user document:', verifyError);
          }
          
          console.log('[Apple Sign In] User profile saved successfully via REST API');
          CMGlobal.user = userData;
          
          // Store the idToken for future use (in both CMGlobal and AsyncStorage for persistence)
          const storedAuth = {
            idToken: idToken,
            refreshToken: data.refreshToken || '',
            userId: userId,
            email: email,
          };
          (CMGlobal as any).restApiAuth = storedAuth;
          // Also store in AsyncStorage so it persists across app sessions
          CMLocalStorageHelper.setAppleSignInAuth(storedAuth);
          
          // Save user credentials locally for auto-login (like regular users)
          CMLocalStorageHelper.setUserCredentials({
            isAppleSignIn: true,
            userId: userId,
            email: email,
            name: userName.trim()
          });
          
          console.log('[Apple Sign In] User saved to Firestore and local storage. User can now use the app.');
          
          // Create user object for callback
          const userObject = {
            uid: userId,
            email: email,
            displayName: userName.trim(),
            getIdToken: async () => idToken,
          };
          
          callback({ 
            isSuccess: true, 
            value: userObject, 
            isNewUser: true
          });
        } catch (firestoreError: any) {
          const errorMsg = `Failed to save user to Firestore: ${firestoreError.message || 'Unknown error'}`;
          console.error('[Apple Sign In] Firestore REST API save error:', firestoreError);
          
          // Try fallback to regular Firestore (might work if rules allow)
          try {
            await setDoc(doc(collection(getFirestore(), 'users'), userId), userData);
            console.log('[Apple Sign In] User profile saved via fallback method');
            CMGlobal.user = userData;
            const mockUser = {
              uid: userId,
              email: email,
              displayName: userName.trim(),
            };
            callback({ isSuccess: true, value: mockUser, isNewUser: true });
          } catch (fallbackError: any) {
            console.error('[Apple Sign In] Fallback Firestore save also failed:', fallbackError);
            CMAlertDlgHelper.showAlertWithOK(`Firestore Error:\n${errorMsg}\n\nUser is authenticated but profile creation failed. You may need to update Firestore security rules.`);
            CMGlobal.user = userData;
            const mockUser = {
              uid: userId,
              email: email,
              displayName: userName.trim(),
            };
            callback({ 
              isSuccess: true, 
              value: mockUser, 
              isNewUser: true,
              warning: 'User created but profile save had issues. Please check your Firestore permissions.' 
            });
          }
        }
        return;
      } catch (firebaseError: any) {
        let errorMsg = `Firebase authentication failed: ${firebaseError.message || 'Unknown error'}`;
        const errorCode = firebaseError.code || 'Unknown';
        
        // Log detailed error to console
        console.error('[Apple Sign In] Firebase sign in error:', firebaseError);
        console.error('[Apple Sign In] Firebase error code:', errorCode);
        console.error('[Apple Sign In] Firebase error message:', firebaseError.message);
        console.error('[Apple Sign In] Full Firebase error:', JSON.stringify(firebaseError, null, 2));
        
        // Provide specific guidance based on error code
        if (errorCode === 'auth/operation-not-allowed') {
          errorMsg = 'Apple Sign In is not enabled in Firebase Console.\n\nPlease enable it:\n1. Go to Firebase Console\n2. Authentication > Sign-in method\n3. Enable Apple provider';
        } else if (errorCode === 'auth/internal-error') {
          errorMsg = 'Firebase internal error. This usually means:\n\n1. Apple Sign In is not enabled in Firebase Console:\n   - Go to Firebase Console\n   - Authentication > Sign-in method\n   - Enable Apple provider\n   - Configure Service ID and OAuth redirect URI\n\n2. Service ID mismatch:\n   - Check that your Service ID in Apple Developer Console matches Firebase\n   - Verify the OAuth redirect URI is correct\n\n3. Bundle ID mismatch:\n   - Ensure bundle ID in Xcode matches Firebase app configuration\n   - Current bundle ID: com.chmpst.chmpst\n\nPlease check Firebase Console configuration.';
        } else if (errorCode === 'auth/invalid-credential') {
          errorMsg = 'Invalid Apple credential. This may happen if:\n1. The Service ID is not configured correctly\n2. The redirect URI doesn\'t match\n3. The credential has expired';
        } else if (errorCode === 'auth/unauthorized-domain') {
          errorMsg = 'Unauthorized domain. Please check Firebase Console settings.';
        }
        
        CMAlertDlgHelper.showAlertWithOK(`Firebase Error (${errorCode}):\n${errorMsg}`);
        callback({ 
          isSuccess: false, 
          value: errorMsg 
        });
        return;
      }
    } catch (error: any) {
      // Sign out on error to prevent inconsistent state
      try {
        if (getAuth().currentUser) {
          getAuth().signOut().catch(() => {});
        }
      } catch (signOutError) {
        // Ignore sign out errors
      }
      
      let message = 'Failed to sign in with Apple.';
      
      // Handle specific error codes
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === '1001' || error.code === appleAuth?.Error?.CANCELED) {
        message = 'Apple Sign In was cancelled.';
      } else if (error.code === '1000') {
        message = 'Apple Sign In configuration error. Please ensure:\n1. "Sign In with Apple" capability is enabled in Xcode\n2. Your app is properly configured in Apple Developer Console\n3. You are signed in with a valid Apple ID on this device.';
      } else if (error.code === '1002') {
        message = 'Apple Sign In received an invalid response. Please try again.';
      } else if (error.code === '1003') {
        message = 'Apple Sign In request was not handled. Please check your configuration.';
      } else if (error.code === '1004') {
        message = 'Apple Sign In failed. Please try again.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        message = `Apple Sign In error: ${error.message}`;
      }
      
      const fullErrorMsg = `Unexpected Error (${error.code || 'Unknown'}):\n${message}\n\nError details: ${error.message || 'No details available'}`;
      CMAlertDlgHelper.showAlertWithOK(fullErrorMsg);
      callback({ isSuccess: false, value: message });
    }
  },

  updateUserEmail: (email: string, callback: Function) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      callback({ isSuccess: false, value: 'User not found. Please sign in again.' });
      return;
    }
    // For Apple Sign In users, email update is handled via Firestore REST API
    if (CMGlobal.user?.id && !getAuth().currentUser) {
      // Update email in Firestore directly
      updateUser(CMGlobal.user.id, { email: email }, (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          CMGlobal.user = { ...CMGlobal.user, email: email };
          callback({ isSuccess: true, value: 'Email has been updated.' });
        } else {
          callback({ isSuccess: false, value: 'Can not update email at the moment.' });
        }
      });
      return;
    }
    // Type assertion: currentUser is guaranteed to be Firebase User here
    updateEmail(currentUser as any, email)
      .then(() => {
        callback({ isSuccess: true, value: 'Email has been updated.' });
      })
      .catch(error => {
        callback({
          isSuccess: false,
          value: 'Can not update email at the moment.',
        });
      });
  },

  updateUserPassword: (password: string, callback: Function) => {
    const currentUser = getCurrentUser();
    if (!currentUser || !getAuth().currentUser) {
      callback({ isSuccess: false, value: 'Password update is not available for Apple Sign In users.' });
      return;
    }
    // Type assertion: currentUser is guaranteed to be Firebase User here
    updatePassword(currentUser as any, password)
      .then(() => {
        callback({ isSuccess: true, value: 'Password has been changed.' });
      })
      .catch(error => {
        callback({
          isSuccess: false,
          value: 'Can not change password at the moment.',
        });
      });
  },

  
  getLastThreeGamesStats: (playerId: string, callback: Function) => {
    const playerStatsQuery = query(
      collection(getFirestore(), 'playerStats'),
      where('playerId', '==', playerId),
      orderBy('dayTime', 'desc'),
      limit(3)
    );
    getDocs(playerStatsQuery)
      .then(querySnapshot => {
        const games: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          games.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: games });
      })
      .catch(error => {
        // If orderBy fails, try without it and sort manually
        const playerStatsQueryFallback = query(collection(getFirestore(), 'playerStats'), where('playerId', '==', playerId));
        getDocs(playerStatsQueryFallback)
          .then(querySnapshot => {
            const games: { [name: string]: any }[] = [];
            querySnapshot.forEach((documentSnapshot: any) => {
              games.push(documentSnapshot.data());
            });
            // Sort by dayTime descending
            games.sort((a, b) => {
              const dateA = a.dayTime?.toDate?.() || new Date(0);
              const dateB = b.dayTime?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
            });
            callback({ isSuccess: true, value: games.slice(0, 3) });
          })
          .catch(error2 => {
            callback({
              isSuccess: false,
              value: 'Failed to load last games stats.',
            });
          });
      });
  },

  getPlayerSeasonStats: (playerId: string, callback: Function) => {
    const playerStatsQuery = query(collection(getFirestore(), 'playerStats'), where('playerId', '==', playerId));
    getDocs(playerStatsQuery)
      .then(querySnapshot => {
        let totalPoints = 0;
        let totalAssists = 0;
        let totalRebounds = 0;
        let totalBlocks = 0;
        let totalSteals = 0;
        let totalTurnovers = 0;
        let gameCount = 0;

        querySnapshot.forEach((documentSnapshot: any) => {
          const stat = documentSnapshot.data();
          totalPoints += stat.pointsPerGame || stat.points || 0;
          totalAssists += stat.assists || 0;
          totalRebounds += stat.rebounds || 0;
          totalBlocks += stat.blocks || 0;
          totalSteals += stat.steals || 0;
          totalTurnovers += stat.turnovers || 0;
          gameCount += 1;
        });

        const seasonStats = {
          points: totalPoints,
          assists: totalAssists,
          rebounds: totalRebounds,
          blocks: totalBlocks,
          steals: totalSteals,
          turnovers: totalTurnovers,
          gamesPlayed: gameCount,
          pointsPerGame: gameCount > 0 ? (totalPoints / gameCount).toFixed(1) : 0,
          assistsPerGame: gameCount > 0 ? (totalAssists / gameCount).toFixed(1) : 0,
          reboundsPerGame: gameCount > 0 ? (totalRebounds / gameCount).toFixed(1) : 0,
        };

        callback({ isSuccess: true, value: seasonStats });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load season stats.' });
      });
  },

  
  getMatch: (matchId: string, callback: Function) => {
    getDoc(doc(collection(getFirestore(), 'matches'), matchId))
      .then(documentSnapshot => {
        if (documentSnapshot.exists()) {
          callback({ isSuccess: true, value: documentSnapshot.data() });
        } else {
          callback({ isSuccess: false, value: 'Match not found.' });
        }
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load match.' });
      });
  },


  getNewDocumentId: (collectionName: string) => {
    const db = getFirestore();
    return doc(collection(db, collectionName)).id;
  },

  setUser: (user: { [name: string]: any }, callback: Function) => {
    setDoc(doc(collection(getFirestore(), 'users'), user.id), user)
      .then(() => {
        CMGlobal.user = user;
        callback({ isSuccess: true });
      })
      .catch(error => {
        callback({
          isSuccess: false,
          value: 'Failed to save user information.',
        });
      });
  },

  updateUser: updateUser,

  getUser: getUser,

  deleteUser: (callback: Function) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      callback({ isSuccess: false, value: 'User not found. Please sign in again.' });
      return;
    }
    updateUser(currentUserId, { deleted: true }, (response: { [name: string]: any }) => {
      if (response.isSuccess) {
        const firebaseUser = getAuth().currentUser;
        if (firebaseUser) {
          deleteUser(firebaseUser)
            .then(() => {
              callback({ isSuccess: true, value: 'User has been deleted.' });
            })
            .catch(error => {
              callback({
                isSuccess: false,
                value: 'Can not delete user at the moment.',
              });
            });
        } else {
          callback({
            isSuccess: false,
            value: 'Can not delete user at the moment.',
          });
        }
      } else {
        callback({
          isSuccess: false,
          value: 'Can not delete user at the moment.',
        });
      }
    });
  },

  /**
   * Add or update subscription for a user
   * @param userId - User ID
   * @param subscriptionData - Subscription data with paid, pay_date, expiration_date, subscriptionTier, maxTeams, etc.
   * @param callback - Callback function
   */
  addSubscriptionToUser: (userId: string, subscriptionData: { [name: string]: any }, callback: Function) => {
    const subscriptionUpdate = {
      paid: true,
      pay_date: subscriptionData.pay_date || Timestamp.fromDate(new Date()),
      expiration_date: subscriptionData.expiration_date || Timestamp.fromDate(new Date()),
      subscriptionTier: subscriptionData.subscriptionTier,
      subscriptionId: subscriptionData.subscriptionId,
      customerId: subscriptionData.customerId,
      paymentToken: subscriptionData.paymentToken,
      maxTeams: subscriptionData.maxTeams || 5, // Maximum number of teams allowed for this subscription
      updatedAt: Timestamp.now(),
    };

    updateUser(userId, subscriptionUpdate, (response: { [name: string]: any }) => {
      if (response.isSuccess) {
        callback({ isSuccess: true, value: 'Subscription added successfully!' });
      } else {
        callback({ isSuccess: false, value: 'Failed to add subscription.' });
      }
    });
  },

  /**
   * Get user subscription data
   * @param userId - User ID
   * @param callback - Callback function
   */
  getUserSubscription: (userId: string, callback: Function) => {
    getUser(userId, (response: { [name: string]: any }) => {
      if (response.isSuccess) {
        const userData = response.value;
        const subscription = {
          paid: userData.paid || false,
          pay_date: userData.pay_date,
          subscriptionTier: userData.subscriptionTier,
          subscriptionId: userData.subscriptionId,
          customerId: userData.customerId,
        };
        callback({ isSuccess: true, value: subscription });
      } else {
        callback({ isSuccess: false, value: 'Failed to get subscription data.' });
      }
    });
  },

  /**
   * Check if user has a valid subscription (paid and not expired)
   * Note: Admin users should bypass this check - this function only checks subscription validity
   * @param userId - User ID
   * @param callback - Callback function with isValid boolean
   */
  checkSubscriptionValid: (userId: string, callback: Function) => {
    // Get user subscription data
    getUser(userId, (response: { [name: string]: any }) => {
      if (response.isSuccess) {
        const userData = response.value;
        
        // If user is admin, they don't need subscription (but this check should be done before calling this function)
        // We'll still return true here to be safe, but admins should bypass this entirely
        if (userData.role === 'admin') {
          callback({ isSuccess: true, value: true }); // Admins are always valid
          return;
        }
        
        const subscription = {
          paid: userData.paid || false,
          expiration_date: userData.expiration_date,
          pay_date: userData.pay_date, // Keep for backward compatibility
        };
        
        // Check if user is paid
        if (!subscription.paid) {
          callback({ isSuccess: true, value: false });
          return;
        }

        // Check expiration_date first (primary check)
        if (subscription.expiration_date) {
          const expirationDate = subscription.expiration_date.toDate ? subscription.expiration_date.toDate() : new Date(subscription.expiration_date);
          const now = new Date();
          
          // Subscription is valid if expiration_date is in the future
          // If expiration_date has passed, subscription is expired and payment is required again
          const isValid = expirationDate > now;
          callback({ isSuccess: true, value: isValid });
          return;
        }

        // Fallback to pay_date if expiration_date doesn't exist (for backward compatibility)
        if (subscription.pay_date) {
          const payDate = subscription.pay_date.toDate ? subscription.pay_date.toDate() : new Date(subscription.pay_date);
          const now = new Date();
          
          // Subscription is valid if pay_date is in the future
          const isValid = payDate > now;
          callback({ isSuccess: true, value: isValid });
        } else {
          // No expiration_date or pay_date means subscription is invalid
          callback({ isSuccess: true, value: false });
        }
      } else {
        callback({ isSuccess: false, value: false });
      }
    });
  },

  createPlayer: (
    playerId: string,
    data: { [name: string]: any },
    callback?: Function,
  ) => {
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Create Player] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Create Player] Loaded restApiAuth from AsyncStorage');
          performRestApiCreatePlayer(playerId, data, restApiAuth, callback);
        } else {
          console.warn('[Create Player] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseCreatePlayer(playerId, data, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Create Player] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser,
      playerId
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Create Player] Using Firestore REST API for Apple Sign In user');
      performRestApiCreatePlayer(playerId, data, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Create Player] Using React Native Firebase (regular auth user)');
    performRegularFirebaseCreatePlayer(playerId, data, callback);
  },

  updatePlayer: (
    playerId: string,
    data: { [name: string]: any },
    callback?: Function,
  ) => {
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Update Player] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Update Player] Loaded restApiAuth from AsyncStorage');
          performRestApiUpdatePlayer(playerId, data, restApiAuth, callback);
        } else {
          console.warn('[Update Player] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseUpdatePlayer(playerId, data, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Update Player] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser,
      playerId
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Update Player] Using Firestore REST API for Apple Sign In user');
      performRestApiUpdatePlayer(playerId, data, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Update Player] Using React Native Firebase (regular auth user)');
    performRegularFirebaseUpdatePlayer(playerId, data, callback);
  },

  deletePlayerWithAssociatedData: (playerId: string, callback: Function) => {
    console.log('Starting comprehensive player deletion for:', playerId);
    
    // Get the player data first to access related information
    getDoc(doc(collection(getFirestore(), 'players'), playerId))
      .then(async (playerDoc) => {
        if (!playerDoc.exists()) {
          callback({ isSuccess: false, value: 'Player not found.' });
          return;
        }

        const playerData = (playerDoc.data() || {}) as { [name: string]: any };
        const teamId = playerData?.teamId;
        
        console.log('Player data to process:', {
          teamId
        });

        try {
          // 1. Delete all player stats associated with this player
          console.log('Deleting player stats...');
          const playerStatsQuery = query(collection(getFirestore(), 'playerStats'), where('playerId', '==', playerId));
          const playerStatsSnapshot = await getDocs(playerStatsQuery);
          
          const playerStatsDeletionPromises = playerStatsSnapshot.docs.map((playerStatDoc: any) => deleteDoc(playerStatDoc.ref));
          await Promise.all(playerStatsDeletionPromises);
          console.log(`Deleted ${playerStatsSnapshot.size} player stats`);

          // 2. Delete all player average stats associated with this player
          console.log('Deleting player average stats...');
          const playerAverageStatsQuery = query(collection(getFirestore(), 'playerAverageStats'), where('playerId', '==', playerId));
          const playerAverageStatsSnapshot = await getDocs(playerAverageStatsQuery);
          
          const playerAverageStatsDeletionPromises = playerAverageStatsSnapshot.docs.map((playerAverageStatDoc: any)  => deleteDoc(playerAverageStatDoc.ref));
          await Promise.all(playerAverageStatsDeletionPromises);
          console.log(`Deleted ${playerAverageStatsSnapshot.size} player average stats`);

          // 3. Update matches to remove topScorePlayerId references
          console.log('Updating matches...');
          const matchesQuery = query(collection(getFirestore(), 'matches'), where('topScorePlayerId', '==', playerId));
          const matchesSnapshot = await getDocs(matchesQuery);
          
          const matchUpdatePromises = matchesSnapshot.docs.map((matchDoc: any) => 
            updateDoc(matchDoc.ref, { 
              topScorePlayerId: null,
              topScore: 0
            })
          );
          await Promise.all(matchUpdatePromises);
          console.log(`Updated ${matchesSnapshot.size} matches`);

          // 4. Finally, delete the player document itself
          console.log('Deleting player document...');
          const db = getFirestore();
          await deleteDoc(doc(collection(db, 'players'), playerId));
          console.log('Player document deleted');

          console.log('Player and all associated data deleted successfully!');
          callback({ 
            isSuccess: true, 
            value: 'Player and all associated data deleted successfully!' 
          });

        } catch (error) {
          console.error('Error during comprehensive player deletion:', error);
          callback({ 
            isSuccess: false, 
            value: 'Failed to delete player and associated data. Some data may have been partially deleted.' 
          });
        }
      })
      .catch(error => {
        console.error('Error fetching player for deletion:', error);
        callback({ isSuccess: false, value: 'Failed to load player for deletion.' });
      });
  },

  addPlayerStat: (
    playerStatId: string,
    data: { [name: string]: any },
    callback?: Function,
  ) => {
    setDoc(doc(collection(getFirestore(), 'playerStats'), playerStatId), data)
      .then(() => {
        callback && callback({ isSuccess: true, value: 'Add successfully!' });
      })
      .catch(error => {
        callback && callback({ isSuccess: false, value: 'Failed to add.' });
      });
  },

  updatePlayerStat: (
    playerStatId: string,
    data: { [name: string]: any },
    callback?: Function,
  ) => {
    updateDoc(doc(collection(getFirestore(), 'playerStats'), playerStatId), data)
      .then(() => {
        callback &&
          callback({ isSuccess: true, value: 'Updated successfully!' });
      })
      .catch(error => {
        callback && callback({ isSuccess: false, value: 'Failed to update.' });
      });
  },

  // Function to calculate and update top scorer for a match
  updateMatchTopScorer: (matchId: string, callback?: Function) => {
    console.log('Calculating top scorer for match:', matchId);
    
    // First, get the match to find the league
    getDoc(doc(collection(getFirestore(), 'matches'), matchId))
      .then(async (matchDoc) => {
        if (!matchDoc.exists()) {
          callback && callback({ isSuccess: false, value: 'Match not found.' });
          return;
        }

        const matchData = (matchDoc.data() || {}) as { [name: string]: any };
        const leagueId = matchData?.leagueId;

        if (!leagueId) {
          callback && callback({ isSuccess: false, value: 'Match missing league information.' });
          return;
        }

        try {
          // Query playerStats collection for this specific match to find top scorer
          const playerStatsQuery = query(
            collection(getFirestore(), 'playerStats'),
            where('matchId', '==', matchId),
            where('leagueId', '==', leagueId)
          );
          const playerStatsSnapshot = await getDocs(playerStatsQuery);

          console.log(`Found ${playerStatsSnapshot.size} player stats for match ${matchId}`);

          // Find the player with the highest points in this match
          let topScorer: any = null;
          let topScore = 0;
          let topScorerPlayerId: string | null = null;

          playerStatsSnapshot.forEach((doc: any) => {
            const statData = doc.data();
            const points = Number(statData.pointsPerGame || statData.points || 0);
            if (points > topScore) {
              topScore = points;
              topScorerPlayerId = statData.playerId;
            }
          });

          // If we found a top scorer, get player details
          if (topScorerPlayerId) {
            const playerDoc = await getDoc(doc(collection(getFirestore(), 'players'), topScorerPlayerId));

            if (playerDoc.exists()) {
              topScorer = { id: playerDoc.id, ...(playerDoc.data() as { [name: string]: any }) };
            }
          }

          // Update the match with top scorer information
          const matchUpdateData = {
            topScorePlayerId: topScorerPlayerId,
            topScore: topScore,
            lastUpdated: new Date().toISOString(),
          };

          await updateDoc(doc(collection(getFirestore(), 'matches'), matchId), matchUpdateData);

          console.log('Match top scorer updated:', {
            matchId,
            topScorerId: topScorerPlayerId,
            topScorerName: topScorer?.name,
            topScore
          });

          callback && callback({ 
            isSuccess: true, 
            value: 'Top scorer updated successfully!',
            data: {
              topScorerId: topScorerPlayerId,
              topScorerName: topScorer?.name,
              topScore
            }
          });

        } catch (error) {
          console.error('Error calculating top scorer:', error);
          callback && callback({ isSuccess: false, value: 'Failed to calculate top scorer.' });
        }
      })
      .catch(error => {
        console.error('Error fetching match:', error);
        callback && callback({ isSuccess: false, value: 'Failed to fetch match.' });
      });
  },

  setTeam: setTeam,

  updateTeam: (
    teamId: string,
    data: { [name: string]: any },
    callback: Function,
  ) => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      callback({ isSuccess: false, value: 'Request timed out. Please check your internet connection and try again.' });
    }, 15000); // 15 second timeout

    updateDoc(doc(collection(getFirestore(), 'teams'), teamId), data)
      .then(() => {
        clearTimeout(timeoutId);
        callback({ isSuccess: true, value: 'Updated successfully!' });
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('updateTeam error:', error);
        let errorMessage = 'Failed to update team.';
        if (error.code === 'permission-denied') {
          errorMessage = 'You do not have permission to update this team.';
        } else if (error.code === 'unavailable') {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message) {
          errorMessage = `Failed to update: ${error.message}`;
        }
        callback({ isSuccess: false, value: errorMessage });
      });
  },

  getTeam: (userId: string, callback: Function) => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      callback({ 
        isSuccess: false, 
        value: 'Team operation timed out. This usually means:\n\n1. Your Firebase project needs to be upgraded (most likely)\n2. Network connectivity issues\n3. Firebase security rules blocking access\n\nPlease check your Firebase console and upgrade if needed.' 
      });
    }, 30000); // 30 second timeout

    const teamsQuery = query(collection(getFirestore(), 'teams'), where('coachId', '==', userId));
    getDocs(teamsQuery)
      .then(querySnapshot => {
        clearTimeout(timeoutId);
        if (querySnapshot.empty) {
          const db = getFirestore();
          const teamId = doc(collection(db, 'teams')).id;
          const data = {
            id: teamId,
            coachId: userId,
          };
          setTeam(teamId, data, (response: { [name: string]: any }) => {
            if (response.isSuccess) {
              // Team created successfully, now update user
              updateUser(userId, { teamId: teamId }, (updateResponse: { [name: string]: any }) => {
                if (updateResponse.isSuccess) {
                  callback({ isSuccess: true, value: data });
                } else {
                  // Team was created but user update failed
                  callback({ 
                    isSuccess: false, 
                    value: `Team created but failed to update user: ${updateResponse.value || 'Unknown error'}. This may indicate a Firebase write permission issue.` 
                  });
                }
              });
            } else {
              callback({ 
                isSuccess: false, 
                value: `Failed to create team: ${response.value || 'Unknown error'}. This is a write operation - your Firebase may need to be upgraded.` 
              });
            }
          });
        } else {
          callback({ isSuccess: true, value: querySnapshot.docs[0].data() });
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        let errorMessage = 'Failed to load team.';
        if (error.code === 'permission-denied') {
          errorMessage = 'You do not have permission to access teams. Please check your Firebase security rules.';
        } else if (error.code === 'unavailable') {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.code === 'failed-precondition') {
          errorMessage = 'Firebase error: Your Firebase project may need to be upgraded or configured. Please check your Firebase console.';
        } else if (error.message) {
          errorMessage = `Failed to load team: ${error.message}`;
        }
        callback({ isSuccess: false, value: errorMessage });
      });
  },

  setEvent: setEvent,

  updateEvent: (
    eventId: string,
    data: { [name: string]: any },
    callback: Function,
  ) => {
    updateDoc(doc(collection(getFirestore(), 'events'), eventId), data)
      .then(() => {
        callback({ isSuccess: true, value: 'Updated successfully!' });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to update.' });
      });
  },

  getEvents: (callback: Function) => {
    getDocs(collection(getFirestore(), 'events'))
      .then(querySnapshot => {
        const items: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          items.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: items });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load events.' });
      });
  },

  getUpcomingEvents: (teamId: string, callback: Function) => {
    const eventsQuery = query(
      collection(getFirestore(), 'events'),
      Filter.and(
        Filter('teamId', '==', teamId),
        Filter('dateTime', '>=', Timestamp.fromDate(new Date())),
      )
    );
    getDocs(eventsQuery)
      .then(querySnapshot => {
        const items: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          items.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: items });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load events.' });
      });
  },

  createLeague: (
    leagueId: string,
    league: { [name: string]: any },
    callback: Function,
  ) => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ 
          isSuccess: false, 
          value: 'League creation timed out. This usually means:\n\n1. Your Firebase project needs to be upgraded (most likely)\n2. Network connectivity issues\n3. Firebase security rules blocking access\n\nPlease check your Firebase console and upgrade if needed.' 
        });
      }, 0);
    }, 30000); // 30 second timeout

    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Create League] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Create League] Loaded restApiAuth from AsyncStorage');
          performRestApiCreateLeague(leagueId, league, restApiAuth, timeoutId, callback);
        } else {
          console.warn('[Create League] Apple Sign In user but no stored auth token. Cannot create league via REST API.');
          performRegularFirebaseCreateLeague(leagueId, league, timeoutId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Create League] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser,
      leagueId
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Create League] Using Firestore REST API for Apple Sign In user');
      performRestApiCreateLeague(leagueId, league, restApiAuth, timeoutId, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Create League] Using React Native Firebase (regular auth user)');
    performRegularFirebaseCreateLeague(leagueId, league, timeoutId, callback);
  },

  updateLeague: updateLeague,

  deleteLeague: (leagueId: string, callback: Function) => {
    const db = getFirestore();
    deleteDoc(doc(collection(db, 'league'), leagueId))
      .then(() => {
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ isSuccess: true, value: 'League deleted successfully!' });
        }, 0);
      })
      .catch(error => {
        // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Failed to delete league.' });
        }, 0);
      });
  },

  deleteLeagueWithAssociatedData: (leagueId: string, callback: Function) => {
    console.log('Starting comprehensive league deletion for:', leagueId);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ 
          isSuccess: false, 
          value: 'League deletion timed out. This usually means:\n\n1. Your Firebase project needs to be upgraded (most likely)\n2. Network connectivity issues\n3. Firebase security rules blocking access\n\nPlease check your internet connection and try again. If the problem persists, your Firebase may need to be upgraded.' 
        });
      }, 0);
    }, 60000); // 60 second timeout (deletion can take longer due to multiple operations)
    
    // Check if user is Apple Sign In user
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Delete League] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Delete League] Loaded restApiAuth from AsyncStorage');
          performRestApiDeleteLeagueWithAssociatedData(leagueId, restApiAuth, timeoutId, callback);
        } else {
          console.warn('[Delete League] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseDeleteLeagueWithAssociatedData(leagueId, timeoutId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Delete League] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Delete League] Using Firestore REST API for Apple Sign In user');
      performRestApiDeleteLeagueWithAssociatedData(leagueId, restApiAuth, timeoutId, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Delete League] Using React Native Firebase (regular auth user)');
    performRegularFirebaseDeleteLeagueWithAssociatedData(leagueId, timeoutId, callback);
  },

  getLeagues: (callback: Function) => {
    // Check if user is Apple Sign In user
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Get Leagues] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Get Leagues] Loaded restApiAuth from AsyncStorage');
          performRestApiGetLeagues(restApiAuth, callback);
        } else {
          console.warn('[Get Leagues] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseGetLeagues(callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Get Leagues] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Get Leagues] Using Firestore REST API for Apple Sign In user');
      performRestApiGetLeagues(restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Get Leagues] Using React Native Firebase (regular auth user)');
    performRegularFirebaseGetLeagues(callback);
  },

  joinLeagues: (inviteId: string, teamId: string, callback: Function) => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Request timed out. Please check your internet connection and try again.' });
      }, 0);
    }, 15000); // 15 second timeout

    if (!teamId) {
      clearTimeout(timeoutId);
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: 'No team selected. Please create a team first.' });
      }, 0);
      return;
    }

    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Join Leagues] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Join Leagues] Loaded restApiAuth from AsyncStorage');
          performRestApiJoinLeagues(inviteId, teamId, restApiAuth, timeoutId, callback);
        } else {
          console.warn('[Join Leagues] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseJoinLeagues(inviteId, teamId, timeoutId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Join Leagues] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Join Leagues] Using Firestore REST API for Apple Sign In user');
      performRestApiJoinLeagues(inviteId, teamId, restApiAuth, timeoutId, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Join Leagues] Using React Native Firebase (regular auth user)');
    performRegularFirebaseJoinLeagues(inviteId, teamId, timeoutId, callback);
  },

  getTeams: (teamsId: string[], callback: Function) => {
    if (teamsId.length === 0) {
      callback({ isSuccess: true, value: [] });
      return;
    }

    // Use Promise.all to fetch all teams in parallel
    const teamPromises = teamsId.map(teamId => 
      getDoc(doc(collection(getFirestore(), 'teams'), teamId))
        .then(teamDoc => {
          if (teamDoc.exists()) {
            return { id: teamDoc.id, ...(teamDoc.data() as { [name: string]: any }) };
          }
          return null;
        })
        .catch(error => {
          console.log('Error fetching team:', teamId, error);
          return null;
        })
    );

    Promise.all(teamPromises)
      .then(teams => {
        // Filter out null results (teams that don't exist or failed to fetch)
        const validTeams = teams.filter(team => team !== null);
        callback({ isSuccess: true, value: validTeams });
      })
      .catch(error => {
        console.log('Error fetching teams:', error);
        callback({ isSuccess: false, value: 'Failed to load teams.' });
      });
  },

  getTeamsByLeague: (leagueId: string, callback: Function) => {
    // First get the league to get its teamsId array
    getDoc(doc(collection(getFirestore(), 'league'), leagueId))
      .then(leagueDoc => {
        if (!leagueDoc.exists()) {
          callback({ isSuccess: false, value: 'League not found.' });
          return;
        }

        const leagueData = (leagueDoc.data() || {}) as { [name: string]: any };
        const teamsId = leagueData?.teamsId || [];

        if (teamsId.length === 0) {
          callback({ isSuccess: true, value: [] });
          return;
        }

        // Fetch teams that belong to this specific league
        const teamPromises = teamsId.map((teamId: string) => 
          getDoc(doc(collection(getFirestore(), 'teams'), teamId))
            .then(teamDoc => {
              if (teamDoc.exists()) {
                const teamData = { id: teamDoc.id, ...(teamDoc.data() as { [name: string]: any }) };
                // Verify the team belongs to this league by checking if it's in the league's teamsId array
                if (teamsId.includes(teamDoc.id)) {
                  return teamData;
                }
                return null;
              }
              return null;
            })
            .catch(error => {
              console.log('Error fetching team:', teamId, error);
              return null;
            })
        );

        Promise.all(teamPromises)
          .then(teams => {
            // Filter out null results and ensure teams are in the correct order
            const validTeams = teams.filter((team: any) => team !== null);
            callback({ isSuccess: true, value: validTeams });
          })
          .catch(error => {
            console.log('Error fetching teams for league:', error);
            callback({ isSuccess: false, value: 'Failed to load teams for league.' });
          });
      })
      .catch(error => {
        console.log('Error fetching league:', error);
        callback({ isSuccess: false, value: 'Failed to load league.' });
      });
  },

  getMatchTeams: (match: { [name: string]: any }, callback: Function) => {
    // Get teams for a specific match, ensuring they belong to the match's league
    if (!match.leagueId || !match.teamAId || !match.teamBId) {
      callback({ isSuccess: false, value: 'Match data incomplete.' });
      return;
    }

    // First get the league to verify team membership
    getDoc(doc(collection(getFirestore(), 'league'), match.leagueId))
      .then(leagueDoc => {
        if (!leagueDoc.exists()) {
          callback({ isSuccess: false, value: 'League not found.' });
          return;
        }

        const leagueData = (leagueDoc.data() || {}) as { [name: string]: any };
        const leagueTeamsId = leagueData?.teamsId || [];

        // Verify that both teams belong to this league
        if (!leagueTeamsId.includes(match.teamAId) || !leagueTeamsId.includes(match.teamBId)) {
          console.warn('Teams do not belong to the specified league:', {
            leagueId: match.leagueId,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            leagueTeamsId
          });
          callback({ isSuccess: false, value: 'Teams do not belong to the specified league.' });
          return;
        }

        // Fetch both teams
        const teamPromises = [match.teamAId, match.teamBId].map((teamId: string) => 
          getDoc(doc(collection(getFirestore(), 'teams'), teamId))
            .then(teamDoc => {
              if (teamDoc.exists()) {
                return { id: teamDoc.id, ...(teamDoc.data() as { [name: string]: any }) };
              }
              return null;
            })
            .catch(error => {
              console.log('Error fetching team:', teamId, error);
              return null;
            })
        );

        Promise.all(teamPromises)
          .then(teams => {
            const validTeams = teams.filter((team: any) => team !== null);
            if (validTeams.length === 2) {
              callback({ isSuccess: true, value: validTeams });
            } else {
              callback({ isSuccess: false, value: 'Could not fetch both teams for the match.' });
            }
          })
          .catch(error => {
            console.log('Error fetching match teams:', error);
            callback({ isSuccess: false, value: 'Failed to load match teams.' });
          });
      })
      .catch(error => {
        console.log('Error fetching league for match teams:', error);
        callback({ isSuccess: false, value: 'Failed to load league for match teams.' });
      });
  },

  getMatches: (leagueId: string, callback: Function) => {
    const matchesQuery = query(collection(getFirestore(), 'matches'), where('leagueId', '==', leagueId));
    getDocs(matchesQuery)
      .then(querySnapshot => {
        const matches: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: { data: () => { [name: string]: any; }; }) => {
          matches.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: matches });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load matches.' });
      });
  },

  getMatchesOfLeagues: (leagueIds: string[], callback: Function) => {
    // Firestore 'in' operator has a limit of 10 values
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < leagueIds.length; i += chunkSize) {
      chunks.push(leagueIds.slice(i, i + chunkSize));
    }
    
    // Execute all queries in parallel
    const promises = chunks.map(chunk => {
      const matchesQuery = query(collection(getFirestore(), 'matches'), where('leagueId', 'in', chunk));
      return getDocs(matchesQuery)
        .then(querySnapshot => {
          const matches: { [name: string]: any }[] = [];
          querySnapshot.forEach((documentSnapshot: any) => {
            matches.push(documentSnapshot.data());
          });
          return matches;
        });
    });
    
    Promise.all(promises)
      .then(results => {
        // Flatten all results into a single array
        const allMatches = results.flat();
        callback({ isSuccess: true, value: allMatches });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load matches.' });
      });
  },

  getUpcomingMatchesOfLeagues: (leagueIds: string[], callback: Function) => {
    const matchesQuery = query(
      collection(getFirestore(), 'matches'),
      Filter.and(
        Filter('leagueId', 'in', leagueIds),
        Filter('dateTime', '>=', Timestamp.fromDate(new Date())),
      )
    );
    getDocs(matchesQuery)
      .then(querySnapshot => {
        const matches: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          matches.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: matches });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load matches.' });
      });
  },

  getPlayer: (playerId: string, callback: Function) => {
    getDoc(doc(collection(getFirestore(), 'players'), playerId))
      .then(documentSnapshot => {
        callback({ isSuccess: true, value: documentSnapshot.data() });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load player.' });
      });
  },

  getPlayers: (teamsId: string[], callback: Function) => {
    if (!Array.isArray(teamsId) || teamsId.length === 0) {
      callback({ isSuccess: true, value: [] });
      return;
    }

    const uniqueTeamIds = Array.from(new Set(teamsId.filter(Boolean)));
    const chunkSize = 10; // Firestore 'in' query limit
    const chunks: string[][] = [];

    for (let i = 0; i < uniqueTeamIds.length; i += chunkSize) {
      chunks.push(uniqueTeamIds.slice(i, i + chunkSize));
    }

    const playerQueries = chunks.map((chunk) => {
      const playersQuery = query(collection(getFirestore(), 'players'), where('teamId', 'in', chunk));
      return getDocs(playersQuery).then((querySnapshot) => {
        const players: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: { id: string; data: () => { (): any; new(): any; [x: string]: any; deleted?: any } }) => {
          const playerData = documentSnapshot.data();
          if (!playerData.deleted) {
            players.push({
              id: documentSnapshot.id,
              ...playerData,
            });
          }
        });
        return players;
      });
    });

    Promise.all(playerQueries)
      .then((results) => {
        const mergedPlayers = results.flat();
        const dedupedPlayers = mergedPlayers.filter(
          (player, index, array) => array.findIndex(item => item.id === player.id) === index,
        );
        callback({ isSuccess: true, value: dedupedPlayers });
      })
      .catch(error => {
        console.log('Error fetching players:', error);
        callback({ isSuccess: false, value: 'Failed to load players.' });
      });
  },

  getPlayerStats: (leagueId: string, callback: Function) => {
    const playerStatsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', leagueId));
    getDocs(playerStatsQuery)
      .then(querySnapshot => {
        const playerStats: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: { data: () => { [name: string]: any; }; }) => {
          playerStats.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: playerStats });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load standings.' });
      });
  },

  getPromoCodes: (code: string, callback: Function) => {
    const promoCodesQuery = query(
      collection(getFirestore(), 'promoCodes'),
      Filter.and(Filter('code', '==', code), Filter('usedBy', '==', ''))
    );
    getDocs(promoCodesQuery)
      .then(querySnapshot => {
        if (querySnapshot.empty) {
          callback({ isSuccess: false, value: 'Promo code does not exist.' });
        } else {
          const promoCodes: { [name: string]: any }[] = [];
          querySnapshot.forEach((documentSnapshot: { data: () => { [name: string]: any; }; }) => {
            promoCodes.push(documentSnapshot.data());
          });
          callback({ isSuccess: true, value: promoCodes });
        }
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load promo codes.' });
      });
  },

  updatePromoCode: (
    id: string,
    data: { [name: string]: any },
    callback?: Function,
  ) => {
    updateDoc(doc(collection(getFirestore(), 'promoCodes'), id), data)
      .then(() => {
        callback &&
          callback({ isSuccess: true, value: 'Updated successfully!' });
      })
      .catch(error => {
        callback && callback({ isSuccess: false, value: 'Failed to update.' });
      });
  },

  setMatch: (
    matchId: string,
    match: { [name: string]: any },
    callback: Function,
  ) => {
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Set Match] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Set Match] Loaded restApiAuth from AsyncStorage');
          performRestApiSetMatch(matchId, match, restApiAuth, callback);
        } else {
          console.warn('[Set Match] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseSetMatch(matchId, match, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Set Match] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Set Match] Using Firestore REST API for Apple Sign In user');
      performRestApiSetMatch(matchId, match, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Set Match] Using React Native Firebase (regular auth user)');
    performRegularFirebaseSetMatch(matchId, match, callback);
  },

  updateMatch: (
    matchId: string,
    updates: { [name: string]: any },
    callback?: Function,
  ) => {
    if (!callback) {
      console.warn('[Update Match] No callback provided');
      return;
    }

    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Update Match] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Update Match] Loaded restApiAuth from AsyncStorage');
          performRestApiUpdateMatch(matchId, updates, restApiAuth, callback);
        } else {
          console.warn('[Update Match] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseUpdateMatch(matchId, updates, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Update Match] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Update Match] Using Firestore REST API for Apple Sign In user');
      performRestApiUpdateMatch(matchId, updates, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Update Match] Using React Native Firebase (regular auth user)');
    performRegularFirebaseUpdateMatch(matchId, updates, callback);
  },

  deleteMatch: (matchId: string, callback: Function) => {
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Delete Match] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Delete Match] Loaded restApiAuth from AsyncStorage');
          performRestApiDeleteMatch(matchId, restApiAuth, callback);
        } else {
          console.warn('[Delete Match] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseDeleteMatch(matchId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Delete Match] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Delete Match] Using Firestore REST API for Apple Sign In user');
      performRestApiDeleteMatch(matchId, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Delete Match] Using React Native Firebase (regular auth user)');
    performRegularFirebaseDeleteMatch(matchId, callback);
  },

  deleteMatchWithAssociatedData: (matchId: string, callback: Function) => {
    console.log('Starting comprehensive match deletion for:', matchId);
    
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Delete Match With Associated Data] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Delete Match With Associated Data] Loaded restApiAuth from AsyncStorage');
          // Use REST API path
          performRestApiDeleteMatchWithAssociatedData(matchId, restApiAuth, callback);
        } else {
          console.warn('[Delete Match With Associated Data] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseDeleteMatchWithAssociatedData(matchId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Delete Match With Associated Data] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Delete Match With Associated Data] Using Firestore REST API for Apple Sign In user');
      performRestApiDeleteMatchWithAssociatedData(matchId, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Delete Match With Associated Data] Using React Native Firebase (regular auth user)');
    performRegularFirebaseDeleteMatchWithAssociatedData(matchId, callback);
  },

  saveGameStats: saveGameStats,

  getTopPlayers: (maxResults: number = 10, callback: Function) => {
    const topPlayersQuery = query(
      collection(getFirestore(), 'playerAverageStats'),
      orderBy('averagePoints', 'desc'),
      limit(maxResults),
    );
    getDocs(topPlayersQuery)
      .then(querySnapshot => {
        const topPlayers: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          topPlayers.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: topPlayers });
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load top players.' });
      });
  },

  getLeague: (leagueId: string, callback: Function) => {
    // Validate leagueId before making Firestore query
    if (!leagueId || typeof leagueId !== 'string' || leagueId.trim().length === 0) {
      callback({ isSuccess: false, value: 'Invalid league ID.' });
      return;
    }

    getDoc(doc(collection(getFirestore(), 'league'), leagueId))
      .then(documentSnapshot => {
        if (documentSnapshot.exists()) {
          // Ensure the document ID is included in the returned data
          const leagueData = { id: documentSnapshot.id, ...(documentSnapshot.data() as { [name: string]: any }) };
          callback({ isSuccess: true, value: leagueData });
        } else {
          callback({ isSuccess: false, value: 'League not found.' });
        }
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load league.' });
      });
  },

  getAllLeagues: (callback: Function) => {
    getDocs(collection(getFirestore(), 'league'))
      .then(querySnapshot => {
        const leagues: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: any) => {
          // Include the document ID in the league data
          leagues.push({ id: documentSnapshot.id, ...(documentSnapshot.data() as { [name: string]: any }) });
        });
        callback({ isSuccess: true, value: leagues });
      })
      .catch(error => {
        console.log('Error fetching leagues:', error);
        callback({ isSuccess: false, value: 'Failed to load leagues.' });
      });
  },


  getPlayerAverageStatsByLeague: (leagueId: string, callback: Function) => {
    // Validate leagueId before making Firestore query
    if (!leagueId || typeof leagueId !== 'string' || leagueId.trim().length === 0) {
      callback({ isSuccess: false, value: 'Invalid league ID.' });
      return;
    }

    const playerAverageStatsQuery = query(collection(getFirestore(), 'playerAverageStats'), where('leagueId', '==', leagueId));
    getDocs(playerAverageStatsQuery)
      .then(querySnapshot => {
        const playerStats: { [name: string]: any }[] = [];
        querySnapshot.forEach((documentSnapshot: { data: () => { [name: string]: any; }; }) => {
          playerStats.push(documentSnapshot.data());
        });
        callback({ isSuccess: true, value: playerStats });
      })
      .catch(error => {
        console.error('Error loading player stats:', error);
        callback({ isSuccess: false, value: 'Failed to load player stats for league.' });
      });
  },

  // ✅ Get the latest match by league (always return topPlayerFromMatch = object or null)
  getLatestMatchByLeague: (leagueId: string, callback: Function) => {
    console.log('Fetching matches for leagueId:', leagueId);

    const matchesQuery = query(collection(getFirestore(), 'matches'), where('leagueId', '==', leagueId));
    getDocs(matchesQuery)
      .then(async querySnapshot => {
        console.log(
          'Matches query result for leagueId',
          leagueId,
          ':',
          querySnapshot.size,
          'matches found'
        );

        if (querySnapshot.empty) {
          console.log('No matches found for leagueId:', leagueId);
          callback({ isSuccess: true, value: null });
          return;
        }

        // Get all matches
        const matches = querySnapshot.docs.map(
          (          doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() } as any)
        );
        console.log('Matches data:', matches);

        // Sort matches by date to get the latest one
        const sortedMatches = matches.sort((a: { dateTime: { toDate: () => any; }; lastUpdated: string | number | Date; }, b: { dateTime: { toDate: () => any; }; lastUpdated: string | number | Date; }) => {
          // Prefer scheduled dateTime when available; otherwise fallback to lastUpdated
          const dateA = a?.dateTime?.toDate?.()
            ? a.dateTime.toDate()
            : (a?.lastUpdated ? new Date(a.lastUpdated) : new Date(0));
          const dateB = b?.dateTime?.toDate?.()
            ? b.dateTime.toDate()
            : (b?.lastUpdated ? new Date(b.lastUpdated) : new Date(0));
          return dateB.getTime() - dateA.getTime(); // Sort descending (latest first)
        });
        
        const latestMatch = sortedMatches[0];
        console.log('Latest match after sorting:', latestMatch);

        // Default: ensure we always attach topPlayerFromMatch
        let matchWithTopPlayer: any = { ...latestMatch, topPlayerFromMatch: null };

        if (latestMatch.topScorePlayerId) {
          console.log('Fetching top player details for match:', latestMatch.id, 'topScorePlayerId:', latestMatch.topScorePlayerId);

          try {
            const playerDoc = await getDoc(doc(collection(getFirestore(), 'players'), latestMatch.topScorePlayerId));

            if (playerDoc.exists()) {
              const playerData = playerDoc.data();
              console.log('Top player found:', playerData);
              console.log('Player data details:', {
                id: playerData?.id,
                name: playerData?.name,
                avatar: playerData?.avatar,
                teamId: playerData?.teamId
              });

              // Try fetching team details too
              let teamName = 'Unknown Team';
              if (playerData?.teamId) {
                const teamDoc = await getDoc(doc(collection(getFirestore(), 'teams'), playerData.teamId));
                if (teamDoc.exists()) {
                  const teamData = teamDoc.data();
                  console.log('Top player team found:', teamData);
                  teamName = teamData?.name || 'Unknown Team';
                }
              }

              // Attach top player info
              matchWithTopPlayer.topPlayerFromMatch = {
                id: latestMatch.topScorePlayerId,
                name: playerData?.name || 'Unknown Player',
                avatar: playerData?.avatar || '',
                points: latestMatch.topScore || 0,
                teamName,
              };
              
              console.log('Created topPlayerFromMatch object:', matchWithTopPlayer.topPlayerFromMatch);
            }
          } catch (err) {
            console.log('Error fetching top player/team:', err);
            // keep topPlayerFromMatch = null
          }
        } else {
          console.log('No topScorePlayerId in match:', latestMatch.id);

          // If there is no topScorePlayerId (or lastUpdated is missing), compute top scorer from playerStats for this match
          // This ensures the UI can still show a top performer even without persisted fields
          try {
            if (latestMatch?.id && latestMatch?.leagueId) {
              const playerStatsQuery = query(
                collection(getFirestore(), 'playerStats'),
                where('matchId', '==', latestMatch.id),
                where('leagueId', '==', latestMatch.leagueId)
              );
              const playerStatsSnapshot = await getDocs(playerStatsQuery);

              let topScore = 0;
              let topScorerPlayerId: string | null = null;

              playerStatsSnapshot.forEach((doc: { data: () => any; }) => {
                const statData = doc.data();
                const points = Number(statData.pointsPerGame || statData.points || 0);
                if (points > topScore) {
                  topScore = points;
                  topScorerPlayerId = statData.playerId;
                }
              });

              if (topScorerPlayerId) {
                const firestoreDb = getFirestore();
                const playerDocRef = doc(collection(firestoreDb, 'players'), topScorerPlayerId);
                const playerDoc = await getDoc(playerDocRef);

                let teamName = 'Unknown Team';
                let avatar = '';
                let name = 'Unknown Player';

                if (playerDoc.exists()) {
                  const playerData = (playerDoc.data() || {}) as { [name: string]: any };
                  name = playerData?.name || name;
                  avatar = playerData?.avatar || avatar;
                  if (playerData?.teamId) {
                    const teamDocRef = doc(collection(firestoreDb, 'teams'), playerData.teamId);
                    const teamDoc = await getDoc(teamDocRef);
                    if (teamDoc.exists()) {
                      const teamData = teamDoc.data();
                      teamName = teamData?.name || teamName;
                    }
                  }
                }

                matchWithTopPlayer.topPlayerFromMatch = {
                  id: topScorerPlayerId,
                  name,
                  avatar,
                  points: topScore,
                  teamName,
                };
              }
            }
          } catch (err) {
            console.log('Error computing top scorer from playerStats for match:', latestMatch.id, err);
          }
        }

        console.log('Returning match with topPlayerFromMatch:', matchWithTopPlayer);
        callback({ isSuccess: true, value: matchWithTopPlayer });
      })
      .catch(error => {
        console.log('Error fetching matches for leagueId', leagueId, ':', error);
        callback({ isSuccess: false, value: 'Failed to load latest match for league.' });
      });
  },

  // ✅ Get team by ID
  getTeamById: (teamId: string, callback: Function) => {
    const firestoreDb = getFirestore();
    const teamDocRef = doc(collection(firestoreDb, 'teams'), teamId);

    getDoc(teamDocRef)
      .then(documentSnapshot => {
        if (documentSnapshot.exists()) {
          callback({ isSuccess: true, value: documentSnapshot.data() });
        } else {
          callback({ isSuccess: false, value: 'Team not found.' });
        }
      })
      .catch(error => {
        console.log('Error fetching team:', error);
        callback({ isSuccess: false, value: 'Failed to load team.' });
      });
  },

  getPlayerWithTeam: (playerId: string, callback: Function) => {
    const firestoreDb = getFirestore();
    const playerDocRef = doc(collection(firestoreDb, 'players'), playerId);

    getDoc(playerDocRef)
      .then(documentSnapshot => {
        if (documentSnapshot.exists()) {
          const playerData = (documentSnapshot.data() || {}) as { [name: string]: any };
          if (playerData?.teamId) {
            // Get team details
            const teamDocRef = doc(collection(firestoreDb, 'teams'), playerData.teamId);

            getDoc(teamDocRef)
              .then(teamSnapshot => {
                if (teamSnapshot.exists()) {
                  const teamData = teamSnapshot.data();
                  callback({ 
                    isSuccess: true, 
                    value: { 
                      ...playerData, 
                      team: teamData 
                    } 
                  });
                } else {
                  callback({ 
                    isSuccess: true, 
                    value: { 
                      ...playerData, 
                      team: null 
                    } 
                  });
                }
              })
              .catch(error => {
                callback({ 
                  isSuccess: true, 
                  value: { 
                    ...playerData, 
                    team: null 
                  } 
                });
              });
          } else {
            callback({ 
              isSuccess: true, 
              value: { 
                ...(playerData as { [name: string]: any }), 
                team: null 
              } 
            });
          }
        } else {
          callback({ isSuccess: false, value: 'Player not found.' });
        }
      })
      .catch(error => {
        callback({ isSuccess: false, value: 'Failed to load player.' });
      });
  },

  addTeamToLeague: (leagueId: string, teamId: string, callback: Function) => {
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      // Use setTimeout to ensure callback is called on next tick, preventing UI freeze
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Request timed out. Please check your internet connection and try again.' });
      }, 0);
    }, 15000); // 15 second timeout

    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Add Team To League] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Add Team To League] Loaded restApiAuth from AsyncStorage');
          performRestApiAddTeamToLeague(leagueId, teamId, restApiAuth, timeoutId, callback);
        } else {
          console.warn('[Add Team To League] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseAddTeamToLeague(leagueId, teamId, timeoutId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Add Team To League] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser,
      leagueId,
      teamId
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Add Team To League] Using Firestore REST API for Apple Sign In user');
      performRestApiAddTeamToLeague(leagueId, teamId, restApiAuth, timeoutId, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Add Team To League] Using React Native Firebase (regular auth user)');
    performRegularFirebaseAddTeamToLeague(leagueId, teamId, timeoutId, callback);
  },

  // Get all teams from the teams collection
  getAllTeams: (callback: Function) => {
    getDocs(collection(getFirestore(), 'teams'))
      .then(querySnapshot => {
        const teams: any[] = [];
        querySnapshot.forEach((doc: any) => {
          if (doc.exists()) {
            teams.push({ id: doc.id, ...(doc.data() as { [name: string]: any }) });
          }
        });
        callback({ isSuccess: true, value: teams });
      })
      .catch(error => {
        console.log('Error getting all teams:', error);
        callback({ isSuccess: false, value: 'Failed to load teams.' });
      });
  },

  // Get teams by coach ID
  getTeamsByCoach: (coachId: string, callback: Function) => {
    // For Apple Sign In users, use Firestore REST API with idToken
    const hasFirebaseSession = !!getAuth().currentUser;
    const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
    
    // Try to get restApiAuth from CMGlobal first, then from AsyncStorage if needed
    let restApiAuth = (CMGlobal as any).restApiAuth;
    
    // If Apple Sign In user but restApiAuth is missing, try to load from AsyncStorage
    if (isAppleSignInUser && (!restApiAuth || !restApiAuth.idToken)) {
      console.log('[Get Teams By Coach] Apple Sign In user detected, loading auth from AsyncStorage...');
      CMLocalStorageHelper.getAppleSignInAuth((isSuccess: boolean, storedAuth: any) => {
        if (isSuccess && storedAuth && storedAuth.idToken) {
          restApiAuth = storedAuth;
          (CMGlobal as any).restApiAuth = storedAuth;
          console.log('[Get Teams By Coach] Loaded restApiAuth from AsyncStorage');
          performRestApiGetTeamsByCoach(coachId, restApiAuth, callback);
        } else {
          console.warn('[Get Teams By Coach] Apple Sign In user but no stored auth token. Falling back to regular Firebase.');
          performRegularFirebaseGetTeamsByCoach(coachId, callback);
        }
      });
      return; // Exit early, callback will be called from async operation
    }
    
    console.log('[Get Teams By Coach] Auth check:', {
      hasRestApiAuth: !!restApiAuth,
      hasIdToken: !!(restApiAuth?.idToken),
      hasFirebaseSession,
      isAppleSignInUser,
      coachId
    });
    
    // If we detect Apple Sign In user and have restApiAuth, use REST API
    if (isAppleSignInUser && restApiAuth && restApiAuth.idToken) {
      console.log('[Get Teams By Coach] Using Firestore REST API for Apple Sign In user');
      performRestApiGetTeamsByCoach(coachId, restApiAuth, callback);
      return;
    }
    
    // Regular Firebase auth users
    console.log('[Get Teams By Coach] Using React Native Firebase (regular auth user)');
    performRegularFirebaseGetTeamsByCoach(coachId, callback);
  },

  // Delete team
  deleteTeam: (teamId: string, callback: Function) => {
    deleteDoc(doc(collection(getFirestore(), 'teams'), teamId))
      .then(() => {
        callback({ isSuccess: true, value: 'Team deleted successfully!' });
      })
      .catch(error => {
        console.log('Error deleting team:', error);
        callback({ isSuccess: false, value: 'Failed to delete team.' });
      });
  },

  deleteTeamWithAssociatedData: (teamId: string, callback: Function) => {
    console.log('Starting comprehensive team deletion for:', teamId);
    
    // Get the team data first to access related information
    getDoc(doc(collection(getFirestore(), 'teams'), teamId))
      .then(teamDoc => {
        if (!teamDoc.exists()) {
          callback({ isSuccess: false, value: 'Team not found.' });
          return;
        }

        const teamData = (teamDoc.data() || {}) as { [name: string]: any };
        const leaguesId = teamData?.leaguesId || [];

        // Delete all players associated with this team
        const playersQuery = query(collection(getFirestore(), 'players'), where('teamId', '==', teamId));
        getDocs(playersQuery)
          .then(playersSnapshot => {
            const playerDeletionPromises = playersSnapshot.docs.map((playerDoc: { ref: any; }) => deleteDoc(playerDoc.ref));
            return Promise.all(playerDeletionPromises);
          })
          .then(() => {
            // Remove team from all leagues
            const leagueUpdatePromises = leaguesId.map((leagueId: string) => {
              return getDoc(doc(collection(getFirestore(), 'league'), leagueId))
                .then(leagueDoc => {
                  if (leagueDoc.exists()) {
                    const leagueData = (leagueDoc.data() || {}) as { [name: string]: any };
                    const teamsId = leagueData?.teamsId || [];
                    const updatedTeamsId = teamsId.filter((id: string) => id !== teamId);
                    return updateDoc(doc(collection(getFirestore(), 'league'), leagueId), { teamsId: updatedTeamsId });
                  }
                });
            });

            return Promise.all(leagueUpdatePromises);
          })
          .then(() => {
            // Finally delete the team itself
            return deleteDoc(doc(collection(getFirestore(), 'teams'), teamId));
          })
          .then(() => {
            callback({ isSuccess: true, value: 'Team and all associated data deleted successfully!' });
          })
          .catch(error => {
            console.log('Error deleting team with associated data:', error);
            callback({ isSuccess: false, value: 'Failed to delete team and associated data.' });
          });
      })
      .catch(error => {
        console.log('Error getting team data:', error);
        callback({ isSuccess: false, value: 'Failed to load team data.' });
      });
  },

  // Season settings helpers
  getSeasonSettings: (leagueId: string, seasonName: string, callback: Function) => {
    if (!leagueId || !seasonName) {
      callback({ isSuccess: false, value: 'League ID and season name are required.' });
      return;
    }
    const seasonDocId = `${leagueId}_${seasonName}`;
    getDoc(doc(getFirestore(), 'seasons', seasonDocId))
      .then((docSnapshot) => {
        if (docSnapshot.exists()) {
          callback({ isSuccess: true, value: docSnapshot.data() });
        } else {
          callback({ isSuccess: false, value: null });
        }
      })
      .catch((error) => {
        console.log('Error getting season settings:', error);
        callback({ isSuccess: false, value: 'Failed to load season settings.' });
      });
  },

  setSeasonSettings: (leagueId: string, seasonName: string, settings: { [name: string]: any }, callback?: Function) => {
    if (!leagueId || !seasonName) {
      callback && callback({ isSuccess: false, value: 'League ID and season name are required.' });
      return;
    }
    const seasonDocId = `${leagueId}_${seasonName}`;
    const seasonData = {
      leagueId,
      seasonName,
      ...settings,
      updatedAt: serverTimestamp(),
    };
    setDoc(doc(getFirestore(), 'seasons', seasonDocId), seasonData, { merge: true })
      .then(() => {
        callback && callback({ isSuccess: true, value: 'Season settings saved successfully.' });
      })
      .catch((error) => {
        console.log('Error saving season settings:', error);
        callback && callback({ isSuccess: false, value: 'Failed to save season settings.' });
      });
  },

  getNews: (type: 'league' | 'global', leagueId?: string, limitCount: number = 20, callback?: Function) => {
    const db = getFirestore();
    let newsQuery;

    // Don't use orderBy in Firestore query to avoid composite index requirement
    // We'll sort in JavaScript instead
    if (type === 'league' && leagueId) {
      newsQuery = query(
        collection(db, 'news'),
        where('type', '==', 'league'),
        where('leagueId', '==', leagueId)
      );
    } else {
      newsQuery = query(
        collection(db, 'news'),
        where('type', '==', 'global')
      );
    }

    getDocs(newsQuery)
      .then(querySnapshot => {
        const news: any[] = [];
        querySnapshot.forEach((doc: { id: any; data: () => any; }) => {
          news.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt in JavaScript (descending - newest first)
        news.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
          return dateB.getTime() - dateA.getTime();
        });
        
        // Apply limit after sorting
        const limitedNews = news.slice(0, limitCount);
        
        callback && callback({ isSuccess: true, value: limitedNews });
      })
      .catch(error => {
        console.error('[Get News] Error:', error);
        callback && callback({ isSuccess: false, value: 'Failed to load news.' });
      });
  },
};

// Helper function to perform REST API add team to league
const performRestApiAddTeamToLeague = (
  leagueId: string,
  teamId: string,
  restApiAuth: { idToken: string },
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/statx-a9bfe/databases/(default)/documents/league/${leagueId}`;
    
    console.log('[Add Team To League] Calling Firestore REST API to get league:', leagueId);
    
    // First get the league document
    fetch(firestoreUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restApiAuth.idToken}`,
      },
    })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        clearTimeout(timeoutId);
        console.error('[Add Team To League] Firestore REST API get error:', errorData);
        if (response.status === 404) {
          setTimeout(() => {
            callback({ isSuccess: false, value: 'League not found.' });
          }, 0);
        } else {
          setTimeout(() => {
            callback({ isSuccess: false, value: 'Failed to load league.' });
          }, 0);
        }
        return;
      }
      
      const leagueDoc = await response.json();
      console.log('[Add Team To League] League document retrieved successfully');
      
      // Extract teamsId array from REST API format
      let teamsId: string[] = [];
      if (leagueDoc.fields?.teamsId?.arrayValue?.values) {
        teamsId = leagueDoc.fields.teamsId.arrayValue.values
          .map((v: any) => v.stringValue)
          .filter((id: string) => id !== undefined);
      }
      
      // Extract maxTeamSize
      let maxTeamSize = 0;
      if (leagueDoc.fields?.maxTeamSize?.integerValue) {
        maxTeamSize = parseInt(leagueDoc.fields.maxTeamSize.integerValue);
      } else if (leagueDoc.fields?.maxTeamSize?.stringValue) {
        maxTeamSize = parseInt(leagueDoc.fields.maxTeamSize.stringValue);
      }
      
      // Check if team is already in the league
      if (teamsId.includes(teamId)) {
        clearTimeout(timeoutId);
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Team is already in this league.' });
        }, 0);
        return;
      }
      
      // Check if league is full
      if (maxTeamSize > 0 && teamsId.length >= maxTeamSize) {
        clearTimeout(timeoutId);
        setTimeout(() => {
          callback({ isSuccess: false, value: 'League is full. Cannot add more teams.' });
        }, 0);
        return;
      }
      
      // Add team to league
      teamsId.push(teamId);
      
      // Preserve all existing league fields and only update teamsId
      // Extract all existing fields from the league document
      const existingFields: any = {};
      if (leagueDoc.fields) {
        Object.keys(leagueDoc.fields).forEach(key => {
          if (key !== 'teamsId') {
            existingFields[key] = leagueDoc.fields[key];
          }
        });
      }
      
      // Update the league document with new teamsId array, preserving all other fields
      const fields: any = {
        ...existingFields,
        teamsId: {
          arrayValue: {
            values: teamsId.map(id => ({ stringValue: id }))
          }
        }
      };
      
      console.log('[Add Team To League] Updating league with new teamsId array (preserving all fields):', teamsId);
      
      fetch(firestoreUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${restApiAuth.idToken}`,
        },
        body: JSON.stringify({ fields }),
      })
      .then(async (updateResponse) => {
        clearTimeout(timeoutId);
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error('[Add Team To League] Firestore REST API update error:', errorData);
          let errorMessage = 'Failed to add team to league.';
          if (errorData.error?.message) {
            errorMessage = `Failed to add team to league: ${errorData.error.message}`;
          }
          setTimeout(() => {
            callback({ isSuccess: false, value: errorMessage });
          }, 0);
          return;
        }
        
        console.log('[Add Team To League] Firestore REST API update successful');
        setTimeout(() => {
          callback({ isSuccess: true, value: 'Team added to league successfully!' });
        }, 0);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('[Add Team To League] Firestore REST API catch error:', error);
        setTimeout(() => {
          callback({ isSuccess: false, value: 'Failed to add team to league.' });
        }, 0);
      });
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('[Add Team To League] Firestore REST API get catch error:', error);
      setTimeout(() => {
        callback({ isSuccess: false, value: 'Failed to load league.' });
      }, 0);
    });
};

// Helper function to perform regular Firebase add team to league
const performRegularFirebaseAddTeamToLeague = (
  leagueId: string,
  teamId: string,
  timeoutId: NodeJS.Timeout,
  callback: Function
) => {
    // First get the current league data
    const db = getFirestore();
    getDoc(doc(collection(db, 'league'), leagueId))
      .then(documentSnapshot => {
        if (documentSnapshot.exists()) {
          const leagueData = documentSnapshot.data() as any;
          let teamsId = leagueData?.teamsId ?? [];
          
          // Check if team is already in the league
          if (teamsId.includes(teamId)) {
            clearTimeout(timeoutId);
            setTimeout(() => {
              callback({ isSuccess: false, value: 'Team is already in this league.' });
            }, 0);
            return;
          }
          
          // Check if league is full
          if (teamsId.length >= (leagueData?.maxTeamSize || 0)) {
            clearTimeout(timeoutId);
            setTimeout(() => {
              callback({ isSuccess: false, value: 'League is full. Cannot add more teams.' });
            }, 0);
            return;
          }
          
          // Add team to league
          teamsId.push(teamId);
          
          // Update the league document
          updateDoc(doc(collection(db, 'league'), leagueId), { teamsId: teamsId })
            .then(() => {
              clearTimeout(timeoutId);
              setTimeout(() => {
                callback({ isSuccess: true, value: 'Team added to league successfully!' });
              }, 0);
            })
            .catch(error => {
              clearTimeout(timeoutId);
              console.error('[Add Team To League] Update error:', error);
              let errorMessage = 'Failed to add team to league.';
              if (error.code === 'permission-denied') {
                errorMessage = 'You do not have permission to add teams to this league.';
              } else if (error.code === 'unavailable') {
                errorMessage = 'Network error. Please check your internet connection and try again.';
              }
              setTimeout(() => {
                callback({ isSuccess: false, value: errorMessage });
              }, 0);
            });
        } else {
          clearTimeout(timeoutId);
          setTimeout(() => {
            callback({ isSuccess: false, value: 'League not found.' });
          }, 0);
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('[Add Team To League] Get error:', error);
        let errorMessage = 'Failed to load league.';
        if (error.code === 'unavailable') {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        setTimeout(() => {
          callback({ isSuccess: false, value: errorMessage });
        }, 0);
      });
};
