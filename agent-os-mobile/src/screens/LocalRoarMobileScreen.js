import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { OutcomeCard } from '../components/OutcomeCard.js';

export function LocalRoarMobileScreen() {
  const [inquiryText, setInquiryText] = useState('Pipe burst under master bathroom sink! Water everywhere, need help now. 555-401-2019');
  const [parsedLead, setParsedLead] = useState(null);

  const handleSimulateInquiry = () => {
    setParsedLead({
      service: 'Emergency Plumbing Repair',
      urgency: 'HIGH',
      estQuote: '$112.50',
      slot: 'Today, 2:00 PM',
      phone: '555-401-2019'
    });
  };

  const handleConfirmAndSendQuote = () => {
    Alert.alert(
      'Lead Converted & Booked!',
      `Quote of ${parsedLead.estQuote} dispatched via SMS to ${parsedLead.phone}. Slot locked. 5-star review request scheduled 2h post completion.`
    );
    setParsedLead(null);
  };

  return (
    <View style={styles.container}>
      <OutcomeCard
        title="Local Business Growth Engine"
        subtitle="LocalRoar 24/7 Inbound Machine"
        metric="68% Conversion Rate"
        highlightColor="#F59E0B"
        details={[
          { label: 'Weekly Projected Revenue', value: '$4,850.00' },
          { label: 'Jobs Booked (Last 7d)', value: '38 completed' },
          { label: 'Google Review Invites Sent', value: '34 sent (4.9 avg rating)' }
        ]}
      />

      <View style={styles.leadSimulatorCard}>
        <Text style={styles.cardHeader}>Inbound Lead Receiver (SMS / Web / WhatsApp)</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={3}
          value={inquiryText}
          onChangeText={setInquiryText}
        />
        <TouchableOpacity
          style={styles.parseBtn}
          onPress={handleSimulateInquiry}
        >
          <Text style={styles.parseBtnText}>Process Lead with LocalRoar</Text>
        </TouchableOpacity>
      </View>

      {parsedLead && (
        <View style={styles.quoteProposalCard}>
          <View style={styles.quoteHeader}>
            <Text style={styles.quoteTitle}>{parsedLead.service}</Text>
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>{parsedLead.urgency}</Text>
            </View>
          </View>

          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Dynamic Estimate:</Text>
            <Text style={styles.quoteVal}>{parsedLead.estQuote}</Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Reserved Slot:</Text>
            <Text style={styles.quoteVal}>{parsedLead.slot}</Text>
          </View>

          <TouchableOpacity
            style={styles.bookBtn}
            onPress={handleConfirmAndSendQuote}
          >
            <Text style={styles.bookBtnText}>Confirm Booking & Send SMS Quote</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24
  },
  leadSimulatorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardHeader: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  parseBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  quoteProposalCard: {
    backgroundColor: '#131B2E',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 24
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  quoteTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700'
  },
  urgentBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  urgentText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  quoteLabel: {
    color: '#94A3B8',
    fontSize: 13
  },
  quoteVal: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700'
  },
  bookBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
