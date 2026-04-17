import { routineTemplateSchema, type RoutineTemplate } from "pi-routine-spec";

import aiSdkChat from "../templates/ai-sdk-chat-interface.json" with { type: "json" };
import apiRouteCrud from "../templates/api-route-crud.json" with { type: "json" };
import chakraCard from "../templates/chakra-ui-card-component.json" with { type: "json" };
import cronScheduled from "../templates/cron-scheduled-task.json" with { type: "json" };
import expressCrud from "../templates/express-rest-crud.json" with { type: "json" };
import fastifyPlugin from "../templates/fastify-plugin-pattern.json" with { type: "json" };
import geminiMultimodal from "../templates/gemini-multimodal-tool.json" with { type: "json" };
import headlessModal from "../templates/headless-ui-modal.json" with { type: "json" };
import honoMiddleware from "../templates/hono-middleware.json" with { type: "json" };
import langchainRag from "../templates/langchain-rag-pipeline.json" with { type: "json" };
import livekitRoom from "../templates/livekit-room-session.json" with { type: "json" };
import mantineLayout from "../templates/mantine-dashboard-layout.json" with { type: "json" };
import mastraAgent from "../templates/mastra-agent-scaffold.json" with { type: "json" };
import mastraWorkflowHitl from "../templates/mastra-workflow-hitl.json" with { type: "json" };
import materialForm from "../templates/material-ui-form.json" with { type: "json" };
import nextSupabaseAuth from "../templates/next-supabase-auth.json" with { type: "json" };
import openaiFunctions from "../templates/openai-function-calling.json" with { type: "json" };
import serverActionPattern from "../templates/server-action-pattern.json" with { type: "json" };
import shadcnCard from "../templates/shadcn-card-component.json" with { type: "json" };
import sqlMigration from "../templates/sql-migration-checklist.json" with { type: "json" };
import stripeCheckout from "../templates/stripe-checkout-flow.json" with { type: "json" };
import supabaseRealtime from "../templates/supabase-realtime-subscription.json" with { type: "json" };
import supabaseStorage from "../templates/supabase-storage-upload.json" with { type: "json" };
import triggerDevJob from "../templates/trigger-dev-job.json" with { type: "json" };
import trpcRouter from "../templates/trpc-router.json" with { type: "json" };
import vitestSkeleton from "../templates/vitest-unit-skeleton.json" with { type: "json" };
import webhookHandler from "../templates/webhook-handler-pattern.json" with { type: "json" };

