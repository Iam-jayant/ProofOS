"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type SessionState,
  type UserType,
  type CorporateRegime,
  type Wallet,
  type WalletGroup,
  type LedgerRow,
  type PriceEntry,
  type TaxSummary,
  type ProofArtifacts,
  type Category,
  createEmptySession,
  CURRENT_SESSION_VERSION,
} from "./types";

const STORAGE_KEY = "proofos_session";

interface SessionContextValue {
  session: SessionState;
  isLoaded: boolean;

  // User type
  setUserType: (userType: UserType) => void;

  // Wallets
  addWallet: (address: string, label?: string, groupId?: string) => string;
  removeWallet: (id: string) => void;
  updateWallet: (id: string, updates: Partial<Omit<Wallet, "id">>) => void;

  // Wallet groups
  addWalletGroup: (name: string, description?: string) => string;
  removeWalletGroup: (id: string) => void;
  updateWalletGroup: (id: string, updates: Partial<Omit<WalletGroup, "id">>) => void;

  // Ledger
  setLedger: (ledger: LedgerRow[]) => void;
  clearLedger: () => void;

  // Category overrides
  setCategoryOverride: (ledgerRowId: string, category: Category) => void;
  removeCategoryOverride: (ledgerRowId: string) => void;

  // Pricing
  setPrices: (prices: PriceEntry[]) => void;
  setUsdInrRate: (rate: string) => void;
  setUse44ada: (use: boolean) => void;
  setIsSalaried: (isSalaried: boolean) => void;
  setCorporateRegime: (regime: CorporateRegime) => void;
  setTds194sInr: (value: string) => void;
  setPriorYearBusinessLossInr: (value: string) => void;

  // Tax summary
  setTaxSummary: (summary: TaxSummary) => void;

  // Proof artifacts
  setProofArtifacts: (artifacts: ProofArtifacts) => void;
  clearProofArtifacts: () => void;

  // Session management
  exportSession: () => string;
  importSession: (json: string) => boolean;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SessionState;
    if (parsed.version !== CURRENT_SESSION_VERSION) {
      // Future: handle migrations
      return null;
    }
    const defaults = createEmptySession();
    return {
      ...defaults,
      ...parsed,
      wallets: parsed.wallets ?? defaults.wallets,
      walletGroups: parsed.walletGroups ?? defaults.walletGroups,
      ledger: parsed.ledger ?? defaults.ledger,
      categoryOverrides: parsed.categoryOverrides ?? defaults.categoryOverrides,
      prices: parsed.prices ?? defaults.prices,
    };
  } catch {
    return null;
  }
}

