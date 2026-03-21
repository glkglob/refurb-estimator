import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import type {
  DesignerAgentResponse,
  DesignerMaterialsItem,
  DesignerRoomType,
  DesignerStyleVariant,
  DesignerTargetSpec
} from "../../../shared/designerTypes";

const MAX_IMAGES = 5;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

interface UploadableImage {
  uri: string;
  fileName: string;
  mimeType: string;
}

interface AnalyseRoomPayload {
  images: UploadableImage[];
  propertySizeM2: number;
  roomType: DesignerRoomType;
  targetSpec: DesignerTargetSpec;
  preferredStyles: string;
}

interface UpdateEstimateWithDesignInput {
  materialsSpec: DesignerMaterialsItem[];
  approxRoomAreaM2: number;
}

const ROOM_TYPES: DesignerRoomType[] = ["living room", "bedroom", "kitchen", "bathroom", "other"];
const TARGET_SPECS: DesignerTargetSpec[] = ["basic", "standard", "premium"];

function toUploadableImages(assets: ImagePicker.ImagePickerAsset[]): UploadableImage[] {
  return assets
    .filter((asset) => typeof asset.uri === "string" && asset.uri.length > 0)
    .map((asset, index) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? `room-photo-${Date.now()}-${index + 1}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg"
    }));
}

function mergeImages(current: UploadableImage[], incoming: UploadableImage[]): UploadableImage[] {
  return [...current, ...incoming].slice(0, MAX_IMAGES);
}

async function analyseRoom(payload: AnalyseRoomPayload): Promise<DesignerAgentResponse> {
  const formData = new FormData();
  formData.append(
    "metadata",
    JSON.stringify({
      propertySizeM2: payload.propertySizeM2,
      roomType: payload.roomType,
      targetSpec: payload.targetSpec,
      preferredStyles: payload.preferredStyles
    })
  );

  for (const image of payload.images) {
    const fileLike = {
      uri: image.uri,
      type: image.mimeType,
      name: image.fileName
    };
    formData.append("images", fileLike as unknown as Blob);
  }

  const response = await fetch(`${API_BASE_URL}/api/designer/analyse-room`, {
    method: "POST",
    body: formData
  });

  const payloadJson: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payloadJson === "object" &&
      payloadJson !== null &&
      "error" in payloadJson &&
      typeof payloadJson.error === "string"
        ? payloadJson.error
        : "Room analysis failed";
    throw new Error(message);
  }

  return payloadJson as DesignerAgentResponse;
}

async function updateEstimateWithDesign(input: UpdateEstimateWithDesignInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/cost/estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      materials_spec: input.materialsSpec,
      approx_room_area_m2: input.approxRoomAreaM2
    })
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Failed to update estimate with selected design";
    throw new Error(message);
  }
}

function OptionChip<T extends string>({
  label,
  value,
  selectedValue,
  onSelect
}: {
  label: string;
  value: T;
  selectedValue: T;
  onSelect: (next: T) => void;
}): React.JSX.Element {
  const selected = value === selectedValue;
  return (
    <Pressable
      onPress={() => onSelect(value)}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : styles.chipLabelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StyleVariantCard({
  variant,
  selected,
  loading,
  onSelect
}: {
  variant: DesignerStyleVariant;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onSelect}
      disabled={loading}
      style={[styles.variantCard, selected ? styles.variantCardSelected : styles.variantCardDefault]}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image source={{ uri: variant.render_image_url }} style={styles.variantImage} />
      <View style={styles.variantContent}>
        <Text style={styles.variantLabel}>{variant.label}</Text>
        <Text style={styles.variantDescription}>{variant.description}</Text>
        <Text style={styles.variantMeta}>
          {variant.materials_spec.length} materials · {selected ? "selected" : "tap to use"}
        </Text>
      </View>
      {loading ? <ActivityIndicator size="small" color="#0055cc" /> : null}
    </Pressable>
  );
}

export default function RoomDesignerScreen(): React.JSX.Element {
  const [images, setImages] = useState<UploadableImage[]>([]);
  const [propertySizeM2, setPropertySizeM2] = useState<string>("");
  const [roomType, setRoomType] = useState<DesignerRoomType>("living room");
  const [targetSpec, setTargetSpec] = useState<DesignerTargetSpec>("standard");
  const [preferredStyles, setPreferredStyles] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<DesignerAgentResponse | null>(null);
  const [selectedStyleKey, setSelectedStyleKey] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [applyingStyleKey, setApplyingStyleKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const canAnalyse = useMemo(() => {
    const parsed = Number(propertySizeM2);
    return images.length >= 1 && images.length <= MAX_IMAGES && Number.isFinite(parsed) && parsed > 0;
  }, [images.length, propertySizeM2]);

  async function pickFromLibrary(): Promise<void> {
    setErrorMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Media library permission is required to upload room photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES
    });

    if (result.canceled) {
      return;
    }

    setImages((current) => mergeImages(current, toUploadableImages(result.assets)));
  }

  async function captureWithCamera(): Promise<void> {
    setErrorMessage(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera permission is required to capture room photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });

    if (result.canceled) {
      return;
    }

    setImages((current) => mergeImages(current, toUploadableImages(result.assets)));
  }

  function removeImage(imageUri: string): void {
    setImages((current) => current.filter((image) => image.uri !== imageUri));
  }

  async function handleAnalyseRoom(): Promise<void> {
    setErrorMessage(null);
    setInfoMessage(null);

    const parsedSize = Number(propertySizeM2);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      setErrorMessage("Enter a valid property size in m².");
      return;
    }

    if (images.length < 1 || images.length > MAX_IMAGES) {
      setErrorMessage("Upload between 1 and 5 room photos.");
      return;
    }

    setLoadingAnalysis(true);
    try {
      const result = await analyseRoom({
        images,
        propertySizeM2: parsedSize,
        roomType,
        targetSpec,
        preferredStyles: preferredStyles.trim()
      });

      setAnalysisResult(result);
      setSelectedStyleKey(null);
      setInfoMessage("Design options ready. Pick one to apply it to the estimator.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to analyse room";
      setErrorMessage(message);
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function handleUseDesign(variant: DesignerStyleVariant): Promise<void> {
    if (!analysisResult) {
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setApplyingStyleKey(variant.style_key);
    setSelectedStyleKey(variant.style_key);

    try {
      await updateEstimateWithDesign({
        materialsSpec: variant.materials_spec,
        approxRoomAreaM2: analysisResult.approx_room_area_m2
      });

      setInfoMessage(`Applied "${variant.label}" to cost estimate.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update estimate";
      setErrorMessage(message);
    } finally {
      setApplyingStyleKey(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Room Designer</Text>
        <Text style={styles.subtitle}>Upload 1–5 photos and generate architect-grade style options.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Room Photos ({images.length}/{MAX_IMAGES})</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={captureWithCamera}>
              <Text style={styles.primaryButtonLabel}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={pickFromLibrary}>
              <Text style={styles.secondaryButtonLabel}>Upload Photos</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            {images.map((image) => (
              <Pressable key={image.uri} onPress={() => removeImage(image.uri)} style={styles.imageWrapper}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image source={{ uri: image.uri }} style={styles.previewImage} />
                <Text style={styles.imageHint}>Tap to remove</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <TextInput
            value={propertySizeM2}
            onChangeText={setPropertySizeM2}
            keyboardType="numeric"
            placeholder="Property size in m²"
            style={styles.input}
          />

          <Text style={styles.formLabel}>Room Type</Text>
          <View style={styles.chipRow}>
            {ROOM_TYPES.map((option) => (
              <OptionChip
                key={option}
                label={option}
                value={option}
                selectedValue={roomType}
                onSelect={setRoomType}
              />
            ))}
          </View>

          <Text style={styles.formLabel}>Target Spec</Text>
          <View style={styles.chipRow}>
            {TARGET_SPECS.map((option) => (
              <OptionChip
                key={option}
                label={option}
                value={option}
                selectedValue={targetSpec}
                onSelect={setTargetSpec}
              />
            ))}
          </View>

          <Text style={styles.formLabel}>Preferred Style Tags</Text>
          <TextInput
            value={preferredStyles}
            onChangeText={setPreferredStyles}
            placeholder="Scandi, Japandi, light and airy"
            style={[styles.input, styles.multiLineInput]}
            multiline
          />
        </View>

        <Pressable
          onPress={handleAnalyseRoom}
          disabled={!canAnalyse || loadingAnalysis}
          style={[
            styles.primaryButton,
            !canAnalyse || loadingAnalysis ? styles.buttonDisabled : undefined
          ]}
        >
          {loadingAnalysis ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonLabel}>Analyse Room</Text>
          )}
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

        {analysisResult ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Style Variants</Text>
            <Text style={styles.summaryText}>{analysisResult.room_summary}</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.variantRow}
            >
              {analysisResult.style_variants.map((variant) => (
                <StyleVariantCard
                  key={variant.style_key}
                  variant={variant}
                  selected={selectedStyleKey === variant.style_key}
                  loading={applyingStyleKey === variant.style_key}
                  onSelect={() => handleUseDesign(variant)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  content: {
    padding: 16,
    gap: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 14,
    color: "#334155"
  },
  section: {
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a"
  },
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  primaryButton: {
    backgroundColor: "#0f62fe",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonLabel: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 15
  },
  buttonDisabled: {
    opacity: 0.6
  },
  imageRow: {
    gap: 10
  },
  imageWrapper: {
    width: 120
  },
  previewImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#e2e8f0"
  },
  imageHint: {
    fontSize: 11,
    color: "#475569",
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff"
  },
  multiLineInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  formLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#334155",
    fontWeight: "600"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12
  },
  chipSelected: {
    borderColor: "#0f62fe",
    backgroundColor: "#dbeafe"
  },
  chipUnselected: {
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff"
  },
  chipLabel: {
    fontSize: 13
  },
  chipLabelSelected: {
    color: "#1d4ed8",
    fontWeight: "600"
  },
  chipLabelUnselected: {
    color: "#334155"
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14
  },
  infoText: {
    color: "#15803d",
    fontSize: 14
  },
  summaryText: {
    fontSize: 14,
    color: "#334155"
  },
  variantRow: {
    gap: 12,
    paddingVertical: 4
  },
  variantCard: {
    width: 280,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    overflow: "hidden"
  },
  variantCardDefault: {
    borderColor: "#cbd5e1"
  },
  variantCardSelected: {
    borderColor: "#0f62fe"
  },
  variantImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#e2e8f0"
  },
  variantContent: {
    padding: 10,
    gap: 6
  },
  variantLabel: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700"
  },
  variantDescription: {
    color: "#334155",
    fontSize: 13
  },
  variantMeta: {
    color: "#475569",
    fontSize: 12
  }
});
