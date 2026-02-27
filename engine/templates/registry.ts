import * as crypto from 'crypto';

export type TemplateStatus = 'active' | 'archived';

export interface TemplateVersion {
  versionId: string;
  contentHash: string;
  status: TemplateStatus;
  body: string;
  protectedSections: string[];
}

export class TemplateRegistry {
  private templates: Map<string, TemplateVersion[]> = new Map();

  register(templateId: string, versionId: string, body: string, protectedSections: string[] = [], status: TemplateStatus = 'active'): TemplateVersion {
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');
    const version: TemplateVersion = { versionId, contentHash, status, body, protectedSections };

    let versions = this.templates.get(templateId);
    if (!versions) {
      versions = [];
      this.templates.set(templateId, versions);
    }

    const idx = versions.findIndex(v => v.versionId === versionId);
    if (idx >= 0) {
      if (versions[idx].contentHash !== contentHash) {
         throw new Error(`Cannot mutate existing version ${versionId} content.`);
      }
      versions[idx].status = status;
    } else {
      versions.push(version);
    }
    return version;
  }

  getVersion(templateId: string, versionId: string): TemplateVersion | undefined {
    return this.templates.get(templateId)?.find(v => v.versionId === versionId);
  }

  getActiveVersion(templateId: string): TemplateVersion | undefined {
    const versions = this.templates.get(templateId) || [];
    return versions.slice().reverse().find(v => v.status === 'active');
  }
}
