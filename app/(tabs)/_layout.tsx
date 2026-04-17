import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize } from '@/constants/theme';

function LogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  function handleLogPain() {
    onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/log-pain' as any);
  }

  function handleLogMedication() {
    onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/log-medication' as any);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>What would you like to log?</Text>

        <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPain]} onPress={handleLogPain} activeOpacity={0.85}>
          <Ionicons name="pulse" size={22} color="#fff" />
          <Text style={styles.sheetBtnLabel}>Log Pain</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnMed]} onPress={handleLogMedication} activeOpacity={0.85}>
          <Ionicons name="medical" size={22} color="#fff" />
          <Text style={styles.sheetBtnLabel}>Log Medication</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
          <Text style={styles.sheetCancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function TabLayout() {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.brand,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={styles.logBtn}>
                <Ionicons name="add" size={28} color="#fff" />
              </View>
            ),
          }}
          listeners={{
            tabPress: e => {
              e.preventDefault();
              setSheetVisible(true);
            },
          }}
        />
        <Tabs.Screen
          name="medications"
          options={{
            title: 'Medications',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'medical' : 'medical-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Report',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
            ),
          }}
        />
        {/* Non-tab routes that Expo Router picks up — hide from tab bar */}
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>

      <LogSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.card,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 83,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.tabLabel,
  },
  logBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  // Sheet
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
    marginBottom: 12,
  },
  sheetBtnPain: { backgroundColor: Colors.pain },
  sheetBtnMed:  { backgroundColor: Colors.med },
  sheetBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    fontWeight: '600',
    color: '#fff',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  sheetCancelLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
});
