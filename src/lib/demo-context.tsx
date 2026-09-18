'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { startMockWorker } from '@/mocks/browser';
import { api, ApiError } from './api';
import type {
  Clinician,
  CoverOption,
  DemoContextValue,
  DemoSnapshot,
  LeaveDayFeasibility,
  LeaveWindow,
  NoteTone,
} from './types';

const EMPTY_SNAPSHOT: DemoSnapshot = {
  evaluation: null,
  coverRequest: null,
  revalidation: null,
  approved: false,
  audit: [],
  teamsUnavailable: false,
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong in the demo service.';
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemo must be used within a DemoProvider.');
  }
  return ctx;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Clinician | null>(null);
  const [calendar, setCalendar] = useState<LeaveDayFeasibility[]>([]);
  const [windows, setWindows] = useState<LeaveWindow[]>([]);
  const [options, setOptions] = useState<CoverOption[]>([]);
  const [snapshot, setSnapshot] = useState<DemoSnapshot>(EMPTY_SNAPSHOT);

  const applySnapshot = useCallback((next: DemoSnapshot) => {
    setSnapshot(next);
    if (!next.coverRequest) setOptions([]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy('Checking roster…');
      const workerAvailable = await startMockWorker();
      if (!workerAvailable && !cancelled) setError('Using the local simulation fallback: the browser mock service worker is unavailable.');
      try {
        const [meResult, calendarResult, windowsResult, stateResult] = await Promise.all([
          api.getMe(),
          api.getCalendar(),
          api.findWindows(),
          api.getState(),
        ]);
        if (cancelled) return;

        setMe(meResult);
        setCalendar(calendarResult);
        setWindows(windowsResult.windows);
        applySnapshot(stateResult);

        if (stateResult.evaluation && !stateResult.evaluation.feasible) {
          const optionsResult = await api.getCoverOptions(stateResult.evaluation.evaluationId);
          if (!cancelled) setOptions(optionsResult.options);
        }
      } catch (err) {
        if (!cancelled) setError(describeError(err));
      } finally {
        if (!cancelled) {
          setBusy(null);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  const evaluate = useCallback(
    async (startDate: string, endDate: string) => {
      if (!me) return;
      setBusy('Checking roster…');
      setError(null);
      try {
        const evaluation = await api.evaluateLeave({ clinicianId: me.id, startDate, endDate });
        const state = await api.getState();
        applySnapshot(state);
        if (!evaluation.feasible) {
          setBusy('Finding cover options…');
          const optionsResult = await api.getCoverOptions(evaluation.evaluationId);
          setOptions(optionsResult.options);
        }
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [me, applySnapshot],
  );

  const findWindows = useCallback(async () => {
    setBusy('Searching for better dates…');
    setError(null);
    try {
      const result = await api.findWindows();
      setWindows(result.windows);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    if (!snapshot.evaluation) {
      setError('Select and evaluate a leave range before requesting cover.');
      return;
    }
    setBusy('Finding cover options…');
    setError(null);
    try {
      const result = await api.getCoverOptions(snapshot.evaluation.evaluationId);
      setOptions(result.options);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }, [snapshot.evaluation]);

  const rephrase = useCallback(async (text: string, tone: NoteTone) => {
    setBusy('Rewriting note…');
    setError(null);
    try {
      const result = await api.rephraseNote(text, tone);
      return result.text;
    } catch (err) {
      setError(describeError(err));
      throw err;
    } finally {
      setBusy(null);
    }
  }, []);

  const requestCover = useCallback(
    async (optionId: string, personalNote: string) => {
      setBusy('Sending cover request…');
      setError(null);
      try {
        await api.requestCover(optionId, personalNote);
        const state = await api.getState();
        applySnapshot(state);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [applySnapshot],
  );

  const respond = useCallback(
    async (response: 'accepted' | 'declined') => {
      setBusy(response === 'accepted' ? 'Recording acceptance…' : 'Recording decline…');
      setError(null);
      try {
        await api.respondCover(response);
        const state = await api.getState();
        applySnapshot(state);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [applySnapshot],
  );

  const revalidate = useCallback(async () => {
    setBusy('Revalidating roster…');
    setError(null);
    try {
      await api.revalidate();
      const state = await api.getState();
      applySnapshot(state);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }, [applySnapshot]);

  const approve = useCallback(async () => {
    setBusy('Recording manager approval…');
    setError(null);
    try {
      await api.approve();
      const state = await api.getState();
      applySnapshot(state);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }, [applySnapshot]);

  const reset = useCallback(async () => {
    setBusy('Resetting demo…');
    setError(null);
    try {
      const state = await api.resetDemo();
      applySnapshot(state);
      const [calendarResult, windowsResult] = await Promise.all([api.getCalendar(), api.findWindows()]);
      setCalendar(calendarResult);
      setWindows(windowsResult.windows);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }, [applySnapshot]);

  const setTeamsUnavailable = useCallback(
    async (value: boolean) => {
      setBusy(value ? 'Disabling Teams…' : 'Enabling Teams…');
      setError(null);
      try {
        const state = await api.setSettings({ teamsUnavailable: value });
        applySnapshot(state);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [applySnapshot],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...snapshot,
      ready,
      busy,
      error,
      me,
      calendar,
      windows,
      options,
      evaluate,
      findWindows,
      loadOptions,
      rephrase,
      requestCover,
      respond,
      revalidate,
      approve,
      reset,
      setTeamsUnavailable,
      clearError,
    }),
    [
      snapshot,
      ready,
      busy,
      error,
      me,
      calendar,
      windows,
      options,
      evaluate,
      findWindows,
      loadOptions,
      rephrase,
      requestCover,
      respond,
      revalidate,
      approve,
      reset,
      setTeamsUnavailable,
      clearError,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
