"use client";

import { useCallback, useRef, useState } from "react";
import type { SceneAlignmentState } from "@/lib/scene-alignment";

const MAX_UNDO = 50;

function cloneAlignment(state: SceneAlignmentState): SceneAlignmentState {
  return {
    desk1: { ...state.desk1 },
    desk2: { ...state.desk2 },
  };
}

function alignmentEqual(a: SceneAlignmentState, b: SceneAlignmentState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useAlignmentHistory(initial: SceneAlignmentState) {
  const [alignment, setAlignmentState] = useState(initial);
  const [undoStack, setUndoStack] = useState<SceneAlignmentState[]>([]);
  const alignmentRef = useRef(alignment);
  alignmentRef.current = alignment;
  const editStepRecorded = useRef(false);

  const pushSnapshot = useCallback(() => {
    const snap = cloneAlignment(alignmentRef.current);
    setUndoStack((stack) => {
      const last = stack[stack.length - 1];
      if (last && alignmentEqual(last, snap)) return stack;
      return [...stack.slice(-(MAX_UNDO - 1)), snap];
    });
  }, []);

  const changeAlignment = useCallback(
    (next: SceneAlignmentState) => {
      pushSnapshot();
      editStepRecorded.current = false;
      setAlignmentState(cloneAlignment(next));
    },
    [pushSnapshot]
  );

  const setAlignmentSilent = useCallback(
    (
      next:
        | SceneAlignmentState
        | ((prev: SceneAlignmentState) => SceneAlignmentState)
    ) => {
      setAlignmentState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        return cloneAlignment(resolved);
      });
    },
    []
  );

  /** Call once before typing in a number field (one undo per field session). */
  const beginEditStep = useCallback(() => {
    if (!editStepRecorded.current) {
      pushSnapshot();
      editStepRecorded.current = true;
    }
  }, [pushSnapshot]);

  const endEditStep = useCallback(() => {
    editStepRecorded.current = false;
  }, []);

  /** Call on gumball mouseDown — one undo per drag. */
  const beginGizmoDrag = pushSnapshot;

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setAlignmentState(cloneAlignment(prev));
      editStepRecorded.current = false;
      return stack.slice(0, -1);
    });
  }, []);

  return {
    alignment,
    changeAlignment,
    setAlignmentSilent,
    beginEditStep,
    endEditStep,
    beginGizmoDrag,
    undo,
    canUndo: undoStack.length > 0,
  };
}
