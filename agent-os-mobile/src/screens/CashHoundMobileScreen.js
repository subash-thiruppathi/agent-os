import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';
import { ApprovalStack } from '../components/ApprovalStack.js';

export function CashHoundMobileScreen() {
  const [approvals, setApprovals] = useState([
    {
      id: 'inv-high-99',
      agentName: 'CashHound',
      title: 'High-Value Dunning Notice: Acme Corp',
      description: 'Invoice #1094 is 38 days overdue. CashHound drafted a Tier-2 firm reminder. Balance exceeds $5,000 threshold.',
      amountFormatted: '$8,400.00',
      timestamp: '10m ago'
    }
  ]);

  const [activeBucket, setActiveBucket] = useState('30+');
  const [testCustomer, setTestCustomer] = useState('');

  const handleApprove = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Action Dispatched', 'Firm reminder sent to client with secure Stripe payment link.');
  };

  const handleReject = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Action Cancelled', 'Dunning message cancelled. Account tagged for executive outreach.');
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Revenue Recovery Velocity"
        subtitle="CashHound Autonomous Collections"
        metric="$24,650 Recovered"
        highlightColor="#10B981"
        details={[
          { label: 'Days Sales Outstanding (DSO)', value: '31 Days (-14d improvement)' },
          { label: 'Active Dunning Campaigns', value: '18 in progress' },
          { label: 'Settlement Plan Inquiries', value: '4 pending' }
        ]}
      />

      {/* Aging Filter */}
      <View style={styles.agingSection}>
        <Text style={styles.sectionTitle}>Aging Portfolio Breakdown</Text>
        <View style={styles.bucketRow}>
          {['Current', '30+', '60+', '90+'].map((bucket) => (
            <TouchableOpacity
              key={bucket}
              style={[styles.bucketTab, activeBucket === bucket && styles.bucketTabActive]}
              onPress={() => setActiveBucket(bucket)}
            >
              <Text style={[styles.bucketText, activeBucket === bucket && styles.bucketTextActive]}>
                {bucket}
              </Text>
            </TouchableOpacity>
          ))}
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
  agingSection: {
    marginBottom: 24
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  bucketRow: {
    flexDirection: 'row',
    gap: 8
  },
  bucketTab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  bucketTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA'
  },
  bucketText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  bucketTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});
