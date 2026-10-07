import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS } from "@/lib/site";

export type Settings = typeof DEFAULT_SETTINGS;

export function settingsQueryOptions() {
  return {
    queryKey: ["site_settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) throw error;
      const map = { ...DEFAULT_SETTINGS } as Settings & Record<string, string>;
      for (const row of data ?? []) map[row.key] = row.value ?? "";
      return map;
    },
    staleTime: 30_000,
  };
}

export function useSettings() {
  const query = useQuery(settingsQueryOptions());
  return { settings: query.data ?? DEFAULT_SETTINGS, ...query };
}

export function useSections() {
  return useQuery({
    queryKey: ["homepage_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_sections")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ["announcements", "active"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter(
        (a) =>
          (!a.start_date || a.start_date <= nowIso) && (!a.end_date || a.end_date >= nowIso),
      );
    },
    staleTime: 30_000,
  });
}

export function useCategories(activeOnly = true) {
  return useQuery({
    queryKey: ["categories", activeOnly],
    queryFn: async () => {
      let q = supabase.from("categories").select("*").order("sort_order");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
