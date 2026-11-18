import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity
} from 'react-native';

import { CashHoundMobileScreen } from './src/screens/CashHoundMobileScreen.js';
import { ResolveXMobileScreen } from './src/screens/ResolveXMobileScreen.js';
import { SentinelMeshMobileScreen } from './src/screens/SentinelMeshMobileScreen.js';
import { LocalRoarMobileScreen } from './src/screens/LocalRoarMobileScreen.js';
import { PulseMDMobileScreen } from './src/screens/PulseMDMobileScreen.js';
import { OmniLifeMobileScreen } from './src/screens/OmniLifeMobileScreen.js';

const AGENT_TABS = [
  { id: 'CashHound', label: 'CashHound', icon: '🪙' },
  { id: 'ResolveX', label: 'ResolveX', icon: '⚡' },
  { id: 'SentinelMesh', label: 'Sentinel', icon: '🛡️' },
  { id: 'LocalRoar', label: 'LocalRoar', icon: '📣' },
  { id: 'PulseMD', label: 'PulseMD', icon: '🩺' },
  { id: 'OmniLife', label: 'OmniLife', icon: '🌐' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('CashHound');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>⚡</Text>
          </View>
          <View>
            <Text style={styles.appName}>AgentOS Mobile</Text>
            <Text style={styles.appTagline}>Autonomous Mobile Operating System</Text>
          </View>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.greenPulse} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {/* Agent Selector Bar */}
      <View style={styles.selectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorContainer}
        >
          {AGENT_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.agentPill, activeTab === tab.id && styles.agentPillActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.agentIcon}>{tab.icon}</Text>
              <Text style={[styles.agentLabel, activeTab === tab.id && styles.agentLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'CashHound' && <CashHoundMobileScreen />}
        {activeTab === 'ResolveX' && <ResolveXMobileScreen />}
        {activeTab === 'SentinelMesh' && <SentinelMeshMobileScreen />}
        {activeTab === 'LocalRoar' && <LocalRoarMobileScreen />}
        {activeTab === 'PulseMD' && <PulseMDMobileScreen />}
        {activeTab === 'OmniLife' && <OmniLifeMobileScreen />}
      </ScrollView>

      {/* Bottom Global Status Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomStatusText}>
          Active Agent: <Text style={styles.bottomActiveAgent}>{activeTab}</Text> · Human Oversight Active
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#090D16'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    fontSize: 20
  },
  appName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  appTagline: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500'
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 6
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981'
  },
  liveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700'
  },
  selectorWrapper: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  selectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6
  },
  agentPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA'
  },
  agentIcon: {
    fontSize: 14
  },
  agentLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  agentLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  mainContainer: {
    flex: 1
  },
  scrollContent: {
    padding: 20
  },
  bottomBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0B1120',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    alignItems: 'center'
  },
  bottomStatusText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500'
  },
  bottomActiveAgent: {
    color: '#38BDF8',
    fontWeight: '700'
  }
});
