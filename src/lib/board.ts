import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SlotState = {
  id: string;
  pos: number; // posicao_id
  x: number;
  y: number;
  atletaId: number | null;
  extra?: boolean;
};

export type TextBubble = { id: string; x: number; y: number; text: string; color: string };
export type Stroke = { id: string; d: string; color: string; width: number };

export type Board = {
  id: string;
  nome: string;
  formacao: string;
  slots: SlotState[];
  bench: SlotState[];
  strokes: Stroke[];
  bubbles: TextBubble[];
  locked: boolean;
};


const ROW_X: Record<number, number[]> = {
  1: [50],
  2: [32, 68],
  3: [22, 50, 78],
  4: [14, 38, 62, 86],
  5: [10, 30, 50, 70, 90],
};

/** Parse "4-3-3" into rows and build slots. */
export function buildFormation(nome: string): SlotState[] {
  const parts = nome.split("-").map((n) => parseInt(n, 10));
  const slots: SlotState[] = [];
  let i = 0;
  const push = (pos: number, x: number, y: number) =>
    slots.push({ id: `s${i++}`, pos, x, y, atletaId: null });

  const [def = 4, ...rest] = parts;
  const atk = rest.length ? rest[rest.length - 1]! : 3;
  const mids = rest.slice(0, -1);

  // attack
  (ROW_X[atk] ?? ROW_X[3]!).forEach((x) => push(5, x, 13));
  // midfield rows
  const midYs = mids.length === 1 ? [36] : mids.length === 2 ? [30, 45] : [26, 38, 50];
  mids.forEach((count, idx) => {
    (ROW_X[count] ?? ROW_X[3]!).forEach((x) => push(4, x, midYs[idx] ?? 38));
  });
  // defence: laterals wide, centre-backs evenly spaced between them
  if (def >= 4) {
    const zag = def - 2;
    push(2, 10, 62);
    for (let z = 0; z < zag; z++) push(3, 10 + (80 * (z + 1)) / (zag + 1), 67);
    push(2, 90, 62);
  } else {
    for (let z = 0; z < def; z++) push(3, 10 + (80 * (z + 1)) / (def + 1), 65);
  }
  push(1, 50, 88);
  push(6, 88, 88);
  return slots;
}

export function buildBench(): SlotState[] {
  return [1, 2, 3, 4, 5].map((pos, i) => ({
    id: `bench-${i}-${Math.random().toString(36).slice(2, 8)}`,
    pos,
    x: 0,
    y: 0,
    atletaId: null,
  }));
}

export function newBoard(nome = "Campinho 1", formacao = "4-3-3"): Board {
  return {
    id: crypto.randomUUID(),
    nome,
    formacao,
    slots: buildFormation(formacao),
    bench: buildBench(),
    strokes: [],
    bubbles: [],
    locked: false,
  };
}


const LS_KEY = "taticspro.boards.v1";

/** Ensure boards saved before the bench existed keep working. */
function migrate(list: Board[]): Board[] {
  return list.map((b) => ({ ...b, bench: b.bench?.length ? b.bench : buildBench() }));
}


export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // initial local load
  useEffect(() => {
    let initial: Board[] = [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) initial = JSON.parse(raw) as Board[];
    } catch {
      /* ignore */
    }
    if (!initial.length) initial = [newBoard()];
    setBoards(initial);
    setActiveId(initial[0]!.id);
    setHydrated(true);
  }, []);

  // auth state + remote load
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUserId(session?.user?.id ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !hydrated) return;
    (async () => {
      const { data } = await supabase.from("boards").select("data").eq("user_id", userId).maybeSingle();
      const remote = (data?.data ?? []) as unknown as Board[];
      if (Array.isArray(remote) && remote.length) {
        setBoards(remote);
        setActiveId(remote[0]!.id);
      }
    })();
  }, [userId, hydrated]);

  // persistence
  useEffect(() => {
    if (!hydrated || !boards.length) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(boards));
    } catch {
      /* ignore */
    }
    if (!userId) return;
    const t = setTimeout(() => {
      void supabase
        .from("boards")
        .upsert(
          { user_id: userId, data: boards as unknown as never, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    }, 1200);
    return () => clearTimeout(t);
  }, [boards, userId, hydrated]);

  const update = useCallback((id: string, patch: (b: Board) => Board) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? patch(b) : b)));
  }, []);

  const add = useCallback(() => {
    setBoards((prev) => {
      const b = newBoard(`Campinho ${prev.length + 1}`);
      setActiveId(b.id);
      return [...prev, b];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setBoards((prev) => {
      const next = prev.filter((b) => b.id !== id);
      const safe = next.length ? next : [newBoard()];
      setActiveId(safe[0]!.id);
      return safe;
    });
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setBoards((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item!);
      return next;
    });
  }, []);

  return { boards, activeId, setActiveId, update, add, remove, move, userId, hydrated };
}
