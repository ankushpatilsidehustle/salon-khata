import { useRef } from "react";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  maxLength?: number;
  multiline?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TextField({
  autoCapitalize = "sentences",
  disabled = false,
  error,
  helper,
  keyboardType,
  label,
  maxLength,
  multiline = false,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  style,
  testID,
  value
}: TextFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const hasError = !!error;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => inputRef.current?.focus()} disabled={disabled}>
        <View
          style={[
            styles.inputWrapper,
            hasError ? styles.inputError : styles.inputDefault,
            disabled && styles.inputDisabled
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, multiline && styles.inputMultiline]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.text.muted}
            keyboardType={keyboardType}
            maxLength={maxLength}
            multiline={multiline}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            autoCapitalize={autoCapitalize}
            editable={!disabled}
            testID={testID}
          />
        </View>
      </Pressable>
      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1]
  },
  label: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: "500"
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.default,
    paddingHorizontal: spacing[3],
    minHeight: 48,
    justifyContent: "center"
  },
  inputDefault: {
    borderColor: colors.border.subtle
  },
  inputError: {
    borderColor: colors.status.danger
  },
  inputDisabled: {
    backgroundColor: colors.interactive.disabled,
    opacity: 0.6
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    padding: 0 // remove default Android internal padding
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    textAlignVertical: "top"
  },
  errorText: {
    ...typography.caption,
    color: colors.status.danger
  },
  helperText: {
    ...typography.caption,
    color: colors.text.muted
  }
});
