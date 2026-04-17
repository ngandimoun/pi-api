/**
 * Shared dependency → stack detection for `pi init`, routine context, and constitution hints.
 */

export type FrameworkDetection = {
  name: string;
  version?: string;
};

/** Merge dependency and devDependency maps from package.json */
export function mergePackageDeps(pkg: Record<string, unknown>): Record<string, string> {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  return deps;
}

function hasDepPrefix(deps: Record<string, string>, prefix: string): boolean {
  return Object.keys(deps).some((k) => k === prefix || k.startsWith(`${prefix}/`));
}

/**
 * Ordered list of frameworks detected from package.json dependency keys.
 */
export function detectFrameworksFromDeps(deps: Record<string, string>): FrameworkDetection[] {
  const frameworks: FrameworkDetection[] = [];
  const d = deps;

  if (d.next) frameworks.push({ name: "Next.js", version: d.next });
  if (d.react) frameworks.push({ name: "React", version: d.react });
  if (d.vue) frameworks.push({ name: "Vue", version: d.vue });
  if (d.svelte || d["@sveltejs/kit"]) frameworks.push({ name: "Svelte/SvelteKit" });
  if (d.astro) frameworks.push({ name: "Astro", version: d.astro });
  if (d["@remix-run/react"]) frameworks.push({ name: "Remix", version: d["@remix-run/react"] });
  if (d.nuxt) frameworks.push({ name: "Nuxt", version: d.nuxt });
  if (d["solid-js"]) frameworks.push({ name: "SolidJS", version: d["solid-js"] });

  if (d.tailwindcss) frameworks.push({ name: "Tailwind CSS", version: d.tailwindcss });
  if (d["@chakra-ui/react"]) frameworks.push({ name: "Chakra UI", version: d["@chakra-ui/react"] });
  if (d["@mui/material"]) frameworks.push({ name: "Material UI", version: d["@mui/material"] });
  if (d.antd) frameworks.push({ name: "Ant Design", version: d.antd });
  if (d["@mantine/core"]) frameworks.push({ name: "Mantine", version: d["@mantine/core"] });
  if (d["@headlessui/react"]) frameworks.push({ name: "Headless UI", version: d["@headlessui/react"] });
  if (hasDepPrefix(d, "@radix-ui")) frameworks.push({ name: "Radix UI" });

  if (d.express) frameworks.push({ name: "Express", version: d.express });
  if (d.fastify) frameworks.push({ name: "Fastify", version: d.fastify });
  if (d["@nestjs/core"]) frameworks.push({ name: "NestJS", version: d["@nestjs/core"] });
  if (d.hono) frameworks.push({ name: "Hono", version: d.hono });
  if (d["@trpc/server"]) frameworks.push({ name: "tRPC", version: d["@trpc/server"] });

  if (d.prisma || d["@prisma/client"]) frameworks.push({ name: "Prisma" });
  if (d.drizzle || d["drizzle-orm"]) frameworks.push({ name: "Drizzle ORM" });
  if (d.mongoose) frameworks.push({ name: "Mongoose", version: d.mongoose });
  if (d.typeorm) frameworks.push({ name: "TypeORM", version: d.typeorm });
  if (d.sequelize) frameworks.push({ name: "Sequelize", version: d.sequelize });
  if (d.knex) frameworks.push({ name: "Knex", version: d.knex });

  if (d.zustand) frameworks.push({ name: "Zustand" });
  if (d["@tanstack/react-query"]) frameworks.push({ name: "React Query" });
  if (d.stripe || d["@stripe/stripe-js"]) frameworks.push({ name: "Stripe" });
  if (d["@supabase/supabase-js"]) frameworks.push({ name: "Supabase" });

  if (d.ai || hasDepPrefix(d, "@ai-sdk")) frameworks.push({ name: "Vercel AI SDK", version: d.ai });
  if (d.langchain || hasDepPrefix(d, "@langchain")) frameworks.push({ name: "LangChain" });
  if (d.openai) frameworks.push({ name: "OpenAI SDK", version: d.openai });
  if (d["@anthropic-ai/sdk"]) frameworks.push({ name: "Anthropic SDK", version: d["@anthropic-ai/sdk"] });
  if (d["@google/generative-ai"] || d["@google/genai"]) {
    frameworks.push({
      name: "Google Generative AI",
      version: d["@google/genai"] ?? d["@google/generative-ai"],
    });
  }
  if (d["@huggingface/inference"]) frameworks.push({ name: "Hugging Face", version: d["@huggingface/inference"] });
  if (d["@mastra/core"]) frameworks.push({ name: "Mastra", version: d["@mastra/core"] });

  if (d.typescript) frameworks.push({ name: "TypeScript", version: d.typescript });

  return frameworks;
}

/**
 * Normalized slug hints for API routine context (lowercase, stable ids).
 */
export function frameworkHintsFromDeps(deps: Record<string, string>): string[] {
  const hints = new Set<string>();
  if (deps.next) hints.add("next.js");
  if (deps.react) hints.add("react");
  if (deps.vue) hints.add("vue");
  if (deps.svelte || deps["@sveltejs/kit"]) hints.add("svelte");
  if (deps.astro) hints.add("astro");
  if (deps["@remix-run/react"]) hints.add("remix");
  if (deps.nuxt) hints.add("nuxt");
  if (deps["solid-js"]) hints.add("solid-js");
  if (deps.tailwindcss) hints.add("tailwind");
  if (deps["@chakra-ui/react"]) hints.add("chakra-ui");
  if (deps["@mui/material"]) hints.add("mui");
  if (deps.antd) hints.add("antd");
  if (deps["@mantine/core"]) hints.add("mantine");
  if (deps["@headlessui/react"]) hints.add("headless-ui");
  if (hasDepPrefix(deps, "@radix-ui")) hints.add("radix-ui");
  if (deps.express) hints.add("express");
  if (deps.fastify) hints.add("fastify");
  if (deps["@nestjs/core"]) hints.add("nestjs");
  if (deps.hono) hints.add("hono");
  if (deps["@trpc/server"]) hints.add("trpc");
  if (deps.prisma || deps["@prisma/client"]) hints.add("prisma");
  if (deps.drizzle || deps["drizzle-orm"]) hints.add("drizzle");
  if (deps.mongoose) hints.add("mongoose");
  if (deps.typeorm) hints.add("typeorm");
  if (deps.sequelize) hints.add("sequelize");
  if (deps.knex) hints.add("knex");
  if (deps.zustand) hints.add("zustand");
  if (deps["@tanstack/react-query"]) hints.add("react-query");
  if (deps.stripe || deps["@stripe/stripe-js"]) hints.add("stripe");
  if (deps["@supabase/supabase-js"]) hints.add("supabase");
  if (deps.ai || hasDepPrefix(deps, "@ai-sdk")) hints.add("vercel-ai-sdk");
  if (deps.langchain || hasDepPrefix(deps, "@langchain")) hints.add("langchain");
  if (deps.openai) hints.add("openai");
  if (deps["@anthropic-ai/sdk"]) hints.add("anthropic");
  if (deps["@google/generative-ai"] || deps["@google/genai"]) hints.add("google-genai");
  if (deps["@huggingface/inference"]) hints.add("huggingface");
  if (deps["@mastra/core"]) hints.add("mastra");
  return [...hints].sort();
}
