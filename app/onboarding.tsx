import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget,
} from '@/constants/theme';
import { updateSettings } from '@/db/settings';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Step content ─────────────────────────────────────────────────────────────

interface StepProps {
  name:    string;
  setName: (v: string) => void;
}

function Step1() {
  return (
    <View style={step.wrap}>
      <View style={step.iconCircle}>
        <Ionicons name="leaf" size={48} color={Colors.brand} />
      </View>
      <Text style={step.heading}>Welcome to Lilypad</Text>
      <Text style={step.body}>
        A private journal for tracking your pain, medications, and how you feel day to day.
      </Text>
      <Text style={step.body}>
        Everything stays on your device. Nothing is shared or uploaded.
      </Text>
    </View>
  );
}

function Step2({ name, setName }: StepProps) {
  return (
    <View style={step.wrap}>
      <View style={step.iconCircle}>
        <Ionicons name="person-outline" size={48} color={Colors.brand} />
      </View>
      <Text style={step.heading}>What should we call you?</Text>
      <Text style={step.body}>
        We'll use your name in the greeting. Totally optional.
      </Text>
      <TextInput
        style={step.input}
        value={name}
        onChangeText={setName}
        placeholder="Your first name"
        placeholderTextColor={Colors.textSecondary}
        returnKeyType="done"
        autoFocus
        autoCorrect={false}
      />
    </View>
  );
}

function Step3() {
  return (
    <View style={step.wrap}>
      <View style={step.iconCircle}>
        <Ionicons name="pulse" size={48} color={Colors.pain} />
      </View>
      <Text style={step.heading}>Log your pain</Text>
      <Text style={step.body}>
        Rate your pain from 0 to 10, mark where it is on your body, and describe its quality.
      </Text>
      <Text style={step.body}>
        You can log multiple times per day — before and after medication, or when pain flares.
      </Text>
    </View>
  );
}

function Step4() {
  return (
    <View style={step.wrap}>
      <View style={step.iconCircle}>
        <Ionicons name="medical" size={48} color={Colors.med} />
      </View>
      <Text style={step.heading}>Track your medications</Text>
      <Text style={step.body}>
        Add your medications once, then log each dose with one tap.
      </Text>
      <Text style={step.body}>
        The Report tab shows trends over time so you can share meaningful data with your care team.
      </Text>
    </View>
  );
}

const step = StyleSheet.create({
  wrap: {
    width: SCREEN_W - Spacing.lg * 2,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  heading: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.body * 1.6,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.sm,
    ...Shadow.card,
  },
});

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[dots.dot, i === current && dots.active]} />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  active: { backgroundColor: Colors.brand, width: 24 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const [step, setStep]   = useState(0);
  const [name, setName]   = useState('');
  const scrollRef         = useRef<ScrollView>(null);

  function scrollTo(index: number) {
    scrollRef.current?.scrollTo({ x: index * (SCREEN_W - Spacing.lg * 2 + Spacing.lg * 2), animated: true });
  }

  function goNext() {
    if (step < TOTAL_STEPS - 1) {
      const next = step + 1;
      setStep(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    } else {
      finish();
    }
  }

  function goBack() {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      scrollRef.current?.scrollTo({ x: prev * SCREEN_W, animated: true });
    }
  }

  async function finish() {
    await updateSettings({
      patient_name:    name.trim() || null,
      onboarding_done: true,
    });
    router.replace('/(tabs)' as never);
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* Steps */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={styles.slides}
        >
          <View style={styles.slide}><Step1 /></View>
          <View style={styles.slide}><Step2 name={name} setName={setName} /></View>
          <View style={styles.slide}><Step3 /></View>
          <View style={styles.slide}><Step4 /></View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Dots total={TOTAL_STEPS} current={step} />

          <View style={styles.footerBtns}>
            {step > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 44 }} />
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.nextLabel}>{isLast ? 'Get started' : 'Next'}</Text>
              {!isLast && <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </TouchableOpacity>

            {step < TOTAL_STEPS - 1 ? (
              <TouchableOpacity style={styles.skipBtn} onPress={finish} hitSlop={8}>
                <Text style={styles.skipLabel}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  slides: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  nextBtn: {
    height: TouchTarget.primary,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nextLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#fff',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  skipBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },
});
