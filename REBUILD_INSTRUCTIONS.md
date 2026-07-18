# How to Rebuild Android App After Network Config Changes

## ⚠️ IMPORTANT: Network Security Config Changes Require Full Rebuild

When you modify `android/app/src/main/res/xml/network_security_config.xml`, you **MUST** rebuild the Android app completely. Hot reload or fast refresh will NOT apply these changes.

## Steps to Rebuild

### Option 1: Clean Build (Recommended)
```bash
cd CHMPST_main

# Stop Metro bundler if running (Ctrl+C)

# Clean Android build
cd android
./gradlew clean
cd ..

# Rebuild and run
npx react-native run-android
```

### Option 2: Full Clean (If Option 1 doesn't work)
```bash
cd CHMPST_main

# Stop Metro bundler
# Stop the app on your device/emulator

# Clean everything
cd android
./gradlew clean
rm -rf app/build
rm -rf build
cd ..

# Clear Metro cache
npx react-native start --reset-cache

# In another terminal, rebuild
npx react-native run-android
```

### Option 3: Uninstall and Reinstall
```bash
# Uninstall the app from your device/emulator
adb uninstall com.chmpst.chmpst

# Then rebuild
cd CHMPST_main
cd android
./gradlew clean
cd ..
npx react-native run-android
```

## Verify Network Config is Applied

After rebuilding, you can verify the network security config is working by:

1. **Check Logcat:**
   ```bash
   adb logcat | grep -i "network"
   ```

2. **Test Connection:**
   - Open the app
   - Try the "Analysis by Image" feature
   - Check if it connects to `http://3.238.255.151:3000`

3. **Check Console Logs:**
   - Look for the connection test logs in React Native debugger
   - Should see: `🔍 Testing connection to: http://3.238.255.151:3000/api/v1/analysis/test`

## Current Network Security Config

The app is configured to allow HTTP traffic to:
- All domains (via `<base-config cleartextTrafficPermitted="true">`)
- Specifically: localhost, 10.0.2.2, 192.168.x.x, 10.x.x.x, 172.16.x.x, and **3.238.255.151** (AWS server)

## Troubleshooting

### Still Getting "Network request failed"?

1. **Verify the app was rebuilt:**
   - Check app version/build number changed
   - Or uninstall and reinstall completely

2. **Check AndroidManifest.xml:**
   - Should have: `android:usesCleartextTraffic="true"`
   - Should have: `android:networkSecurityConfig="@xml/network_security_config"`

3. **Verify network_security_config.xml exists:**
   ```bash
   ls -la android/app/src/main/res/xml/network_security_config.xml
   ```

4. **Check device/emulator internet:**
   - Try opening `http://3.238.255.151:3000/health` in device browser
   - If browser can't access it, it's a network/firewall issue, not app config

5. **Check React Native logs:**
   ```bash
   npx react-native log-android
   ```

### Still Not Working?

Try this test in your app code temporarily:
```javascript
// Test direct fetch
fetch('http://3.238.255.151:3000/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works but the app doesn't, there might be an issue with how the URL is constructed.

