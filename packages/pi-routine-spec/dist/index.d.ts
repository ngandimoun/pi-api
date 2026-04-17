import { z } from 'zod';

declare const routineStepActionSchema: z.ZodEnum<["create_file", "run_command", "modify_file", "verify", "other"]>;
declare const routineStepSchema: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodEnum<["create_file", "run_command", "modify_file", "verify", "other"]>;
    description: z.ZodString;
    file_path: z.ZodOptional<z.ZodString>;
    command: z.ZodOptional<z.ZodString>;
    critical_rules: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    validation_checks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    depends_on_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
    description: string;
    critical_rules: string[];
    validation_checks: string[];
    depends_on_steps: string[];
    file_path?: string | undefined;
    command?: string | undefined;
}, {
    id: string;
    action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
    description: string;
    file_path?: string | undefined;
    command?: string | undefined;
    critical_rules?: string[] | undefined;
    validation_checks?: string[] | undefined;
    depends_on_steps?: string[] | undefined;
}>;
declare const routinePhaseSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        action: z.ZodEnum<["create_file", "run_command", "modify_file", "verify", "other"]>;
        description: z.ZodString;
        file_path: z.ZodOptional<z.ZodString>;
        command: z.ZodOptional<z.ZodString>;
        critical_rules: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        validation_checks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        depends_on_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
        description: string;
        critical_rules: string[];
        validation_checks: string[];
        depends_on_steps: string[];
        file_path?: string | undefined;
        command?: string | undefined;
    }, {
        id: string;
        action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
        description: string;
        file_path?: string | undefined;
        command?: string | undefined;
        critical_rules?: string[] | undefined;
        validation_checks?: string[] | undefined;
        depends_on_steps?: string[] | undefined;
    }>, "many">;
    depends_on_phases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    unlock_condition: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["manual", "check_pass", "test_pass"]>;
        details: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "manual" | "check_pass" | "test_pass";
        details?: string | undefined;
    }, {
        type: "manual" | "check_pass" | "test_pass";
        details?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    steps: {
        id: string;
        action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
        description: string;
        critical_rules: string[];
        validation_checks: string[];
        depends_on_steps: string[];
        file_path?: string | undefined;
        command?: string | undefined;
    }[];
    depends_on_phases: string[];
    unlock_condition?: {
        type: "manual" | "check_pass" | "test_pass";
        details?: string | undefined;
    } | undefined;
}, {
    id: string;
    title: string;
    steps: {
        id: string;
        action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
        description: string;
        file_path?: string | undefined;
        command?: string | undefined;
        critical_rules?: string[] | undefined;
        validation_checks?: string[] | undefined;
        depends_on_steps?: string[] | undefined;
    }[];
    depends_on_phases?: string[] | undefined;
    unlock_condition?: {
        type: "manual" | "check_pass" | "test_pass";
        details?: string | undefined;
    } | undefined;
}>;
declare const routineConstraintsSchema: z.ZodObject<{
    must_use: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    must_not: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    conventions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    must_use: string[];
    must_not: string[];
    conventions: string[];
}, {
    must_use?: string[] | undefined;
    must_not?: string[] | undefined;
    conventions?: string[] | undefined;
}>;
declare const routineContextBlockSchema: z.ZodObject<{
    framework: z.ZodDefault<z.ZodString>;
    existing_patterns: z.ZodDefault<z.ZodObject<{
        imports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        components: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        hooks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        imports: string[];
        components: string[];
        hooks: string[];
    }, {
        imports?: string[] | undefined;
        components?: string[] | undefined;
        hooks?: string[] | undefined;
    }>>;
    constraints: z.ZodDefault<z.ZodObject<{
        must_use: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        must_not: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        conventions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        must_use: string[];
        must_not: string[];
        conventions: string[];
    }, {
        must_use?: string[] | undefined;
        must_not?: string[] | undefined;
        conventions?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    framework: string;
    existing_patterns: {
        imports: string[];
        components: string[];
        hooks: string[];
    };
    constraints: {
        must_use: string[];
        must_not: string[];
        conventions: string[];
    };
}, {
    framework?: string | undefined;
    existing_patterns?: {
        imports?: string[] | undefined;
        components?: string[] | undefined;
        hooks?: string[] | undefined;
    } | undefined;
    constraints?: {
        must_use?: string[] | undefined;
        must_not?: string[] | undefined;
        conventions?: string[] | undefined;
    } | undefined;
}>;
declare const routineValidationSchema: z.ZodObject<{
    required_files: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    required_exports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    test_commands: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    required_files: string[];
    required_exports: string[];
    test_commands: string[];
}, {
    required_files?: string[] | undefined;
    required_exports?: string[] | undefined;
    test_commands?: string[] | undefined;
}>;
declare const routineMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodNumber;
    intent: z.ZodString;
    created_at: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    version: number;
    intent: string;
    tags: string[];
    references: string[];
    created_at?: string | undefined;
}, {
    id: string;
    version: number;
    intent: string;
    created_at?: string | undefined;
    tags?: string[] | undefined;
    references?: string[] | undefined;
}>;
declare const routineFileEntrySchema: z.ZodObject<{
    path: z.ZodString;
    purpose: z.ZodString;
    depends_on: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    action: z.ZodEnum<["create", "modify", "verify"]>;
}, "strip", z.ZodTypeAny, {
    action: "verify" | "create" | "modify";
    path: string;
    purpose: string;
    depends_on: string[];
}, {
    action: "verify" | "create" | "modify";
    path: string;
    purpose: string;
    depends_on?: string[] | undefined;
}>;
declare const routineSpecificationSchema: z.ZodObject<{
    metadata: z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        intent: z.ZodString;
        created_at: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        intent: string;
        tags: string[];
        references: string[];
        created_at?: string | undefined;
    }, {
        id: string;
        version: number;
        intent: string;
        created_at?: string | undefined;
        tags?: string[] | undefined;
        references?: string[] | undefined;
    }>;
    context: z.ZodObject<{
        framework: z.ZodDefault<z.ZodString>;
        existing_patterns: z.ZodDefault<z.ZodObject<{
            imports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            components: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            hooks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            imports: string[];
            components: string[];
            hooks: string[];
        }, {
            imports?: string[] | undefined;
            components?: string[] | undefined;
            hooks?: string[] | undefined;
        }>>;
        constraints: z.ZodDefault<z.ZodObject<{
            must_use: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            must_not: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            conventions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            must_use: string[];
            must_not: string[];
            conventions: string[];
        }, {
            must_use?: string[] | undefined;
            must_not?: string[] | undefined;
            conventions?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        framework: string;
        existing_patterns: {
            imports: string[];
            components: string[];
            hooks: string[];
        };
        constraints: {
            must_use: string[];
            must_not: string[];
            conventions: string[];
        };
    }, {
        framework?: string | undefined;
        existing_patterns?: {
            imports?: string[] | undefined;
            components?: string[] | undefined;
            hooks?: string[] | undefined;
        } | undefined;
        constraints?: {
            must_use?: string[] | undefined;
            must_not?: string[] | undefined;
            conventions?: string[] | undefined;
        } | undefined;
    }>;
    /** All repo files this routine creates, modifies, or verifies (executor scope). */
    files_manifest: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        purpose: z.ZodString;
        depends_on: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        action: z.ZodEnum<["create", "modify", "verify"]>;
    }, "strip", z.ZodTypeAny, {
        action: "verify" | "create" | "modify";
        path: string;
        purpose: string;
        depends_on: string[];
    }, {
        action: "verify" | "create" | "modify";
        path: string;
        purpose: string;
        depends_on?: string[] | undefined;
    }>, "many">>;
    phases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            action: z.ZodEnum<["create_file", "run_command", "modify_file", "verify", "other"]>;
            description: z.ZodString;
            file_path: z.ZodOptional<z.ZodString>;
            command: z.ZodOptional<z.ZodString>;
            critical_rules: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            validation_checks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            depends_on_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            critical_rules: string[];
            validation_checks: string[];
            depends_on_steps: string[];
            file_path?: string | undefined;
            command?: string | undefined;
        }, {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            file_path?: string | undefined;
            command?: string | undefined;
            critical_rules?: string[] | undefined;
            validation_checks?: string[] | undefined;
            depends_on_steps?: string[] | undefined;
        }>, "many">;
        depends_on_phases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        unlock_condition: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["manual", "check_pass", "test_pass"]>;
            details: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        }, {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        steps: {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            critical_rules: string[];
            validation_checks: string[];
            depends_on_steps: string[];
            file_path?: string | undefined;
            command?: string | undefined;
        }[];
        depends_on_phases: string[];
        unlock_condition?: {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        } | undefined;
    }, {
        id: string;
        title: string;
        steps: {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            file_path?: string | undefined;
            command?: string | undefined;
            critical_rules?: string[] | undefined;
            validation_checks?: string[] | undefined;
            depends_on_steps?: string[] | undefined;
        }[];
        depends_on_phases?: string[] | undefined;
        unlock_condition?: {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        } | undefined;
    }>, "many">;
    validation: z.ZodDefault<z.ZodObject<{
        required_files: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        required_exports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        test_commands: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        required_files: string[];
        required_exports: string[];
        test_commands: string[];
    }, {
        required_files?: string[] | undefined;
        required_exports?: string[] | undefined;
        test_commands?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    validation: {
        required_files: string[];
        required_exports: string[];
        test_commands: string[];
    };
    metadata: {
        id: string;
        version: number;
        intent: string;
        tags: string[];
        references: string[];
        created_at?: string | undefined;
    };
    context: {
        framework: string;
        existing_patterns: {
            imports: string[];
            components: string[];
            hooks: string[];
        };
        constraints: {
            must_use: string[];
            must_not: string[];
            conventions: string[];
        };
    };
    files_manifest: {
        action: "verify" | "create" | "modify";
        path: string;
        purpose: string;
        depends_on: string[];
    }[];
    phases: {
        id: string;
        title: string;
        steps: {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            critical_rules: string[];
            validation_checks: string[];
            depends_on_steps: string[];
            file_path?: string | undefined;
            command?: string | undefined;
        }[];
        depends_on_phases: string[];
        unlock_condition?: {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        } | undefined;
    }[];
}, {
    metadata: {
        id: string;
        version: number;
        intent: string;
        created_at?: string | undefined;
        tags?: string[] | undefined;
        references?: string[] | undefined;
    };
    context: {
        framework?: string | undefined;
        existing_patterns?: {
            imports?: string[] | undefined;
            components?: string[] | undefined;
            hooks?: string[] | undefined;
        } | undefined;
        constraints?: {
            must_use?: string[] | undefined;
            must_not?: string[] | undefined;
            conventions?: string[] | undefined;
        } | undefined;
    };
    phases: {
        id: string;
        title: string;
        steps: {
            id: string;
            action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
            description: string;
            file_path?: string | undefined;
            command?: string | undefined;
            critical_rules?: string[] | undefined;
            validation_checks?: string[] | undefined;
            depends_on_steps?: string[] | undefined;
        }[];
        depends_on_phases?: string[] | undefined;
        unlock_condition?: {
            type: "manual" | "check_pass" | "test_pass";
            details?: string | undefined;
        } | undefined;
    }[];
    validation?: {
        required_files?: string[] | undefined;
        required_exports?: string[] | undefined;
        test_commands?: string[] | undefined;
    } | undefined;
    files_manifest?: {
        action: "verify" | "create" | "modify";
        path: string;
        purpose: string;
        depends_on?: string[] | undefined;
    }[] | undefined;
}>;
type RoutineSpecification = z.infer<typeof routineSpecificationSchema>;
type RoutineFileEntry = z.infer<typeof routineFileEntrySchema>;
type RoutineMetadata = z.infer<typeof routineMetadataSchema>;
type RoutinePhase = z.infer<typeof routinePhaseSchema>;
type RoutineStep = z.infer<typeof routineStepSchema>;

