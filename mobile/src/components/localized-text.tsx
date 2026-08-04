import type { ReactNode } from 'react';
import {
  Alert,
  Pressable as NativePressable,
  Text as NativeText,
  TextInput as NativeTextInput,
  type AlertButton,
  type AlertOptions,
  type PressableProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { localizeCopy } from '@/i18n/copy-catalog';
import { getRuntimeLanguage } from '@/i18n/language-runtime';
import { useAppLanguage } from '@/providers/language-provider';

function localizeNode(node: ReactNode, language: 'tr' | 'en'): ReactNode {
  if (typeof node === 'string') return localizeCopy(node, language);
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, language));
  return node;
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { language } = useAppLanguage();
  return <NativeText {...props}>{localizeNode(children, language)}</NativeText>;
}

export function LocalizedTextInput({ placeholder, accessibilityLabel, ...props }: TextInputProps) {
  const { language } = useAppLanguage();
  return (
    <NativeTextInput
      {...props}
      accessibilityLabel={accessibilityLabel ? localizeCopy(accessibilityLabel, language) : accessibilityLabel}
      placeholder={placeholder ? localizeCopy(placeholder, language) : placeholder}
    />
  );
}

export function LocalizedPressable({ accessibilityHint, accessibilityLabel, ...props }: PressableProps) {
  const { language } = useAppLanguage();
  return (
    <NativePressable
      {...props}
      accessibilityHint={accessibilityHint ? localizeCopy(accessibilityHint, language) : accessibilityHint}
      accessibilityLabel={accessibilityLabel ? localizeCopy(accessibilityLabel, language) : accessibilityLabel}
    />
  );
}

export function localizedAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) {
  const language = getRuntimeLanguage();
  return Alert.alert(
    localizeCopy(title, language),
    message ? localizeCopy(message, language) : undefined,
    buttons?.map((button) => ({
      ...button,
      text: button.text ? localizeCopy(button.text, language) : button.text,
    })),
    options,
  );
}
