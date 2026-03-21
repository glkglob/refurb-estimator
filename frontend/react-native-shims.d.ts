declare module "react-native" {
  import * as React from "react";

  type StyleValue = Record<string, unknown>;
  type StyleProp = StyleValue | Array<StyleValue | undefined | null> | undefined | null;

  interface BaseProps {
    children?: React.ReactNode;
    style?: StyleProp;
  }

  interface PressableProps extends BaseProps {
    disabled?: boolean;
    onPress?: () => void;
  }

  interface ScrollViewProps extends BaseProps {
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    contentContainerStyle?: StyleProp;
  }

  interface TextInputProps extends BaseProps {
    value?: string;
    onChangeText?: (value: string) => void;
    keyboardType?: string;
    placeholder?: string;
    multiline?: boolean;
  }

  interface ImageProps extends BaseProps {
    source: { uri: string };
  }

  interface ActivityIndicatorProps extends BaseProps {
    color?: string;
    size?: "small" | "large" | number;
  }

  export const View: React.ComponentType<BaseProps>;
  export const Text: React.ComponentType<BaseProps>;
  export const SafeAreaView: React.ComponentType<BaseProps>;
  export const ScrollView: React.ComponentType<ScrollViewProps>;
  export const Pressable: React.ComponentType<PressableProps>;
  export const TextInput: React.ComponentType<TextInputProps>;
  export const Image: React.ComponentType<ImageProps>;
  export const ActivityIndicator: React.ComponentType<ActivityIndicatorProps>;

  export const Alert: {
    alert: (title: string, message?: string) => void;
  };

  export const StyleSheet: {
    create: <T extends Record<string, Record<string, unknown>>>(styles: T) => T;
  };
}

declare module "expo-image-picker" {
  export interface ImagePickerAsset {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  }

  export type ImagePickerResult =
    | { canceled: true; assets: [] }
    | { canceled: false; assets: ImagePickerAsset[] };

  export interface ImagePickerPermissionResponse {
    granted: boolean;
  }

  export interface ImagePickerOptions {
    mediaTypes?: string;
    quality?: number;
    allowsMultipleSelection?: boolean;
    selectionLimit?: number;
  }

  export const MediaTypeOptions: {
    Images: string;
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<ImagePickerPermissionResponse>;
  export function requestCameraPermissionsAsync(): Promise<ImagePickerPermissionResponse>;
  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
}
