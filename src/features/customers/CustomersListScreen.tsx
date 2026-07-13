// Customers list screen — search + sort by last-visit + tap to see detail.
// Reached from the Manage (Entries) hub's Customers tile.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { ListItem } from "@/components/core/ListItem";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import {
  CustomerRepository,
  type CustomerWithStats
} from "@/repositories/customer-repository";
import type { EntriesStackParamList } from "@/features/entries/EntriesNavigator";
import { CustomerDetailSheet } from "./CustomerDetailSheet";
import { CustomerFormSheet } from "./CustomerFormSheet";

const repo = new CustomerRepository();

type Props = NativeStackScreenProps<EntriesStackParamList, "Customers">;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "13 Jul", "13 Jul 2025" if not current year. */
function formatLastVisit(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric" }
  );
}

export function CustomersListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [rows, setRows] = useState<CustomerWithStats[]>([]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setRows(repo.listAll(DEV_SALON_ID));
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Digit-heavy queries match phone prefix; otherwise name substring.
    const digits = q.replace(/\D/g, "");
    if (digits.length > 0 && digits.length >= q.replace(/\s/g, "").length - 1) {
      return rows.filter((r) => r.phone.startsWith(digits));
    }
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const isEmpty = rows.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  const openAdd = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEditFromDetail = (id: string) => {
    setDetailId(null);
    setEditingId(id);
    setFormOpen(true);
  };

  return (
    <View style={styles.root}>
      <AppBar
        title={t("customers.title")}
        leading={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </Pressable>
        }
      />

      {!isEmpty ? (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("customers.search")}
            placeholderTextColor={colors.text.muted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("customers.search")}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.clear")}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={t("customers.empty.icon")}
          title={t("customers.empty.title")}
          body={t("customers.empty.body")}
          actionLabel={t("customers.add")}
          onAction={openAdd}
        />
      ) : noResults ? (
        <EmptyState
          icon="🔎"
          title={t("customers.empty.title")}
          body={t("customers.empty.body")}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={item.phone}
              leading={
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(item.name)}</Text>
                </View>
              }
              trailing={
                <View style={styles.trailing}>
                  <Text style={styles.spendText}>
                    {formatMoney(item.total_spend)}
                  </Text>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.last_visit
                      ? formatLastVisit(item.last_visit)
                      : t("customers.stats.noVisits")}
                  </Text>
                </View>
              }
              showChevron={false}
              onPress={() => setDetailId(item.id)}
            />
          )}
        />
      )}

      <Fab
        onPress={openAdd}
        label={t("customers.add")}
        accessibilityLabel={t("customers.add")}
      />

      <CustomerFormSheet
        visible={formOpen}
        customerId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={loadData}
        onJumpToExisting={(id) => {
          setFormOpen(false);
          setDetailId(id);
        }}
      />

      {detailId ? (
        <CustomerDetailSheet
          visible={detailId != null}
          customerId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={openEditFromDetail}
          onDeleted={() => {
            setDetailId(null);
            loadData();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  searchBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3],
    minHeight: 44
  },
  searchInput: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    padding: 0
  },
  listContent: {
    paddingTop: spacing[3],
    paddingBottom: spacing[9] + spacing[4]
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing[4] + 40 + spacing[3]
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "rgba(103,57,183,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "700"
  },
  trailing: {
    alignItems: "flex-end",
    gap: 2
  },
  spendText: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  metaText: {
    ...typography.caption,
    color: colors.text.muted
  }
});
