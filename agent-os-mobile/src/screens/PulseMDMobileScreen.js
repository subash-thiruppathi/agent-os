import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';
import { ApprovalStack } from '../components/ApprovalStack.js';

export function PulseMDMobileScreen() {
  const [approvals, setApprovals] = useState([
    {
      id: 'soap-902',
      agentName: 'PulseMD',
      title: 'Physician Signature: Lumbar Spine MRI Order',
      description: 'Draft SOAP note prepared for Patient #PT-8492. Prior-auth verified: 6-week conservative physical therapy and radiographs confirmed on file.',
      amountFormatted: 'CPT 72148',
      timestamp: '12m ago'
    }
  ]);

  const handleApprove = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('SOAP Note Signed & Locked', 'Chart note finalized and submitted directly to payer prior-authorization portal.');
  };

  const handleReject = (id) => {
    setApprovals(approvals.filter(a => a.id !== id));
    Alert.alert('Returned for Revision', 'Clinical note marked for follow-up review.');
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Clinical Administrative Relief"
        subtitle="PulseMD AI Medical Scribe & Auth Agent"
        metric="2.3 hrs / day saved"
        highlightColor="#8B5CF6"
        details={[
          { label: 'Chart Notes Drafted Today', value: '14 encounters' },
          { label: 'Prior-Auth First-Pass Approval', value: '96.4%' },
          { label: 'Clinician Review Compliance', value: '100% human-signed' }
        ]}
      />

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
  }
});