/**
 * Render a Pi routine as Markdown with YAML frontmatter (machine- and human-readable).
 */
declare function routineSpecToMarkdown(spec: RoutineSpecification): string;

type ParsedRoutineFile = {
    frontmatter: Record<string, unknown>;
    body: string;
};
/**
 * Split YAML frontmatter from markdown body (generic).
 */
declare function splitFrontmatter(markdown: string): ParsedRoutineFile | null;
/**
 * True if markdown looks like an enhanced Pi routine (v2 frontmatter).
 */
declare function isEnhancedRoutineMarkdown(markdown: string): boolean;
/**
 * Parse enhanced routine body into structured spec when possible (best-effort).
 * Full round-trip is via server-generated JSON embedded in frontmatter in future;
 * for v2 we primarily validate metadata and keep phases in markdown.
 */
declare function parseRoutineMarkdownLoose(markdown: string): {
    meta: Partial<RoutineSpecification["metadata"]>;
    raw: ParsedRoutineFile;
} | null;
/** Validate a full RoutineSpecification object. */
declare function safeParseRoutineSpecification(data: unknown): RoutineSpecification | null;
/**
 * Parse a v2 routine markdown (as produced by `routineSpecToMarkdown`) into a full `RoutineSpecification`.
 * Best-effort: tolerates minor formatting differences; validates with Zod at the end.
 */
