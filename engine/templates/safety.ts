import { TemplateVersion } from './registry';

export function assertSafeActivation(
  oldVersion: TemplateVersion | undefined,
  newVersion: TemplateVersion,
  override: boolean = false
): void {
  if (override || !oldVersion) return;
  
  for (const block of oldVersion.protectedSections) {
    if (!newVersion.body.includes(block)) {
      throw new Error(`Safety violation: protected section removed in new version. Block snippet: ${block.substring(0,20)}`);
    }
  }
}
