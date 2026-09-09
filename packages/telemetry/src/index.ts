import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';

let initialized = false;
let sdkInstance: { shutdown(): Promise<void> } | null = null;

/** Reject after ms — used to bound slow/hanging OTEL dynamic imports. */
function importWithTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function initTelemetry(): Promise<void> {
  if (initialized) return;
  const c = loadConfig();
  const log = getLogger().child({ component: 'telemetry' });
  if (!c.OTEL_ENABLED) {
    log.info('OpenTelemetry disabled (OTEL_ENABLED=false)');
    initialized = true;
    return;
  }
  try {
    const [nodeSdk, exporter, autoInstr, resources, semconv] = await Promise.all([
      importWithTimeout(import('@opentelemetry/sdk-node' as string), 5000).catch(() => null),
      importWithTimeout(import('@opentelemetry/exporter-trace-otlp-http' as string), 5000).catch(() => null),
      importWithTimeout(import('@opentelemetry/auto-instrumentations-node' as string), 5000).catch(() => null),
      importWithTimeout(import('@opentelemetry/resources' as string), 5000).catch(() => null),
      importWithTimeout(import('@opentelemetry/semantic-conventions' as string), 5000).catch(() => null),
    ]);
    if (!nodeSdk || !exporter || !autoInstr || !resources || !semconv) {
      log.warn('OpenTelemetry packages not installed; telemetry no-op');
      initialized = true;
      return;
    }

    const NodeSDK = (nodeSdk as unknown as { NodeSDK: new (cfg: unknown) => { start(): void; shutdown(): Promise<void> } }).NodeSDK;
    const OTLPTraceExporter = (exporter as unknown as { OTLPTraceExporter: new (cfg?: unknown) => unknown }).OTLPTraceExporter;
    const getNodeAutoInstrumentations = (autoInstr as unknown as { getNodeAutoInstrumentations: () => unknown }).getNodeAutoInstrumentations;
    const SemanticAttributes = semconv as unknown as { ATTR_SERVICE_NAME: string; ATTR_SERVICE_VERSION: string };
    const resourceAttrs: Record<string, string> = {
      [SemanticAttributes.ATTR_SERVICE_NAME]: c.OTEL_SERVICE_NAME,
      [SemanticAttributes.ATTR_SERVICE_VERSION]: '0.1.0',
    };
    const resource = (resources as unknown as {
      resourceFromAttributes?: (attrs: Record<string, string>) => unknown;
      Resource?: new (attrs: Record<string, string>) => unknown;
    }).resourceFromAttributes?.(resourceAttrs)
      ?? new (resources as unknown as { Resource: new (attrs: Record<string, string>) => unknown }).Resource(resourceAttrs);

    const traceExporter = new OTLPTraceExporter({
      url: c.OTEL_EXPORTER_OTLP_ENDPOINT ? `${c.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` : undefined,
    });

    const sdk = new NodeSDK({
      traceExporter,
      resource,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    sdkInstance = sdk;
    log.info({ endpoint: c.OTEL_EXPORTER_OTLP_ENDPOINT }, 'OpenTelemetry initialized with auto-instrumentations');
    initialized = true;
  } catch (err) {
    log.error({ err }, 'failed to initialize OpenTelemetry; continuing without it');
    initialized = true;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!initialized || !sdkInstance) return;
  try {
    await sdkInstance.shutdown();
    const log = getLogger().child({ component: 'telemetry' });
    log.info('OpenTelemetry shut down');
  } catch {
    // best-effort
  }
  sdkInstance = null;
}
