import fs from "node:fs";
import path from "node:path";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";

export type SharinganProject = {
  project: Project;
  addSourceFiles: (files: string[]) => SourceFile[];
};

export function createSharinganProject(cwd: string): SharinganProject {
  const tsConfigPath = path.join(cwd, "tsconfig.json");
  const project = fs.existsSync(tsConfigPath)
    ? new Project({
        tsConfigFilePath: tsConfigPath,
        skipAddingFilesFromTsConfig: true,
      })
    : new Project({
        compilerOptions: {
          target: 99,
          module: 99,
          jsx: 4,
          strict: true,
          allowJs: true,
        },
      });

  return {
    project,
    addSourceFiles(files: string[]) {
      return files.map((f) => project.addSourceFileAtPath(path.resolve(f)));
    },
  };
}

// ---------------------------------------------------------------------------
// Blast Radius — find all files referencing a given symbol
// ---------------------------------------------------------------------------

export type BlastRadiusResult = {
  impacted_files: string[];
  blast_summary: string;
};

/**
 * Given a set of file excerpts, find every file that imports or references
 * `targetSymbol` defined in `filePath`. Operates on in-memory excerpts
 * (no disk access required).
 */
export function getBlastRadius(
  excerpts: { path: string; excerpt: string }[],
  targetSymbol: string,
  filePath: string
): BlastRadiusResult {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const e of excerpts) {
    project.createSourceFile(e.path, e.excerpt, { overwrite: true });
  }

  const impacted = new Set<string>();
  const normalTarget = filePath.replace(/\\/g, "/").replace(/\.(ts|tsx|js|jsx)$/, "");

  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath().replace(/\\/g, "/");
    for (const decl of sf.getImportDeclarations()) {
      const moduleSpecifier = decl.getModuleSpecifierValue();
      const resolvedSpec = moduleSpecifier.replace(/\\/g, "/").replace(/\.(ts|tsx|js|jsx)$/, "");

      const specsMatch =
        resolvedSpec === normalTarget ||
        resolvedSpec.endsWith("/" + normalTarget.split("/").pop()) ||
        normalTarget.endsWith("/" + resolvedSpec.split("/").pop()!);

      if (!specsMatch) continue;

      const namedImports = decl.getNamedImports().map((n) => n.getName());
      const defaultImport = decl.getDefaultImport()?.getText();
      const namespaceImport = decl.getNamespaceImport()?.getText();

      if (
        namedImports.includes(targetSymbol) ||
        defaultImport === targetSymbol ||
        namespaceImport
      ) {
        impacted.add(sfPath);
      }
    }

    // Also check for bare identifier references (e.g. re-exports, type references)
    sf.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.Identifier &&
        node.getText() === targetSymbol &&
        sfPath !== filePath.replace(/\\/g, "/")
      ) {
        impacted.add(sfPath);
      }
    });
  }

  const files = [...impacted];
  const summary =
    files.length > 0
      ? `Symbol "${targetSymbol}" from ${filePath} is referenced in ${files.length} file(s): ${files.slice(0, 20).join(", ")}${files.length > 20 ? ` (+${files.length - 20} more)` : ""}`
      : `Symbol "${targetSymbol}" from ${filePath} has no detected references in the provided excerpts.`;

  return { impacted_files: files, blast_summary: summary };
}

// ---------------------------------------------------------------------------
// Prerequisite Scanner — detect missing infrastructure for a feature
// ---------------------------------------------------------------------------

export type PrerequisiteScanResult = {
  missing_prerequisites: string[];
  severity: "none" | "low" | "medium" | "high";
};

const FEATURE_PREREQUISITE_MAP: Record<string, { check: string; label: string }[]> = {
  auth: [
    { check: "prisma/schema.prisma|model User", label: "User model in Prisma schema" },
    { check: "NEXTAUTH_SECRET|AUTH_SECRET", label: "Auth secret env variable configuration" },
    { check: "SessionProvider|getServerSession", label: "Session provider setup" },
  ],
  stripe: [
    { check: "STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET", label: "Stripe env variables" },
    { check: "export async function POST", label: "POST route handler for webhooks" },
    { check: "rawBody|raw-body|bodyParser", label: "Raw body parsing for Stripe signature verification" },
  ],
  database: [
    { check: "prisma/schema.prisma|drizzle.config", label: "Database schema / ORM configuration" },
    { check: "DATABASE_URL|POSTGRES_URL", label: "Database connection string env" },
  ],
  storage: [
    { check: "S3Client|createClient|supabase.storage", label: "Storage client setup" },
    { check: "STORAGE_BUCKET|S3_BUCKET|SUPABASE_URL", label: "Storage environment variables" },
  ],
  realtime: [
    { check: "WebSocket|livekit|pusher|ably", label: "Realtime transport layer" },
    { check: "LIVEKIT_URL|PUSHER_KEY|ABLY_KEY", label: "Realtime service credentials" },
  ],
  email: [
    { check: "resend|sendgrid|nodemailer|SMTP", label: "Email sending service" },
    { check: "RESEND_API_KEY|SENDGRID_API_KEY|SMTP_HOST", label: "Email service credentials" },
  ],
};

/**
 * Given a feature intent and file excerpts, detect missing infrastructure.
 */
