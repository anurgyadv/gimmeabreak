'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeRange } from './dateUtils';

/**
 * Pointer + keyboard range selection for the calendar grid.
 *
 * Deliberately avoids `setPointerCapture` (it would suppress `pointerenter`
 * on sibling cells and break drag hit-testing) and never commits a range on
 * a plain pointerup with no movement — that would swallow the second half
 * of a click-start/click-end selection. A global `pointerup` listener is
 * used so a release outside the grid still resolves the in-progress press.
 */
export function useRangeSelection(
  onCommit: (start: string, end: string) => void,
  disabled: boolean,
) {
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [dragAnchor, setDragAnchor] = useState<string | null>(null);
  const [dragCurrent, setDragCurrent] = useState<string | null>(null);
  const movedRef = useRef(false);
  const pressActiveRef = useRef(false);

  const cancelPending = useCallback(() => {
    pressActiveRef.current = false;
    movedRef.current = false;
    setPendingStart(null);
    setDragAnchor(null);
    setDragCurrent(null);
  }, []);

  const handlePointerDown = useCallback(
    (date: string) => {
      if (disabled) return;
      pressActiveRef.current = true;
      movedRef.current = false;
      setDragAnchor(date);
      setDragCurrent(date);
    },
    [disabled],
  );

  const handlePointerEnter = useCallback((date: string) => {
    if (!pressActiveRef.current) return;
    movedRef.current = true;
    setDragCurrent(date);
  }, []);

  useEffect(() => {
    function onPointerUp() {
      if (!pressActiveRef.current) return;
      pressActiveRef.current = false;

      if (movedRef.current && dragAnchor && dragCurrent) {
        const [start, end] = normalizeRange(dragAnchor, dragCurrent);
        setDragAnchor(null);
        setDragCurrent(null);
        setPendingStart(null);
        onCommit(start, end);
        return;
      }

      if (dragAnchor) {
        if (pendingStart) {
          const [start, end] = normalizeRange(pendingStart, dragAnchor);
          setPendingStart(null);
          setDragAnchor(null);
          setDragCurrent(null);
          onCommit(start, end);
        } else {
          setPendingStart(dragAnchor);
          setDragAnchor(null);
          setDragCurrent(null);
        }
      }
    }

    window.addEventListener('pointerup', onPointerUp);
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, [dragAnchor, dragCurrent, pendingStart, onCommit]);

  const selectViaKeyboard = useCallback(
    (date: string) => {
      if (disabled) return;
      if (pendingStart) {
        const [start, end] = normalizeRange(pendingStart, date);
        setPendingStart(null);
        onCommit(start, end);
      } else {
        setPendingStart(date);
      }
    },
    [disabled, pendingStart, onCommit],
  );

  const previewRange: [string, string] | null = dragAnchor && dragCurrent
    ? normalizeRange(dragAnchor, dragCurrent)
    : pendingStart
      ? [pendingStart, pendingStart]
      : null;

  return {
    previewRange,
    pendingStart,
    handlePointerDown,
    handlePointerEnter,
    selectViaKeyboard,
    cancelPending,
  };
}
