import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { trackEvent } from '../../utils/analytics';

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
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (!experience) return;
    hasInteractedRef.current = false;
    trackEvent('viz_rendered', {
      viz_component: experience,
      viz_type: config?.type || experience,
      has_results: Array.isArray(data) ? (data.length > 0 ? 1 : 0) : 0,
      row_count: Array.isArray(data) ? data.length : 0,
    });
  }, [experience, config?.type, data]);

  const Component = VIZ_REGISTRY[experience];
  if (!Component) {
    return <VizNullNotifier onReady={onVizReady} />;
  }
  return (
    <div
      onPointerDownCapture={() => {
        if (hasInteractedRef.current) return;
        hasInteractedRef.current = true;
        trackEvent('viz_interaction', {
          viz_component: experience,
          viz_type: config?.type || experience,
          action: 'pointer_down',
        });
      }}
    >
      <Suspense fallback={null}>
        <VizReadyGate onReady={onVizReady}>
          <Component data={data} title={title} config={config} />
        </VizReadyGate>
      </Suspense>
    </div>
  );
}