export function scanPrerequisites(
  excerpts: { path: string; excerpt: string }[],
  featureIntent: string,
  packageJsonDeps?: Record<string, string>
): PrerequisiteScanResult {
  const allContent = excerpts.map((e) => `--- ${e.path}\n${e.excerpt}`).join("\n");
  const depsStr = packageJsonDeps ? Object.keys(packageJsonDeps).join(" ") : "";
  const searchable = `${allContent}\n${depsStr}`.toLowerCase();
  const intentLower = featureIntent.toLowerCase();

  const missing: string[] = [];

  for (const [feature, checks] of Object.entries(FEATURE_PREREQUISITE_MAP)) {
    const featureTokens = feature.split(/[_-]/);
    const intentMatches = featureTokens.some((t) => intentLower.includes(t));
    if (!intentMatches) continue;

    for (const { check, label } of checks) {
      const tokens = check.split("|");
      const found = tokens.some((t) => searchable.includes(t.toLowerCase()));
      if (!found) {
        missing.push(label);
      }
    }
  }

  // Generic checks based on common patterns in the intent
  if (intentLower.includes("api") || intentLower.includes("endpoint") || intentLower.includes("route")) {
    const hasRouteHandler = searchable.includes("export async function") || searchable.includes("export function");
    if (!hasRouteHandler && !searchable.includes("app/api/")) {
      missing.push("API route handler scaffold (app/api/)");
    }
  }

  if (intentLower.includes("middleware") && !searchable.includes("middleware.ts")) {
    missing.push("Next.js middleware.ts file");
  }

  const severity: PrerequisiteScanResult["severity"] =
    missing.length === 0 ? "none"
    : missing.length <= 1 ? "low"
    : missing.length <= 3 ? "medium"
    : "high";

  return { missing_prerequisites: missing, severity };
}

// ---------------------------------------------------------------------------
// Architectural Boundary Checker — Server/Client component analysis
// ---------------------------------------------------------------------------

export type BoundaryCheckResult = {
  is_server_component: boolean;
  has_use_client: boolean;
  has_use_server: boolean;
  exported_symbols: string[];
  boundary_violations: string[];
};

/**
 * Analyze a file excerpt for Next.js architectural boundaries:
 * "use client" / "use server" directives, provider injection issues, etc.
 */
export function checkArchitecturalBoundaries(
  filePath: string,
  excerpt: string
): BoundaryCheckResult {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, excerpt, { overwrite: true });

  const firstStatement = sf.getStatements()[0];
  const firstText = firstStatement?.getText().trim() ?? "";
  const has_use_client = firstText === '"use client"' || firstText === "'use client'";
  const has_use_server = firstText === '"use server"' || firstText === "'use server'";
  const is_server_component = !has_use_client;

  const exported_symbols: string[] = [];
  for (const exp of sf.getExportedDeclarations()) {
    exported_symbols.push(exp[0]);
  }

  const violations: string[] = [];
  const normalPath = filePath.replace(/\\/g, "/");
  const isLayout = /layout\.(ts|tsx|js|jsx)$/.test(normalPath);
  const isPage = /page\.(ts|tsx|js|jsx)$/.test(normalPath);

  // Violation: layout.tsx with "use client" — forces entire subtree client-side
  if (isLayout && has_use_client) {
    violations.push(
      `${filePath} is a layout with "use client" — this forces all child routes into client-side rendering. ` +
      `Create a separate <Providers> client wrapper instead.`
    );
  }

  // Violation: Server Component importing client-only APIs
  if (is_server_component) {
    const clientOnlyImports = ["useState", "useEffect", "useReducer", "useContext", "useRef", "useCallback", "useMemo"];
    for (const decl of sf.getImportDeclarations()) {
      for (const named of decl.getNamedImports()) {
        if (clientOnlyImports.includes(named.getName())) {
          violations.push(
            `${filePath} appears to be a Server Component but imports "${named.getName()}" (client-only React hook). ` +
            `Add "use client" or extract the interactive part into a client component.`
          );
        }
      }
    }
  }

  // Violation: Context providers in Server Components
  if (is_server_component) {
    let hasProviderJsx = false;
    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxOpeningElement || node.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const tagName = node.getChildAtIndex(1)?.getText() ?? "";
        if (tagName.endsWith("Provider") || tagName.endsWith("Context")) {
          hasProviderJsx = true;
        }
      }
    });
    if (hasProviderJsx) {
      violations.push(
        `${filePath} is a Server Component wrapping children in a Provider/Context. ` +
        `Providers must be in a "use client" component. Extract into a dedicated <Providers> wrapper.`
      );
    }
  }

  // Violation: "use server" in a "use client" file
  if (has_use_client) {
    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.ExpressionStatement) {
        const text = node.getText().trim();
        if (text === '"use server"' || text === "'use server'") {
          violations.push(
            `${filePath} has both "use client" and "use server" directives — these are mutually exclusive.`
          );
        }
      }
    });
  }

  // Detect async Server Component patterns in client files
  if (has_use_client) {
    for (const fn of sf.getFunctions()) {
      if (fn.isAsync() && fn.isExported() && fn.isDefaultExport()) {
        const returnType = fn.getReturnType().getText();
        if (returnType.includes("JSX") || returnType.includes("Element")) {
          violations.push(
            `${filePath} exports an async default function with "use client" — async components must be Server Components.`
          );
        }
      }
    }
  }

  return {
    is_server_component,
    has_use_client,
    has_use_server,
    exported_symbols,
    boundary_violations: violations,
  };
}
