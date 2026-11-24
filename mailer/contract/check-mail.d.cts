// Types of check-mail.cjs, for the TypeScript of the e2e fake mailer.

export interface MailCheckResult {
    ok: boolean;
    template: string | undefined;
    unknownTemplate: boolean;
    errors: string[];
}

export interface MailManifest {
    version: number;
    envelope: object;
    $defs: Record<string, object>;
    templates: Record<string, {
        description: string;
        senders?: string[];
        unused?: string;
        per_recipient_parameters?: boolean;
        parameters: object;
        examples: { name: string; sender?: string; parameters: Record<string, unknown> }[];
    }>;
}

export const MANIFEST_PATH: string;
export function loadManifest(): MailManifest;
export function templateName<T>(name: T): T;
export function checkMail(envelope: unknown, manifest?: MailManifest): MailCheckResult;
export function validate(value: unknown, schema: object, at: string, manifest: MailManifest, errors: string[]): void;
export function declaredPaths(schema: object, manifest?: MailManifest): Set<string>;
export function requiredPaths(schema: object, manifest?: MailManifest): Set<string>;
export function prune<T>(value: T, schema: object, manifest?: MailManifest): T;
export function nulls<T>(value: T, schema: object, manifest?: MailManifest): T;
