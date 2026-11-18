import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export function OutcomeCard({ title, subtitle, metric, highlightColor = '#10B981', details = [] }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {metric ? (
          <View style={[styles.metricBadge, { borderColor: highlightColor }]}>
            <Text style={[styles.metricText, { color: highlightColor }]}>{metric}</Text>
          </View>
        ) : null}
      </View>

      {details.length > 0 && (
        <View style={styles.detailsContainer}>
          {details.map((item, idx) => (
            <View key={idx} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  textContainer: {
    flex: 1,
    marginRight: 12
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4
  },
  metricBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  metricText: {
    fontSize: 14,
    fontWeight: '700'
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 16
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 13
  },
  detailValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600'
  }
});
