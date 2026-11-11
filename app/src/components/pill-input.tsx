import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type PillInputProps = Omit<TextInputProps, 'style'> & {
  icon?: IoniconName;
  /** Pesan galat inline; tidak memakai modal. */
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function PillInput({
  icon,
  error,
  containerStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...inputProps
}: PillInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            borderColor: error
              ? Colors.light.danger
              : focused
                ? Colors.light.inputBorderFocus
                : Colors.light.inputBorder,
          },
          containerStyle,
        ]}>
        {icon ? <Ionicons color={Colors.light.textSecondary} name={icon} size={20} /> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={Colors.light.textSecondary}
          style={styles.input}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
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
    backgroundColor: Colors.light.inputFill,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two,
    color: Colors.light.text,
    ...Typography.body,
  },
  error: {
    ...Typography.meta,
    color: Colors.light.danger,
    paddingHorizontal: Spacing.three,
  },
});