// UI/UX knowledge pack (token-safe docs-as-routines)
import uiUxPlaybook from "../templates/ui-ux/ui-ux-playbook.json" with { type: "json" };
import uiUxForPms from "../templates/ui-ux/ui-ux-for-product-managers.json" with { type: "json" };
import uiUxMetricsForPms from "../templates/ui-ux/ui-ux-metrics-for-pms.json" with { type: "json" };
import uiUxProcess5Stages from "../templates/ui-ux/ui-ux-design-process-5-stages.json" with { type: "json" };
import uiUxUiVsUx from "../templates/ui-ux/ui-ux-ui-vs-ux-clarifier.json" with { type: "json" };
import uiUxUiPrinciples7 from "../templates/ui-ux/ui-ux-ui-principles-7.json" with { type: "json" };
import uiUxAestheticUsability from "../templates/ui-ux/ui-ux-aesthetic-usability-effect.json" with { type: "json" };
import uiUxVisualPrinciples12 from "../templates/ui-ux/ui-ux-visual-design-principles-12.json" with { type: "json" };
import uiUxPrinciples2026 from "../templates/ui-ux/ui-ux-principles-2026.json" with { type: "json" };
import uiUxColorTheory from "../templates/ui-ux/ui-ux-color-theory-basics.json" with { type: "json" };
import frontendDistinctiveUi from "../templates/ui-ux/frontend-design-distinctive-ui-skill.json" with { type: "json" };
import shadcnUiPlaybook from "../templates/ui-ux/shadcn-ui-playbook.json" with { type: "json" };
import shadcnUiPrinciples from "../templates/ui-ux/shadcn-ui-principles-aesthetic.json" with { type: "json" };
import shadcnUiBestPractices from "../templates/ui-ux/shadcn-ui-best-practices-2026.json" with { type: "json" };
import shadcnUiStructure from "../templates/ui-ux/shadcn-ui-structure-for-scale.json" with { type: "json" };
import shadcnUiBlocks from "../templates/ui-ux/shadcn-ui-blocks-guide.json" with { type: "json" };
import shadcnUiEcosystem from "../templates/ui-ux/shadcn-ui-ecosystem-libraries.json" with { type: "json" };
import chakraUiPlaybook from "../templates/ui-ux/chakra-ui-playbook.json" with { type: "json" };
import chakraUiPrinciples from "../templates/ui-ux/chakra-ui-principles.json" with { type: "json" };
import chakraUiVsTailwind from "../templates/ui-ux/chakra-ui-vs-tailwind.json" with { type: "json" };
import chakraUiVsMui from "../templates/ui-ux/chakra-ui-vs-mui.json" with { type: "json" };
import chakraUiVsAnt from "../templates/ui-ux/chakra-ui-vs-ant-design.json" with { type: "json" };
import chakraUiVsThemeUi from "../templates/ui-ux/chakra-ui-vs-theme-ui.json" with { type: "json" };
import chakraUiRuntimeTradeoffs from "../templates/ui-ux/chakra-ui-runtime-tradeoffs.json" with { type: "json" };
import chakraUiBestPractices from "../templates/ui-ux/chakra-ui-best-practices.json" with { type: "json" };
import reactUiLibraries2025 from "../templates/ui-ux/react-ui-libraries-2025.json" with { type: "json" };
import muiCustomizationSlotStrategy from "../templates/ui-ux/mui-customization-slot-strategy.json" with { type: "json" };
import reactCompositionPlaybook from "../templates/ui-ux/react-composition-playbook.json" with { type: "json" };
import reactCompositionAvoidBooleanProps from "../templates/ui-ux/react-composition-avoid-boolean-props.json" with { type: "json" };
import reactCompositionCompoundComponents from "../templates/ui-ux/react-composition-compound-components.json" with { type: "json" };
import reactCompositionStateInterface from "../templates/ui-ux/react-composition-state-interface.json" with { type: "json" };
import reactCompositionLiftStateProvider from "../templates/ui-ux/react-composition-lift-state-provider.json" with { type: "json" };
import reactCompositionDecoupleStateUi from "../templates/ui-ux/react-composition-decouple-state-ui.json" with { type: "json" };
import reactCompositionChildrenOverRenderProps from "../templates/ui-ux/react-composition-children-over-render-props.json" with { type: "json" };
import reactCompositionExplicitVariants from "../templates/ui-ux/react-composition-explicit-variants.json" with { type: "json" };
import react19ContextAndRefChanges from "../templates/ui-ux/react-19-context-and-ref-changes.json" with { type: "json" };
import reactBestPracticesPlaybook from "../templates/ui-ux/react-best-practices-playbook.json" with { type: "json" };
import reactBestPracticesWaterfalls from "../templates/ui-ux/react-best-practices-waterfalls.json" with { type: "json" };
import reactBestPracticesBundleSize from "../templates/ui-ux/react-best-practices-bundle-size.json" with { type: "json" };
import reactBestPracticesServerPerformance from "../templates/ui-ux/react-best-practices-server-performance.json" with { type: "json" };
import reactBestPracticesClientFetching from "../templates/ui-ux/react-best-practices-client-data-fetching.json" with { type: "json" };
import reactBestPracticesRerender from "../templates/ui-ux/react-best-practices-rerender-optimization.json" with { type: "json" };
import reactBestPracticesRendering from "../templates/ui-ux/react-best-practices-rendering-performance.json" with { type: "json" };
import reactBestPracticesJavaScript from "../templates/ui-ux/react-best-practices-javascript-performance.json" with { type: "json" };
import reactBestPracticesAdvanced from "../templates/ui-ux/react-best-practices-advanced-patterns.json" with { type: "json" };
import reactNativeSkillsPlaybook from "../templates/ui-ux/react-native-skills-playbook.json" with { type: "json" };
import reactNativeCoreRendering from "../templates/ui-ux/react-native-core-rendering.json" with { type: "json" };
import reactNativeListPerformance from "../templates/ui-ux/react-native-list-performance.json" with { type: "json" };
import reactNativeAnimationGesturesScroll from "../templates/ui-ux/react-native-animation-gestures-scroll.json" with { type: "json" };
import reactNativeNavigation from "../templates/ui-ux/react-native-navigation.json" with { type: "json" };
import reactNativeStatePatterns from "../templates/ui-ux/react-native-state-patterns.json" with { type: "json" };
import reactNativeCompilerReanimated from "../templates/ui-ux/react-native-compiler-reanimated.json" with { type: "json" };
import reactNativeUiPatterns from "../templates/ui-ux/react-native-ui-patterns.json" with { type: "json" };
import reactNativeMonorepoImports from "../templates/ui-ux/react-native-monorepo-imports.json" with { type: "json" };
import reactNativeJsFontsIntl from "../templates/ui-ux/react-native-js-fonts-intl.json" with { type: "json" };
import reactViewTransitionsPlaybook from "../templates/ui-ux/react-view-transitions-playbook.json" with { type: "json" };
import reactViewTransitionsFundamentals from "../templates/ui-ux/react-view-transitions-fundamentals.json" with { type: "json" };
import reactViewTransitionsTypesAndStyling from "../templates/ui-ux/react-view-transitions-types-and-styling.json" with { type: "json" };
import reactViewTransitionsSharedElementsAndLists from "../templates/ui-ux/react-view-transitions-shared-elements-and-lists.json" with { type: "json" };
import reactViewTransitionsSuspenseAndLayering from "../templates/ui-ux/react-view-transitions-suspense-and-layering.json" with { type: "json" };
import reactViewTransitionsNextjsIntegration from "../templates/ui-ux/react-view-transitions-nextjs-integration.json" with { type: "json" };
import reactViewTransitionsImplementationWorkflow from "../templates/ui-ux/react-view-transitions-implementation-workflow.json" with { type: "json" };
import reactViewTransitionsCommonMistakes from "../templates/ui-ux/react-view-transitions-common-mistakes.json" with { type: "json" };
import reactViewTransitionsCssRecipes from "../templates/ui-ux/react-view-transitions-css-recipes.json" with { type: "json" };