declare function parseRoutineMarkdownFull(markdown: string): RoutineSpecification | null;

/**
 * Cursor Rules (.mdc) — inject as project rule file.
 */
declare function toCursorRuleMdc(spec: RoutineSpecification, opts?: {
    description?: string;
}): string;
/**
 * Append-friendly section for AGENTS.md / CLAUDE.md style agent instructions.
 */
declare function toClaudeAgentsSection(spec: RoutineSpecification): string;
/**
 * Windsurf rule markdown (directory layout may vary; content is portable).
 */
declare function toWindsurfRuleMarkdown(spec: RoutineSpecification): string;

declare const templateCategorySchema: z.ZodEnum<["auth", "storage", "ui", "api", "deployment", "testing", "ai", "agent", "workflow", "backend", "integration", "database", "realtime", "infrastructure"]>;
declare const routineTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["auth", "storage", "ui", "api", "deployment", "testing", "ai", "agent", "workflow", "backend", "integration", "database", "realtime", "infrastructure"]>;
    stack: z.ZodArray<z.ZodString, "many">;
    routine_spec: z.ZodObject<{
        metadata: z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            intent: z.ZodString;
            created_at: z.ZodOptional<z.ZodString>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            intent: string;
            tags: string[];
            references: string[];
            created_at?: string | undefined;
        }, {
            id: string;
            version: number;
            intent: string;
            created_at?: string | undefined;
            tags?: string[] | undefined;
            references?: string[] | undefined;
        }>;
        context: z.ZodObject<{
            framework: z.ZodDefault<z.ZodString>;
            existing_patterns: z.ZodDefault<z.ZodObject<{
                imports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                components: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                hooks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                imports: string[];
                components: string[];
                hooks: string[];
            }, {
                imports?: string[] | undefined;
                components?: string[] | undefined;
                hooks?: string[] | undefined;
            }>>;
            constraints: z.ZodDefault<z.ZodObject<{
                must_use: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                must_not: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                conventions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                must_use: string[];
                must_not: string[];
                conventions: string[];
            }, {
                must_use?: string[] | undefined;
                must_not?: string[] | undefined;
                conventions?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            framework: string;
            existing_patterns: {
                imports: string[];
                components: string[];
                hooks: string[];
            };
            constraints: {
                must_use: string[];
                must_not: string[];
                conventions: string[];
            };
        }, {
            framework?: string | undefined;
            existing_patterns?: {
                imports?: string[] | undefined;
                components?: string[] | undefined;
                hooks?: string[] | undefined;
            } | undefined;
            constraints?: {
                must_use?: string[] | undefined;
                must_not?: string[] | undefined;
                conventions?: string[] | undefined;
            } | undefined;
        }>;
        files_manifest: z.ZodDefault<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            purpose: z.ZodString;
            depends_on: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            action: z.ZodEnum<["create", "modify", "verify"]>;
        }, "strip", z.ZodTypeAny, {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on: string[];
        }, {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on?: string[] | undefined;
        }>, "many">>;
        phases: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            steps: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                action: z.ZodEnum<["create_file", "run_command", "modify_file", "verify", "other"]>;
                description: z.ZodString;
                file_path: z.ZodOptional<z.ZodString>;
                command: z.ZodOptional<z.ZodString>;
                critical_rules: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                validation_checks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                depends_on_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                critical_rules: string[];
                validation_checks: string[];
                depends_on_steps: string[];
                file_path?: string | undefined;
                command?: string | undefined;
            }, {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                file_path?: string | undefined;
                command?: string | undefined;
                critical_rules?: string[] | undefined;
                validation_checks?: string[] | undefined;
                depends_on_steps?: string[] | undefined;
            }>, "many">;
            depends_on_phases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            unlock_condition: z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<["manual", "check_pass", "test_pass"]>;
                details: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            }, {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                critical_rules: string[];
                validation_checks: string[];
                depends_on_steps: string[];
                file_path?: string | undefined;
                command?: string | undefined;
            }[];
            depends_on_phases: string[];
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }, {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                file_path?: string | undefined;
                command?: string | undefined;
                critical_rules?: string[] | undefined;
                validation_checks?: string[] | undefined;
                depends_on_steps?: string[] | undefined;
            }[];
            depends_on_phases?: string[] | undefined;
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }>, "many">;
        validation: z.ZodDefault<z.ZodObject<{
            required_files: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            required_exports: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            test_commands: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            required_files: string[];
            required_exports: string[];
            test_commands: string[];
        }, {
            required_files?: string[] | undefined;
            required_exports?: string[] | undefined;
            test_commands?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        validation: {
            required_files: string[];
            required_exports: string[];
            test_commands: string[];
        };
        metadata: {
            id: string;
            version: number;
            intent: string;
            tags: string[];
            references: string[];
            created_at?: string | undefined;
        };
        context: {
            framework: string;
            existing_patterns: {
                imports: string[];
                components: string[];
                hooks: string[];
            };
            constraints: {
                must_use: string[];
                must_not: string[];
                conventions: string[];
            };
        };
        files_manifest: {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on: string[];
        }[];
        phases: {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                critical_rules: string[];
                validation_checks: string[];
                depends_on_steps: string[];
                file_path?: string | undefined;
                command?: string | undefined;
            }[];
            depends_on_phases: string[];
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }[];
    }, {
        metadata: {
            id: string;
            version: number;
            intent: string;
            created_at?: string | undefined;
            tags?: string[] | undefined;
            references?: string[] | undefined;
        };
        context: {
            framework?: string | undefined;
            existing_patterns?: {
                imports?: string[] | undefined;
                components?: string[] | undefined;
                hooks?: string[] | undefined;
            } | undefined;
            constraints?: {
                must_use?: string[] | undefined;
                must_not?: string[] | undefined;
                conventions?: string[] | undefined;
            } | undefined;
        };
        phases: {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                file_path?: string | undefined;
                command?: string | undefined;
                critical_rules?: string[] | undefined;
                validation_checks?: string[] | undefined;
                depends_on_steps?: string[] | undefined;
            }[];
            depends_on_phases?: string[] | undefined;
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }[];
        validation?: {
            required_files?: string[] | undefined;
            required_exports?: string[] | undefined;
            test_commands?: string[] | undefined;
        } | undefined;
        files_manifest?: {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on?: string[] | undefined;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    name: string;
    category: "auth" | "storage" | "ui" | "api" | "deployment" | "testing" | "ai" | "agent" | "workflow" | "backend" | "integration" | "database" | "realtime" | "infrastructure";
    stack: string[];
    routine_spec: {
        validation: {
            required_files: string[];
            required_exports: string[];
            test_commands: string[];
        };
        metadata: {
            id: string;
            version: number;
            intent: string;
            tags: string[];
            references: string[];
            created_at?: string | undefined;
        };
        context: {
            framework: string;
            existing_patterns: {
                imports: string[];
                components: string[];
                hooks: string[];
            };
            constraints: {
                must_use: string[];
                must_not: string[];
                conventions: string[];
            };
        };
        files_manifest: {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on: string[];
        }[];
        phases: {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                critical_rules: string[];
                validation_checks: string[];
                depends_on_steps: string[];
                file_path?: string | undefined;
                command?: string | undefined;
            }[];
            depends_on_phases: string[];
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }[];
    };
}, {
    id: string;
    description: string;
    name: string;
    category: "auth" | "storage" | "ui" | "api" | "deployment" | "testing" | "ai" | "agent" | "workflow" | "backend" | "integration" | "database" | "realtime" | "infrastructure";
    stack: string[];
    routine_spec: {
        metadata: {
            id: string;
            version: number;
            intent: string;
            created_at?: string | undefined;
            tags?: string[] | undefined;
            references?: string[] | undefined;
        };
        context: {
            framework?: string | undefined;
            existing_patterns?: {
                imports?: string[] | undefined;
                components?: string[] | undefined;
                hooks?: string[] | undefined;
            } | undefined;
            constraints?: {
                must_use?: string[] | undefined;
                must_not?: string[] | undefined;
                conventions?: string[] | undefined;
            } | undefined;
        };
        phases: {
            id: string;
            title: string;
            steps: {
                id: string;
                action: "create_file" | "run_command" | "modify_file" | "verify" | "other";
                description: string;
                file_path?: string | undefined;
                command?: string | undefined;
                critical_rules?: string[] | undefined;
                validation_checks?: string[] | undefined;
                depends_on_steps?: string[] | undefined;
            }[];
            depends_on_phases?: string[] | undefined;
            unlock_condition?: {
                type: "manual" | "check_pass" | "test_pass";
                details?: string | undefined;
            } | undefined;
        }[];
        validation?: {
            required_files?: string[] | undefined;
            required_exports?: string[] | undefined;
            test_commands?: string[] | undefined;
        } | undefined;
        files_manifest?: {
            action: "verify" | "create" | "modify";
            path: string;
            purpose: string;
            depends_on?: string[] | undefined;
        }[] | undefined;
    };
}>;
type RoutineTemplate = z.infer<typeof routineTemplateSchema>;
type TemplateCategory = z.infer<typeof templateCategorySchema>;

