import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { runMigrations } from '@/db/migrate';
import { getSettings } from '@/db/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady]               = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const [fontsLoaded] = useFonts({
    SourceSans3:          SourceSans3_400Regular,
    SourceSans3Medium:    SourceSans3_500Medium,
    SourceSans3SemiBold:  SourceSans3_600SemiBold,
    SourceSans3Bold:      SourceSans3_700Bold,
  });

  useEffect(() => {
    runMigrations()
      .then(() => getSettings())
      .then(settings => {
        setNeedsOnboarding(!settings.onboarding_done);
        setDbReady(true);
      })
      .catch(console.error);
  }, []);

  // Redirect only after the Stack navigator has mounted (dbReady + fontsLoaded = rendered)
  useEffect(() => {
    if (dbReady && fontsLoaded && needsOnboarding) {
      router.replace('/onboarding' as never);
    }
  }, [dbReady, fontsLoaded, needsOnboarding]);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="log-pain"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="log-medication"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="entry/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="dose-edit/[id]"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen name="settings"   options={{ presentation: 'card' }} />
        <Stack.Screen name="about"      options={{ presentation: 'card' }} />
        <Stack.Screen name="dev-tools"  options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
