import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';
import { mockContacts } from '../../mocks';

export const ContactsScreen = () => {
  const renderContactItem = ({ item }: any) => (
    <TouchableOpacity style={styles.contactItem}>
      <View style={styles.avatar}>
        <Text>👤</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.status}>{item.status === 'friend' ? '✓ Kontakt' : 'Ausstehend'}</Text>
      </View>
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kontakte</Text>
      <FlatList
        data={mockContacts}
        renderItem={renderContactItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: typography.h2.fontSize, fontWeight: '700', padding: spacing.md },
  contactItem: { flexDirection: 'row', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lightGray, alignItems: 'center' },
  avatar: { width: sizes.avatar, height: sizes.avatar, borderRadius: radius.medium, backgroundColor: colors.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  contactInfo: { flex: 1 },
  name: { fontSize: typography.body.fontSize, fontWeight: '600', color: colors.darkGray },
  status: { fontSize: typography.small.fontSize, color: colors.mediumGray, marginTop: spacing.xs },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: colors.white, fontSize: 20, fontWeight: '700' },
});
