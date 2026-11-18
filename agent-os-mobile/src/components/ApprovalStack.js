import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export function ApprovalStack({ approvals = [], onApprove, onReject }) {
  if (approvals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛡️</Text>
        <Text style={styles.emptyTitle}>Approval Queue Clear</Text>
        <Text style={styles.emptySubtitle}>All autonomous agent actions operating within policy bounds.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stackContainer}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionHeading}>Pending Approval Stack</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{approvals.length} pending</Text>
        </View>
      </View>

      {approvals.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.agentTag}>
              <Text style={styles.agentTagText}>{item.agentName}</Text>
            </View>
            <Text style={styles.itemTime}>{item.timestamp || 'Just now'}</Text>
          </View>

          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDescription}>{item.description}</Text>

          {item.amountFormatted && (
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Total Value at Risk:</Text>
              <Text style={styles.amountValue}>{item.amountFormatted}</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => onReject && onReject(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => onApprove && onApprove(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.approveBtnText}>Approve & Execute</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stackContainer: {
    marginBottom: 24
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionHeading: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700'
  },
  countBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  itemCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  agentTag: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  agentTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  itemTime: {
    color: '#94A3B8',
    fontSize: 12
  },
  itemTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  itemDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16
  },
  amountLabel: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600'
  },
  amountValue: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectBtn: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569'
  },
  rejectBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600'
  },
  approveBtn: {
    backgroundColor: '#10B981'
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#131B2E',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center'
  }
});
