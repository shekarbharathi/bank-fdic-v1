const INITIAL_VIEW_STATE = {
  viewMode: 'table',
  rows: [],
  scalarValue: null,
  vizMeta: { title: '', config: {} },
  vizData: [],
};

function viewStateReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_VIEW_STATE, viewMode: 'pending' };

    case 'SHOW_SUGGESTIONS':
      return { ...INITIAL_VIEW_STATE, viewMode: 'suggestions' };

    case 'SHOW_SCALAR':
      return {
        ...INITIAL_VIEW_STATE,
        viewMode: 'scalar',
        scalarValue: action.value,
        vizMeta: action.vizMeta ?? INITIAL_VIEW_STATE.vizMeta,
      };

    case 'SHOW_TABLE':
      return {
        ...INITIAL_VIEW_STATE,
        viewMode: 'table',
        rows: action.rows,
        vizMeta: action.vizMeta ?? INITIAL_VIEW_STATE.vizMeta,
      };

    case 'SHOW_VIZ':
      return {
        ...INITIAL_VIEW_STATE,
        viewMode: action.experience,
        vizData: action.data,
        vizMeta: action.vizMeta ?? INITIAL_VIEW_STATE.vizMeta,
      };

    default:
      return state;
  }
}

export { INITIAL_VIEW_STATE, viewStateReducer };
