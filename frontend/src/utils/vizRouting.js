/**
 * Map backend intent / visualization.type to Banks-tab experience mode.
 */

const INTENT_TO_EXPERIENCE = {
  browse_table: 'table',
  scalar: 'scalar',
  compare_banks: 'compare_banks',
  trend_tracker: 'trend_tracker',
  metric_explorer: 'metric_explorer',
  state_explorer: 'state_explorer',
  peer_group: 'peer_group',
};

const VIZ_TYPE_TO_EXPERIENCE = {
  table: 'table',
  scalar: 'scalar',
  comparison: 'compare_banks',
  time_series: 'trend_tracker',
  metric_distribution: 'metric_explorer',
  state_overview: 'state_explorer',
  peer_comparison: 'peer_group',
};

/**
 * So viz components (e.g. metric_explorer) can tell metric_distribution from browse_table.
 */
function withVisualizationType(config, visualization, intent) {
  const c = { ...(config && typeof config === 'object' ? config : {}) };
  const vt = (visualization?.type || '').toLowerCase().trim();
  const i = (intent || '').toLowerCase().trim();
  if (vt) c.visualizationType = visualization.type;
  else if (i === 'metric_explorer') c.visualizationType = 'metric_distribution';
  return c;
}

/**
 * @param {string | undefined} intent
 * @param {{ type?: string, title?: string, config?: Record<string, unknown> } | null | undefined} visualization
 * @param {unknown[] | undefined} data
 * @returns {{ experience: string, title: string, config: Record<string, unknown> }}
 */
export function resolveExperience(intent, visualization, data) {
  const title = visualization?.title || '';
  const config = visualization?.config && typeof visualization.config === 'object' ? visualization.config : {};

  const i = (intent || '').toLowerCase().trim();
  const vtype = (visualization?.type || '').toLowerCase().trim();

  if (i === 'scalar' || vtype === 'scalar') {
    return { experience: 'scalar', title, config: withVisualizationType(config, visualization, intent) };
  }

  // Single-cell aggregate: show scalar even when intent is browse_table
  if (Array.isArray(data) && data.length === 1 && data[0] && Object.keys(data[0]).length === 1) {
    return { experience: 'scalar', title, config: withVisualizationType(config, visualization, intent) };
  }

  if (INTENT_TO_EXPERIENCE[i]) {
    return {
      experience: INTENT_TO_EXPERIENCE[i],
      title,
      config: withVisualizationType(config, visualization, intent),
    };
  }

  if (VIZ_TYPE_TO_EXPERIENCE[vtype]) {
    return {
      experience: VIZ_TYPE_TO_EXPERIENCE[vtype],
      title,
      config: withVisualizationType(config, visualization, intent),
    };
  }

  return { experience: 'table', title, config: withVisualizationType(config, visualization, intent) };
}
