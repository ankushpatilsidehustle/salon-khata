// Reusable period selector for report screens. Renders a segmented control
// (Day / Week / Month / Custom) plus a stepper row below it (‹  label  ›).
// Custom mode opens the OS date picker twice via a small modal to collect a
// start + end date; arrows are disabled while in custom mode.

import { useCallback, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";

import { Button } from "@/components/core/Button";
import { SegmentedControl } from "@/components/core/SegmentedControl";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import {
  canStepPeriod,
  formatPeriodLabel,
  fromISODate,
  makeCustomPeriod,
  makeDayPeriod,
  makeMonthPeriod,
  makeWeekPeriod,
  stepPeriod,
  type Period,
  type PeriodMode
} from "@/domain/period";

type PeriodSelectorProps = {
  value: Period;
  onChange: (period: Period) => void;
  testID?: string;
};

export function PeriodSelector({ onChange, value, testID }: PeriodSelectorProps) {
  const { t } = useTranslation();
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  const options: { label: string; value: PeriodMode }[] = [
    { label: t("reports.period.day"), value: "day" },
    { label: t("reports.period.week"), value: "week" },
    { label: t("reports.period.month"), value: "month" },
    { label: t("reports.period.custom"), value: "custom" }
  ];

  const handleModeChange = useCallback(
    (mode: PeriodMode) => {
      if (mode === value.mode) return;
      switch (mode) {
        case "day":
          onChange(makeDayPeriod(new Date()));
          break;
        case "week":
          onChange(makeWeekPeriod(new Date()));
          break;
        case "month":
          onChange(makeMonthPeriod(new Date()));
          break;
        case "custom":
          // Open the range picker immediately; use current period as seed.
          onChange(
            makeCustomPeriod(fromISODate(value.start), fromISODate(value.end))
          );
          setCustomPickerOpen(true);
          break;
      }
    },
    [onChange, value.mode, value.start, value.end]
  );

  const stepEnabled = canStepPeriod(value);
  const label = formatPeriodLabel(value);

  return (
    <View style={styles.root} testID={testID}>
      <SegmentedControl
        options={options}
        value={value.mode}
        onChange={handleModeChange}
      />

      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(stepPeriod(value, -1))}
          disabled={!stepEnabled}
          hitSlop={8}
          style={({ pressed }) => [
            styles.stepBtn,
            !stepEnabled && styles.stepBtnDisabled,
            pressed && stepEnabled && styles.stepBtnPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("reports.period.prev")}
          accessibilityState={{ disabled: !stepEnabled }}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={stepEnabled ? colors.text.primary : colors.text.muted}
          />
        </Pressable>

        <Pressable
          onPress={
            value.mode === "custom" ? () => setCustomPickerOpen(true) : undefined
          }
          disabled={value.mode !== "custom"}
          style={styles.label}
          accessibilityRole={value.mode === "custom" ? "button" : "text"}
          accessibilityLabel={label}
        >
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
          {value.mode === "custom" ? (
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.text.secondary}
              style={styles.labelIcon}
            />
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => onChange(stepPeriod(value, 1))}
          disabled={!stepEnabled}
          hitSlop={8}
          style={({ pressed }) => [
            styles.stepBtn,
            !stepEnabled && styles.stepBtnDisabled,
            pressed && stepEnabled && styles.stepBtnPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("reports.period.next")}
          accessibilityState={{ disabled: !stepEnabled }}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={stepEnabled ? colors.text.primary : colors.text.muted}
          />
        </Pressable>
      </View>

      {customPickerOpen ? (
        <CustomRangePickerModal
          seedStart={fromISODate(value.start)}
          seedEnd={fromISODate(value.end)}
          onCancel={() => setCustomPickerOpen(false)}
          onApply={(start, end) => {
            setCustomPickerOpen(false);
            onChange(makeCustomPeriod(start, end));
          }}
        />
      ) : null}
    </View>
  );
}

// ─── Custom range picker ─────────────────────────────────────────────────────

function CustomRangePickerModal({
  onApply,
  onCancel,
  seedEnd,
  seedStart
}: {
  seedStart: Date;
  seedEnd: Date;
  onCancel: () => void;
  onApply: (start: Date, end: Date) => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState<Date>(seedStart);
  const [end, setEnd] = useState<Date>(seedEnd);
  const [iosField, setIosField] = useState<"start" | "end" | null>(null);

  const openAndroidPicker = (field: "start" | "end") => {
    const current = field === "start" ? start : end;
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      maximumDate: new Date(),
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === "set" && selected) {
          if (field === "start") setStart(selected);
          else setEnd(selected);
        }
      }
    });
  };

  const openPicker = (field: "start" | "end") => {
    if (Platform.OS === "android") {
      openAndroidPicker(field);
    } else {
      setIosField(iosField === field ? null : field);
    }
  };

  const startLabel = start.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const endLabel = end.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const invalid = start > end;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityRole="button">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{t("reports.period.customTitle")}</Text>

          <FieldRow
            label={t("reports.period.startDate")}
            value={startLabel}
            active={iosField === "start"}
            onPress={() => openPicker("start")}
          />
          {Platform.OS === "ios" && iosField === "start" ? (
            <DateTimePicker
              value={start}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_e, selected) => {
                if (selected) setStart(selected);
              }}
            />
          ) : null}

          <FieldRow
            label={t("reports.period.endDate")}
            value={endLabel}
            active={iosField === "end"}
            onPress={() => openPicker("end")}
          />
          {Platform.OS === "ios" && iosField === "end" ? (
            <DateTimePicker
              value={end}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_e, selected) => {
                if (selected) setEnd(selected);
              }}
            />
          ) : null}

          {invalid ? (
            <Text style={styles.errorText}>
              {t("reports.period.rangeInvalid")}
            </Text>
          ) : null}

          <View style={styles.sheetActions}>
            <Button variant="ghost" onPress={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              onPress={() => {
                if (invalid) return;
                onApply(start, end);
              }}
            >
              {t("common.done")}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FieldRow({
  active,
  label,
  onPress,
  value
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fieldRow,
        active && styles.fieldRowActive,
        pressed && styles.fieldRowPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Ionicons name="calendar-outline" size={18} color={colors.text.secondary} />
      <View style={styles.fieldTextWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    gap: spacing[2]
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  stepBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface.default,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  stepBtnPressed: {
    backgroundColor: colors.interactive.pressed
  },
  stepBtnDisabled: {
    opacity: 0.4
  },
  label: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[1],
    justifyContent: "center",
    minHeight: 36
  },
  labelText: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  labelIcon: {
    marginLeft: spacing[1]
  },
  // Custom range modal
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface.default,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3]
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text.primary
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "flex-end",
    marginTop: spacing[2]
  },
  fieldRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.default
  },
  fieldRowActive: {
    borderColor: colors.brand.primary
  },
  fieldRowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  fieldTextWrap: {
    flex: 1
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary
  },
  fieldValue: {
    ...typography.body,
    color: colors.text.primary
  },
  errorText: {
    ...typography.caption,
    color: colors.status.danger
  }
});