const raw = [
  nextSupabaseAuth,
  shadcnCard,
  chakraCard,
  materialForm,
  mantineLayout,
  headlessModal,
  serverActionPattern,
  apiRouteCrud,
  supabaseStorage,
  vitestSkeleton,
  aiSdkChat,
  langchainRag,
  mastraAgent,
  openaiFunctions,
  geminiMultimodal,
  expressCrud,
  fastifyPlugin,
  trpcRouter,
  honoMiddleware,
  stripeCheckout,
  supabaseRealtime,
  livekitRoom,
  webhookHandler,
  mastraWorkflowHitl,
  triggerDevJob,
  cronScheduled,
  sqlMigration,

  // UI/UX knowledge pack
  uiUxPlaybook,
  uiUxForPms,
  uiUxMetricsForPms,
  uiUxProcess5Stages,
  uiUxUiVsUx,
  uiUxUiPrinciples7,
  uiUxAestheticUsability,
  uiUxVisualPrinciples12,
  uiUxPrinciples2026,
  uiUxColorTheory,
  frontendDistinctiveUi,
  shadcnUiPlaybook,
  shadcnUiPrinciples,
  shadcnUiBestPractices,
  shadcnUiStructure,
  shadcnUiBlocks,
  shadcnUiEcosystem,
  chakraUiPlaybook,
  chakraUiPrinciples,
  chakraUiVsTailwind,
  chakraUiVsMui,
  chakraUiVsAnt,
  chakraUiVsThemeUi,
  chakraUiRuntimeTradeoffs,
  chakraUiBestPractices,
  reactUiLibraries2025,
  muiCustomizationSlotStrategy,
  reactCompositionPlaybook,
  reactCompositionAvoidBooleanProps,
  reactCompositionCompoundComponents,
  reactCompositionStateInterface,
  reactCompositionLiftStateProvider,
  reactCompositionDecoupleStateUi,
  reactCompositionChildrenOverRenderProps,
  reactCompositionExplicitVariants,
  react19ContextAndRefChanges,
  reactBestPracticesPlaybook,
  reactBestPracticesWaterfalls,
  reactBestPracticesBundleSize,
  reactBestPracticesServerPerformance,
  reactBestPracticesClientFetching,
  reactBestPracticesRerender,
  reactBestPracticesRendering,
  reactBestPracticesJavaScript,
  reactBestPracticesAdvanced,
  reactNativeSkillsPlaybook,
  reactNativeCoreRendering,
  reactNativeListPerformance,
  reactNativeAnimationGesturesScroll,
  reactNativeNavigation,
  reactNativeStatePatterns,
  reactNativeCompilerReanimated,
  reactNativeUiPatterns,
  reactNativeMonorepoImports,
  reactNativeJsFontsIntl,

  // React View Transitions (Vercel Engineering Mar 2026)
  reactViewTransitionsPlaybook,
  reactViewTransitionsFundamentals,
  reactViewTransitionsTypesAndStyling,
  reactViewTransitionsSharedElementsAndLists,
  reactViewTransitionsSuspenseAndLayering,
  reactViewTransitionsNextjsIntegration,
  reactViewTransitionsImplementationWorkflow,
  reactViewTransitionsCommonMistakes,
  reactViewTransitionsCssRecipes,
] as unknown[];

/** Starter templates shipped with the CLI (embedded JSON). */
export const EMBEDDED_ROUTINE_TEMPLATES: RoutineTemplate[] = raw.map((r) =>
  routineTemplateSchema.parse(r)
);

export function getEmbeddedTemplateById(id: string): RoutineTemplate | undefined {
  return EMBEDDED_ROUTINE_TEMPLATES.find((t) => t.id === id);
}
