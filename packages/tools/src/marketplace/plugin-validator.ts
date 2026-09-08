import type { PluginManifest } from './plugin-store.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

const DANGEROUS_PERMISSIONS = new Set(['fs:write', 'net:all', 'process:exec', 'env:read']);

export class PluginValidator {
  validate(manifest: PluginManifest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.name || manifest.name.length < 2) errors.push('Name is required (min 2 chars)');
    if (!manifest.version.match(/^\d+\.\d+\.\d+/)) errors.push('Version must be semver');
    if (!manifest.description || manifest.description.length < 10) errors.push('Description too short');
    if (!manifest.author) errors.push('Author is required');
    if (!manifest.entryPoint) errors.push('Entry point is required');

    const dangerousPerms = manifest.permissions.filter((p) => DANGEROUS_PERMISSIONS.has(p));
    if (dangerousPerms.length > 0) {
      warnings.push(`Dangerous permissions: ${dangerousPerms.join(', ')}`);
    }

    if (manifest.permissions.length > 10) warnings.push('Excessive permissions requested');

    let riskLevel: ValidationResult['riskLevel'] = 'low';
    if (dangerousPerms.length > 0) riskLevel = 'medium';
    if (dangerousPerms.length > 2 || manifest.permissions.includes('process:exec')) riskLevel = 'high';

    return { valid: errors.length === 0, errors, warnings, riskLevel };
  }

  validateCode(code: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    if (code.includes('eval(')) issues.push('eval() detected — potential code injection');
    if (code.includes('Function(')) issues.push('Function constructor detected');
    if (code.match(/child_process|exec|spawn/)) issues.push('Process execution detected');
    if (code.match(/require\s*\(\s*['"]fs['"]\s*\)/)) issues.push('Direct fs access');
    if (code.match(/process\.env/)) issues.push('Environment variable access');

    return { safe: issues.length === 0, issues };
  }
}