function saveSession(session: SessionState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(
    () => loadSession() ?? createEmptySession()
  );
  const isLoaded = true;

  // Save session to localStorage on change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveSession(session);
    }
  }, [session, isLoaded]);

  const updateSession = useCallback((updates: Partial<SessionState>) => {
    setSession((prev) => ({
      ...prev,
      ...updates,
      updatedAt: Date.now(),
    }));
  }, []);

  // User type
  const setUserType = useCallback(
    (userType: UserType) => updateSession({ userType }),
    [updateSession]
  );

  // Wallets
  const addWallet = useCallback(
    (address: string, label?: string, groupId?: string): string => {
      const id = generateId();
      const wallet: Wallet = { id, address: address.toLowerCase(), label, groupId };
      setSession((prev) => ({
        ...prev,
        wallets: [...prev.wallets, wallet],
        updatedAt: Date.now(),
      }));
      return id;
    },
    []
  );

  const removeWallet = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      wallets: prev.wallets.filter((w) => w.id !== id),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateWallet = useCallback(
    (id: string, updates: Partial<Omit<Wallet, "id">>) => {
      setSession((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) =>
          w.id === id ? { ...w, ...updates } : w
        ),
        updatedAt: Date.now(),
      }));
    },
    []
  );

  // Wallet groups
  const addWalletGroup = useCallback(
    (name: string, description?: string): string => {
      const id = generateId();
      const group: WalletGroup = { id, name, description };
      setSession((prev) => ({
        ...prev,
        walletGroups: [...prev.walletGroups, group],
        updatedAt: Date.now(),
      }));
      return id;
    },
    []
  );

  const removeWalletGroup = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      walletGroups: prev.walletGroups.filter((g) => g.id !== id),
      // Also unassign wallets from this group
      wallets: prev.wallets.map((w) =>
        w.groupId === id ? { ...w, groupId: undefined } : w
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateWalletGroup = useCallback(
    (id: string, updates: Partial<Omit<WalletGroup, "id">>) => {
      setSession((prev) => ({
        ...prev,
        walletGroups: prev.walletGroups.map((g) =>
          g.id === id ? { ...g, ...updates } : g
        ),
        updatedAt: Date.now(),
      }));
    },
    []
  );

  // Ledger
  const setLedger = useCallback(
    (ledger: LedgerRow[]) => updateSession({ ledger }),
    [updateSession]
  );

  const clearLedger = useCallback(
    () => updateSession({ ledger: [], categoryOverrides: [] }),
    [updateSession]
  );

  // Category overrides
  const setCategoryOverride = useCallback(
    (ledgerRowId: string, category: Category) => {
      setSession((prev) => {
        const existing = prev.categoryOverrides.find(
          (o) => o.ledgerRowId === ledgerRowId
        );
        const overrides = existing
          ? prev.categoryOverrides.map((o) =>
              o.ledgerRowId === ledgerRowId ? { ...o, category } : o
            )
          : [...prev.categoryOverrides, { ledgerRowId, category }];
        return {
          ...prev,
          categoryOverrides: overrides,
          updatedAt: Date.now(),
        };
      });
    },
    []
  );

  const removeCategoryOverride = useCallback((ledgerRowId: string) => {
    setSession((prev) => ({
      ...prev,
      categoryOverrides: prev.categoryOverrides.filter(
        (o) => o.ledgerRowId !== ledgerRowId
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  // Pricing
  const setPrices = useCallback(
    (prices: PriceEntry[]) => updateSession({ prices }),
    [updateSession]
  );

  const setUsdInrRate = useCallback(
    (usdInrRate: string) => updateSession({ usdInrRate }),
    [updateSession]
  );

  const setUse44ada = useCallback(
    (use44ada: boolean) => updateSession({ use44ada }),
    [updateSession]
  );

  const setIsSalaried = useCallback(
    (isSalaried: boolean) => updateSession({ isSalaried }),
    [updateSession]
  );

  const setCorporateRegime = useCallback(
    (corporateRegime: CorporateRegime) => updateSession({ corporateRegime }),
    [updateSession]
  );

  const setTds194sInr = useCallback(
    (tds194sInr: string) => updateSession({ tds194sInr }),
    [updateSession]
  );

  const setPriorYearBusinessLossInr = useCallback(
    (priorYearBusinessLossInr: string) => updateSession({ priorYearBusinessLossInr }),
    [updateSession]
  );

  // Tax summary
  const setTaxSummary = useCallback(
    (taxSummary: TaxSummary) => updateSession({ taxSummary }),
    [updateSession]
  );

  // Proof artifacts
  const setProofArtifacts = useCallback(
    (proofArtifacts: ProofArtifacts) => updateSession({ proofArtifacts }),
    [updateSession]
  );

  const clearProofArtifacts = useCallback(
    () => updateSession({ proofArtifacts: undefined }),
    [updateSession]
  );

  // Session management
  const exportSession = useCallback((): string => {
    return JSON.stringify(session, null, 2);
  }, [session]);

  const importSession = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as SessionState;
      if (typeof parsed.version !== "number") {
        return false;
      }
      // Basic validation
      if (!Array.isArray(parsed.wallets) || !Array.isArray(parsed.walletGroups)) {
        return false;
      }
      setSession({
        ...parsed,
        updatedAt: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetSession = useCallback(() => {
    setSession(createEmptySession());
  }, []);

  const value: SessionContextValue = {
    session,
    isLoaded,
    setUserType,
    addWallet,
    removeWallet,
    updateWallet,
    addWalletGroup,
    removeWalletGroup,
    updateWalletGroup,
    setLedger,
    clearLedger,
    setCategoryOverride,
    removeCategoryOverride,
    setPrices,
    setUsdInrRate,
    setUse44ada,
    setIsSalaried,
    setCorporateRegime,
    setTds194sInr,
    setPriorYearBusinessLossInr,
    setTaxSummary,
    setProofArtifacts,
    clearProofArtifacts,
    exportSession,
    importSession,
    resetSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
