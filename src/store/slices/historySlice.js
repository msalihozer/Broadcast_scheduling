/**
 * @file historySlice.js
 * @description Manages undo functionality using snapshotting of the state.
 */

export const createHistorySlice = (set, get) => ({
  pastStates: [],
  
  /**
   * Saves a snapshot of the current state before a mutating action.
   * Limits history to the last 30 actions to save memory.
   */
  _saveSnapshot: () => set((state) => {
    const maxHistory = 30;
    // Deep clone the days object to ensure it is independent
    const currentState = { days: JSON.parse(JSON.stringify(state.days)) };
    const newPast = [...(state.pastStates || []), currentState].slice(-maxHistory);
    return { pastStates: newPast };
  }),

  /**
   * Reverts the `days` object to the last saved snapshot.
   */
  undo: () => set((state) => {
    if (!state.pastStates || state.pastStates.length === 0) return state;
    const previous = state.pastStates[state.pastStates.length - 1];
    return {
      days: JSON.parse(JSON.stringify(previous.days)),
      pastStates: state.pastStates.slice(0, -1)
    };
  })
});
