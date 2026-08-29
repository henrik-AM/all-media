import React, { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import { colors, spacing, typography } from '../constants/design';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState((state) => ({
      ...state,
      errorInfo,
    }));
    console.error('Error caught:', error, errorInfo);
  }

  resetError = () => {
    this.setState({
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
            <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
            <Text style={styles.message}>
              Die App ist auf einen unerwarteten Fehler gestoßen. Bitte versuche es erneut.
            </Text>

            {__DEV__ && (
              <View style={styles.devInfo}>
                <Text style={styles.devTitle}>Debug Info:</Text>
                <Text style={styles.devText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.devStack} numberOfLines={5}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <Druck style={styles.button} onPress={this.resetError}>
              <Text style={styles.buttonText}>Neuer Versuch</Text>
            </Druck>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.message,
    color: colors.text2,
    textAlign: 'center',
    maxWidth: 280,
  },
  devInfo: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: 8,
    maxWidth: '100%',
  },
  devTitle: {
    ...typography.small,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  devText: {
    ...typography.small,
    color: colors.danger,
    fontFamily: 'Menlo',
  },
  devStack: {
    ...typography.small,
    color: colors.text3,
    fontFamily: 'Menlo',
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: 12,
  },
  buttonText: {
    ...typography.message,
    color: colors.white,
    fontWeight: '600',
  },
});