declare const executionPlanRoutineRefSchema: z.ZodObject<{
    routine_id: z.ZodString;
    routine_file: z.ZodString;
    execution_order: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    routine_id: string;
    routine_file: string;
    execution_order: number;
    reason: string;
}, {
    routine_id: string;
    routine_file: string;
    execution_order: number;
    reason: string;
}>;
declare const executionPlanGlueSchema: z.ZodObject<{
    routine_id: z.ZodString;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    routine_id: string;
}, {
    description: string;
    routine_id: string;
}>;
declare const executionPlanSchema: z.ZodObject<{
    plan_id: z.ZodString;
    intent: z.ZodString;
    routines: z.ZodArray<z.ZodObject<{
        routine_id: z.ZodString;
        routine_file: z.ZodString;
        execution_order: z.ZodNumber;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        routine_id: string;
        routine_file: string;
        execution_order: number;
        reason: string;
    }, {
        routine_id: string;
        routine_file: string;
        execution_order: number;
        reason: string;
    }>, "many">;
    glue_routine: z.ZodOptional<z.ZodObject<{
        routine_id: z.ZodString;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        routine_id: string;
    }, {
        description: string;
        routine_id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    intent: string;
    plan_id: string;
    routines: {
        routine_id: string;
        routine_file: string;
        execution_order: number;
        reason: string;
    }[];
    glue_routine?: {
        description: string;
        routine_id: string;
    } | undefined;
}, {
    intent: string;
    plan_id: string;
    routines: {
        routine_id: string;
        routine_file: string;
        execution_order: number;
        reason: string;
    }[];
    glue_routine?: {
        description: string;
        routine_id: string;
    } | undefined;
}>;
type ExecutionPlan = z.infer<typeof executionPlanSchema>;
type ExecutionPlanRoutineRef = z.infer<typeof executionPlanRoutineRefSchema>;
/**
 * Render an execution plan as markdown with YAML frontmatter for agents.
 */
declare function renderExecutionPlan(plan: ExecutionPlan): string;

type DriftViolation = {
    routine_id: string;
    type: "missing_file" | "unexpected_file" | "constraint_violation";
    message: string;
    file?: string;
};
/**
 * Compare changed files (e.g. git diff) against a routine's files_manifest and optional file contents.
 * - **create** entries: path should appear in changedFiles (or exist check left to caller).
 * - **unexpected**: changed files not listed in manifest paths.
 * - **constraints**: when `fileContents` is provided, scan for must_use / must_not substrings.
 */
declare function detectRoutineDrift(changedFiles: string[], routineSpec: RoutineSpecification, opts?: {
    fileContents?: Map<string, string>;
}): DriftViolation[];

export { type DriftViolation, type ExecutionPlan, type ExecutionPlanRoutineRef, type ParsedRoutineFile, type RoutineFileEntry, type RoutineMetadata, type RoutinePhase, type RoutineSpecification, type RoutineStep, type RoutineTemplate, type TemplateCategory, detectRoutineDrift, executionPlanGlueSchema, executionPlanRoutineRefSchema, executionPlanSchema, isEnhancedRoutineMarkdown, parseRoutineMarkdownFull, parseRoutineMarkdownLoose, renderExecutionPlan, routineConstraintsSchema, routineContextBlockSchema, routineFileEntrySchema, routineMetadataSchema, routinePhaseSchema, routineSpecToMarkdown, routineSpecificationSchema, routineStepActionSchema, routineStepSchema, routineTemplateSchema, routineValidationSchema, safeParseRoutineSpecification, splitFrontmatter, templateCategorySchema, toClaudeAgentsSection, toCursorRuleMdc, toWindsurfRuleMarkdown };
