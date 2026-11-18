import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';

export function SentinelMeshMobileScreen() {
  const [agents, setAgents] = useState([
    { id: 'cashhound-worker', name: 'CashHound Operator', status: 'ACTIVE', spendLimit: '$1,000.00', alerts: 0 },
    { id: 'resolvex-worker', name: 'ResolveX Care Concierge', status: 'ACTIVE', spendLimit: '$100.00', alerts: 0 },
    { id: 'localroar-worker', name: 'LocalRoar Growth Bot', status: 'ACTIVE', spendLimit: 'N/A', alerts: 0 },
    { id: 'pulsemd-worker', name: 'PulseMD Clinical Bot', status: 'GUARDED', spendLimit: 'N/A', alerts: 1 }
  ]);

  const [globalKillSwitch, setGlobalKillSwitch] = useState(false);

  const toggleAgentHalt = (id) => {
    setAgents(agents.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === 'ACTIVE' ? 'QUARANTINED' : 'ACTIVE';
        Alert.alert('Sentinel Security Action', `Agent ${a.name} is now ${nextStatus}.`);
        return { ...a, status: nextStatus };
      }
      return a;
    }));
  };

  const handleGlobalHalt = (val) => {
    setGlobalKillSwitch(val);
    if (val) {
      Alert.alert('EMERGENCY KILL-SWITCH TRIPPED', 'All autonomous agent execution suspended immediately across all tenants.');
    } else {
      Alert.alert('System Resumed', 'Agent execution restored under sandbox governance.');
    }
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Agent Governance & Sandboxing"
        subtitle="SentinelMesh Zero-Trust Fabric"
        metric="Zero Violations"
        highlightColor="#10B981"
        details={[
          { label: 'Cryptographic Audit Blocks', value: '1,492 SHA-256 blocks' },
          { label: 'Runtime Policy Checks', value: '100% verified' },
          { label: 'Sandbox Isolation', value: 'Active' }
        ]}
      />

      {/* Emergency Kill-Switch Bar */}
      <View style={[styles.killSwitchCard, globalKillSwitch && styles.killSwitchActive]}>
        <View style={styles.killSwitchTextContainer}>
          <Text style={styles.killSwitchTitle}>Global Emergency Kill-Switch</Text>
          <Text style={styles.killSwitchSubtitle}>Immediately suspends all agent tool executions</Text>
        </View>
        <Switch
          value={globalKillSwitch}
          onValueChange={handleGlobalHalt}
          trackColor={{ false: '#334155', true: '#EF4444' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Roster & Quarantine Controls */}
      <View style={styles.rosterSection}>
        <Text style={styles.sectionTitle}>Agent Authorization Roster</Text>
        {agents.map((ag) => (
          <View key={ag.id} style={styles.agentCard}>
            <View style={styles.agentInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.agentName}>{ag.name}</Text>
                <View style={[styles.statusBadge, ag.status === 'ACTIVE' ? styles.statusActive : styles.statusQuarantine]}>
                  <Text style={styles.statusText}>{ag.status}</Text>
                </View>
              </View>
              <Text style={styles.agentLimit}>Auto-Spend Limit: {ag.spendLimit}</Text>
            </View>

            <TouchableOpacity
              style={[styles.haltBtn, ag.status === 'QUARANTINED' ? styles.resumeBtn : styles.quarantineBtn]}
              onPress={() => toggleAgentHalt(ag.id)}
            >
              <Text style={styles.haltBtnText}>
                {ag.status === 'ACTIVE' ? 'Quarantine' : 'Restore'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24
  },
  killSwitchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  killSwitchActive: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444'
  },
  killSwitchTextContainer: {
    flex: 1,
    marginRight: 12
  },
  killSwitchTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700'
  },
  killSwitchSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4
  },
  rosterSection: {
    marginBottom: 24
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  agentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  agentInfo: {
    flex: 1,
    marginRight: 12
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  agentName: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)'
  },
  statusQuarantine: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700'
  },
  agentLimit: {
    color: '#64748B',
    fontSize: 12
  },
  haltBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  quarantineBtn: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569'
  },
  resumeBtn: {
    backgroundColor: '#10B981'
  },
  haltBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
