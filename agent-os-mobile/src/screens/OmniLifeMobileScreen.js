import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';
import { ApprovalStack } from '../components/ApprovalStack.js';

export function OmniLifeMobileScreen() {
  const [approvals, setApprovals] = useState([
    {
      id: 'sub-gym-cancel',
      agentName: 'OmniLife',
      title: 'Dormant Subscription Cancellation: Fitness Gym',
      description: 'Unused for 120 days. Early termination penalty of $50.00 applies, but net projected yearly savings is $670.00.',
      amountFormatted: '$670/yr net savings',
      timestamp: '25m ago'
    }
  ]);

  const handleApprove = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Subscription Cancelled', 'Cancellation notice transmitted with biometric confirmation.');
  };

  const handleReject = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Kept Active', 'Subscription retained.');
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Personal Life Operating System"
        subtitle="OmniLife Autonomous Guardian"
        metric="$740.00 Saved / Yr"
        highlightColor="#EC4899"
        details={[
          { label: 'Passport Travel Validity', value: 'Expiring in 78 days (ALERT)' },
          { label: 'Calendar Collisions Resolved', value: '2 rescheduled' },
          { label: 'Household Bills Audited', value: '6 checked (0 surprises)' }
        ]}
      />

      {/* Travel Passport Warning Card */}
      <View style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>International Travel Alert</Text>
        </View>
        <Text style={styles.warningDesc}>
          Trip to Tokyo departure date is within 90 days. Passport has only 78 days remaining validity. Immigration mandates 180 days.
        </Text>
        <TouchableOpacity
          style={styles.expediteBtn}
          onPress={() => Alert.alert('Renewal Initiated', 'Appointment packet prepared for nearest passport agency.')}
        >
          <Text style={styles.expediteBtnText}>One-Tap Expedite Passport Renewal</Text>
        </TouchableOpacity>
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
  warningCard: {
    backgroundColor: '#311414',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7F1D1D'
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  warningIcon: {
    fontSize: 18
  },
  warningTitle: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700'
  },
  warningDesc: {
    color: '#FECACA',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16
  },
  expediteBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  expediteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
