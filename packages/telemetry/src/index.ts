import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';

let initialized = false;

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
    const sdkModule = '@opentelemetry/sdk-node';
    const exporterModule = '@opentelemetry/exporter-trace-otlp-http';
    const [nodeSdk, exporter] = await Promise.all([
      import(sdkModule).catch(() => null),
      import(exporterModule).catch(() => null),
    ]);
    if (!nodeSdk || !exporter) {
      log.warn(
        { sdkModule, exporterModule },
        'OpenTelemetry packages not installed; telemetry no-op',
      );
      initialized = true;
      return;
    }
    const traceExporter = new (exporter as unknown as { OTLPTraceExporter: new () => unknown }).OTLPTraceExporter();
    const sdk = new (nodeSdk as unknown as { NodeSDK: new (cfg: unknown) => { start(): void; shutdown(): Promise<void> } }).NodeSDK({
      traceExporter,
      serviceName: c.OTEL_SERVICE_NAME,
    });
    sdk.start();
    log.info({ endpoint: c.OTEL_EXPORTER_OTLP_ENDPOINT }, 'OpenTelemetry initialized');
    initialized = true;
  } catch (err) {
    log.error({ err }, 'failed to initialize OpenTelemetry; continuing without it');
    initialized = true;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!initialized) return;
}
