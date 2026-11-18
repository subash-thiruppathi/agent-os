import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';
import { ApprovalStack } from '../components/ApprovalStack.js';

export function ResolveXMobileScreen() {
  const [approvals, setApprovals] = useState([
    {
      id: 'res-esc-402',
      agentName: 'ResolveX',
      title: 'High-Value Refund Request: Damaged Monitor',
      description: 'Customer reports shattered panel on delivery with photo evidence. Total purchase amount $349.99 exceeds auto-limit ($100).',
      amountFormatted: '$349.99',
      timestamp: '5m ago'
    }
  ]);

  const handleApprove = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Refund Executed', 'Immediate refund of $349.99 issued to customer card via Stripe.');
  };

  const handleReject = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Escalated', 'Transferred to tier-2 human claims team.');
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Customer Issue Resolution"
        subtitle="ResolveX Autonomous Care Concierge"
        metric="94.2% Auto-Resolved"
        highlightColor="#3B82F6"
        details={[
          { label: 'Autonomous Resolutions Today', value: '47 issues fixed' },
          { label: 'Average Resolution Latency', value: '1.4 seconds' },
          { label: 'CSAT Post-Resolution', value: '4.85 / 5.0 ⭐' }
        ]}
      />

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>32</Text>
          <Text style={styles.statLabel}>Auto-Refunds</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>11</Text>
          <Text style={styles.statLabel}>Replacements</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>4</Text>
          <Text style={styles.statLabel}>Carrier Traces</Text>
        </View>
      </View>

      <ApprovalStack
        approvals={approvals}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  statVal: {
    color: '#60A5FA',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center'
  }
});
