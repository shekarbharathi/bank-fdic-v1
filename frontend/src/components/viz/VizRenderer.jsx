import { lazy, Suspense, useLayoutEffect } from 'react';

const VIZ_REGISTRY = {
  table: lazy(() => import('./InteractiveTableViz')),
  compare_banks: lazy(() => import('./BankComparisonViz')),
  trend_tracker: lazy(() => import('./TrendChartViz')),
  metric_explorer: lazy(() => import('./MetricExplorerViz')),
  state_explorer: lazy(() => import('./StateOverviewViz')),
  peer_group: lazy(() => import('./PeerGroupViz')),
};

function VizReadyGate({ onReady, children }) {
  useLayoutEffect(() => {
    onReady?.();
  }, [onReady]);
  return children;
}

function VizNullNotifier({ onReady }) {
  useLayoutEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

export default function VizRenderer({ experience, data, title, config, onVizReady }) {
  const Component = VIZ_REGISTRY[experience];
  if (!Component) {
    return <VizNullNotifier onReady={onVizReady} />;
  }
  return (
    <Suspense fallback={null}>
      <VizReadyGate onReady={onVizReady}>
        <Component data={data} title={title} config={config} />
      </VizReadyGate>
    </Suspense>
  );
}
