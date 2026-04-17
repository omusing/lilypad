import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_400Regular,
} from '@expo-google-fonts/fraunces';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { runMigrations } from '@/db/migrate';
import { getSettings } from '@/db/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Fraunces: Fraunces_400Regular,
    FrauncesSemiBold: Fraunces_600SemiBold,
    InstrumentSans: InstrumentSans_400Regular,
    InstrumentSansMedium: InstrumentSans_500Medium,
    InstrumentSansSemiBold: InstrumentSans_600SemiBold,
  });

  useEffect(() => {
    runMigrations()
      .then(() => getSettings())
      .then(settings => {
        setDbReady(true);
        if (!settings.onboarding_done) {
          router.replace('/onboarding' as never);
        }
      })
      .catch(console.error);
  }, []);

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
        <Stack.Screen name="medication/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings"        options={{ presentation: 'card' }} />
        <Stack.Screen name="about"           options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
