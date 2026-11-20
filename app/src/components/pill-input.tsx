import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type RefObject } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type PillInputProps = Omit<TextInputProps, 'style'> & {
  icon?: IoniconName;
  /** Pesan galat inline; tidak memakai modal. */
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputRef?: RefObject<TextInputInstance | null>;
};

export function PillInput({
  icon,
  error,
  containerStyle,
  inputRef,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...inputProps
}: PillInputProps) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.inputFill,
            borderColor: error
              ? theme.danger
              : focused
                ? theme.inputBorderFocus
                : theme.inputBorder,
          },
          containerStyle,
        ]}>
        {icon ? <Ionicons color={theme.textSecondary} name={icon} size={20} /> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel}
          ref={inputRef}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two,
    ...Typography.body,
  },
  error: {
    ...Typography.meta,
    paddingHorizontal: Spacing.three,
  },
});
