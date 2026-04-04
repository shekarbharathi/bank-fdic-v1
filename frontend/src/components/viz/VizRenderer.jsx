import { lazy, Suspense } from 'react';

const VIZ_REGISTRY = {
  table: lazy(() => import('./InteractiveTableViz')),
  compare_banks: lazy(() => import('./BankComparisonViz')),
  trend_tracker: lazy(() => import('./TrendChartViz')),
  metric_explorer: lazy(() => import('./MetricExplorerViz')),
  state_explorer: lazy(() => import('./StateOverviewViz')),
  peer_group: lazy(() => import('./PeerGroupViz')),
};

export default function VizRenderer({ experience, data, title, config }) {
  const Component = VIZ_REGISTRY[experience];
  if (!Component) return null;
  return (
    <Suspense fallback={null}>
      <Component data={data} title={title} config={config} />
    </Suspense>
  );
}
