import { Navbar } from "@/components/landing/navbar";
import { MathBlock } from "@/components/landing/math-block";
import { CodeBlock } from "@/components/landing/code-block";
import { Footer } from "@/components/landing/footer";
import { InstallCommand } from "@/components/landing/install-command";
import {
  ArrowRight,
  Zap,
  Shield,
  Cpu,
  Layers,
  BarChart3,
  Clock,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pi APIs — Infrastructure Intelligence",
  description:
    "The full potential of Pi. See how one TypeScript SDK replaces months of engineering across health, robotics, surveillance, voice AI, image intelligence, and brand campaigns.",
};

/* ─────────────────────────────────────────────
   Before / After hero
   ───────────────────────────────────────────── */

const CODE_WITHOUT = `import { createPiClient } from '@pi-api/sdk'

// Without Pi: you're not calling one API.
// You're building an entire ML platform.

async function analyzePatientScan(scanUrl: string) {
  // Step 1: Provision GPU, install MONAI + PyTorch (2 hours)
  const vm = await provisionInstance({ gpu: 'A100', region: 'us-east' })
  await ssh(vm, 'pip install monai torch torchvision pydicom...')

  // Step 2: Download + preprocess DICOM files
  await ssh(vm, \`python preprocess.py --input \${scanUrl}\`)

  // Step 3: Run inference (hope the model version matches)
  const raw = await ssh(vm, 'python infer.py --model lung-nodule-v7')

  // Step 4: Parse unstructured output into something usable
  let findings
  try {
    findings = JSON.parse(raw.stdout)
  } catch {
    findings = { error: 'Model output parsing failed. Again.' }
  }

  // Step 5: Clean up (or forget and pay $$$)
  await destroyInstance(vm)
  return findings
}`;

const CODE_WITH = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

const job = await pi.health.scanAnalysis({
  input: {
    type: 'medical_scan',
    data: 'https://storage.hospital.com/patient-1042/lung-ct.dcm',
    modality: 'ct_scan',
    clinical_question: 'Detect lung nodules and assess malignancy risk',
  },
  output: { format: 'json' },
})

const result = await pi.jobs.waitForCompletion(job.data.job_id)

console.log(result.data.findings)
// [{ region: "RUL", description: "5mm ground-glass nodule",
//    severity: "low", confidence: 0.91 }]
console.log(result.data.urgency)       // "routine"
console.log(result.data.recommended_followup)
// "Recommend follow-up CT in 6 months per Lung-RADS 2"`;

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-section px-6 pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-prose text-center">
          <div className="mb-6 text-muted-foreground/30">
            <MathBlock
              expression="\Delta S = \int \frac{dQ}{T}"
              display
            />
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Pi APIs
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            One TypeScript SDK. Every agent domain.
            <br />
            The problems below are real. The solutions are one import away.
          </p>
          <div className="flex justify-center">
            <InstallCommand command="install @pi-api/sdk" />
          </div>
        </div>
      </div>

      {/* Before / After */}
      <div className="relative mx-auto max-w-section px-6 pb-20 md:pb-28">
        <div className="mx-auto max-w-prose mb-12">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            This is what building health AI looks like today
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Provisioning GPUs. Installing ML frameworks. Preprocessing DICOM
            files. Running inference. Parsing unstructured output.
            Cleaning up compute. Every single patient scan.
          </p>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Your team spends 80% of its time on infrastructure and 20% on
            the actual clinical problem. Pi flips that ratio.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-destructive/80">
              Without Pi — the infrastructure tax
            </p>
            <CodeBlock
              code={CODE_WITHOUT}
              filename="scan-manual.ts"
              language="typescript"
            />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-accent">
              With Pi — structured clinical output, one call
            </p>
            <CodeBlock
              code={CODE_WITH}
              filename="scan-with-pi.ts"
              language="typescript"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Domain sections — problem-first
   ───────────────────────────────────────────── */

interface DomainSectionProps {
  id: string;
  mathExpression: string;
  painHeadline: string;
  painDescription: string;
  solution: string;
  examples: Array<{
    code: string;
    filename: string;
    codeContext: string;
    title?: string;
  }>;
  reversed?: boolean;
}

function DomainSection({
  id,
  mathExpression,
  painHeadline,
  painDescription,
  solution,
  examples,
  reversed,
}: DomainSectionProps) {
  return (
    <section id={id} className="border-t border-border/50">
      <div className="mx-auto max-w-section px-6 py-20 md:py-24">
        <div className="mb-4 text-muted-foreground/20">
          <MathBlock expression={mathExpression} display />
        </div>

        <div
          className={`grid gap-12 lg:grid-cols-2 lg:items-start ${
            reversed ? "lg:[direction:rtl] lg:[&>*]:[direction:ltr]" : ""
          }`}
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {painHeadline}
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              {painDescription}
            </p>
            <p className="mt-4 text-foreground/90 font-medium leading-relaxed">
              {solution}
            </p>
          </div>

          <div className="space-y-6">
            {examples.map((example) => (
              <div key={example.filename + example.codeContext}>
                {example.title ? (
                  <p className="mb-2 text-sm font-medium text-foreground/90">
                    {example.title}
                  </p>
                ) : null}
                <p className="mb-3 text-sm text-muted-foreground">
                  {example.codeContext}
                </p>
                <CodeBlock
                  code={example.code}
                  filename={example.filename}
                  language="typescript"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Domain code examples — real SDK calls
   ───────────────────────────────────────────── */

const HEALTH_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// Triage a chest X-ray — returns structured clinical output
const job = await pi.health.analyze({
  input: {
    type: 'image',
    data: 'https://storage.hospital.com/chest-xray.dcm',
    modality: 'xray',
  },
  context: { patient_age: 62, history: 'chronic cough, smoker' },
  output: { format: 'json', include_diagnostics: true },
})

const result = await pi.jobs.waitForCompletion(job.data.job_id)

console.log(result.data.triage_level)   // "urgent"
console.log(result.data.confidence)     // 0.89
console.log(result.data.findings)
// [{ title: "Right lower lobe opacity",
//    summary: "Consolidation suggestive of pneumonia",
//    confidence: 0.91 }]
console.log(result.data.treatment_plan)
// "Initiate empiric antibiotics, confirm with CT..."
console.log(result.data.red_flags)
// ["Pleural effusion noted — consider thoracentesis"]`;

const VOICE_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// Define a voice AI agent for patient intake calls
const agent = await pi.voice.agents.create({
  name: 'patient-intake-v1',
  language: 'en-US',
  instructions: \`You are a medical intake specialist for City Health Clinic.
    Collect patient symptoms, medical history, and insurance info.
    Be empathetic. Ask follow-up questions when symptoms are vague.\`,
  questions: [
    { key: 'chief_complaint', ask: 'What brings you in today?', type: 'text' },
    { key: 'severity', ask: 'On a scale of 1-10, how severe?', type: 'number', min: 1, max: 10 },
    { key: 'duration', ask: 'How long have you had these symptoms?', type: 'text' },
    { key: 'insurance', ask: 'What insurance provider do you have?', type: 'text' },
  ],
  behaviors: {
    tone: 'empathetic',
    max_duration_seconds: 600,
    allow_interruptions: true,
    require_all_questions: true,
    closing_message: 'Thank you. A nurse will review your intake shortly.',
  },
  voice: { name: 'Aoede', language_code: 'en-US' },
  output_schema: {
    chief_complaint: 'text',
    severity: 'number',
    duration: 'text',
    insurance: 'text',
    triage_notes: 'text',
  },
})

// Start a real-time voice session — returns LiveKit + Gemini Live tokens
const session = await pi.voice.sessions.create({
  agent_id: agent.data.id,
  participant: { identity: 'patient-jane-doe', name: 'Jane Doe' },
  ttl_seconds: 900,
})

// Connect your client to LiveKit for real-time WebRTC audio
console.log(session.data.connection.livekit.url)
// "wss://pi-voice.livekit.cloud/..."
console.log(session.data.connection.livekit.token)
// "eyJ..." — connect with livekit-client SDK`;

const SURVEILLANCE_POLICY_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 1) Define detection policies
await pi.surveillance.policies.upsert({
  name: 'Loading Dock Loitering',
  type: 'loitering',
  condition: { zone: 'loading-dock', duration_seconds: 120 },
  action: { severity: 'warning', cooldown_seconds: 60 },
})

await pi.surveillance.policies.upsert({
  name: 'Restricted Area Intrusion',
  type: 'intrusion',
  condition: { zone: 'server-room' },
  action: { severity: 'critical', cooldown_seconds: 30 },
})`;

const SURVEILLANCE_STREAM_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 2) Analyze camera feed with behavior detection
const job = await pi.surveillance.streams.create({
  source: { url: 'rtsp://cameras.site.com/cam-north', type: 'rtsp' },
  detect: ['person', 'vehicle', 'package'],
  behaviors: [
    { type: 'loitering', zone: 'loading-dock', seconds: 120 },
    { type: 'intrusion', zone: 'server-room' },
    { type: 'object_left', zone: 'lobby', seconds: 300 },
  ],
  profile: 'warehouse_safety',
  outputs: {
    delivery: ['sse', 'webhook'],
    webhook_url: 'https://ops.co/alerts',
  },
  input: { data: frameBase64 },
})

console.log(job.data.job_id) // stream/job id
`;

const SURVEILLANCE_EVENTS_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 3) Stream incidents in real-time via SSE
const events = pi.surveillance.events({ stream_id: 'stream_or_job_id_here' })

for await (const event of events) {
  console.log(event.type)       // "loitering" | "intrusion" | ...
  console.log(event.severity)   // "warning" | "critical"
  console.log(event.narration)  // AI incident summary
}`;

const IMAGE_BRAND_EXTRACT_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 1) Extract brand identity
const brandJob = await pi.brands.extract({
  url: 'https://acme-corp.com',
  location: { country: 'US', languages: ['en'] },
})

const brand = await pi.jobs.waitForCompletion(brandJob.data.job_id)
const brandId = brand.data.job_result?.brand?.id
`;

const IMAGE_GENERATE_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 2) Generate brand-consistent creative (not one-shot)
const imageJob = await pi.images.generate({
  prompt:
    'Summer sale hero banner for wireless earbuds, lifestyle shot, warm lighting',
  brand_id: 'brand_uuid_here',
  reference_images: ['https://cdn.acme.com/product-shots/earbuds-v3.jpg'],
  output: { aspect_ratio: '16:9', resolution: '2K' },
})

const result = await pi.jobs.waitForCompletion(imageJob.data.job_id)
console.log(result.data.ad?.image_url)
// "https://cdn.pi.ai/gen/ad_8f3k2..."
`;

const IMAGE_LOCALIZE_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 3) Localize same creative for another market
const localizedJob = await pi.campaigns.localizeAd({
  prompt: 'Adapt for Japan market — cherry blossom season theme',
  brand_id: 'brand_uuid_here',
  reference_images: ['https://cdn.pi.ai/gen/ad_8f3k2...'],
  output: { aspect_ratio: '1:1' },
})

const localizedResult = await pi.jobs.waitForCompletion(localizedJob.data.job_id)
console.log(localizedResult.data.ad?.image_url)`;

const ROBOTICS_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// Define patrol zones
await pi.robots.zones.upsert({
  zones: [
    { name: 'Aisle A', type: 'patrol', polygon: [[0,0],[10,0],[10,5],[0,5]] },
    { name: 'Loading Dock', type: 'patrol', polygon: [[10,0],[20,0],[20,8],[10,8]] },
    { name: 'Hazmat Storage', type: 'restricted', polygon: [[20,0],[25,0],[25,5],[20,5]] },
  ],
})

// Run a patrol mission with behavior rules and action triggers
const job = await pi.robots.run({
  robot_id: 'scout-07',
  task: 'patrol',
  profile: 'warehouse_inspector',
  behaviors: [
    { type: 'patrol', waypoints: ['Aisle A', 'Loading Dock'], loop: true, dwell_seconds: 30 },
    { type: 'approach_on_incident', incident_type: 'intrusion', zone: 'Hazmat Storage' },
  ],
  actions: [
    { on: 'intrusion', do: [
      { type: 'alert', severity: 'critical' },
      { type: 'command', command: { command: 'record_start' } },
      { type: 'webhook', url: 'https://ops.co/robot-alerts', method: 'POST' },
    ]},
  ],
  perception: { detect: ['person', 'forklift', 'spill'] },
  outputs: { delivery: ['sse'] },
})

// Stream real-time robot events
const events = pi.robots.events()
for await (const event of events) {
  if (event.type === 'incident') console.log(event.incident)
  if (event.type === 'state') console.log(event.state?.position)
}`;

const CAMPAIGNS_EXTRACT_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 1) Extract brand DNA from website + logo
const brandJob = await pi.brands.extract({
  url: 'https://luxe-skincare.com',
  logoBase64: logoFileBase64,
  location: { country: 'FR', languages: ['fr', 'en'] },
})
const brand = await pi.jobs.waitForCompletion(brandJob.data.job_id)
const brandId = brand.data.job_result?.brand?.id!
`;

const CAMPAIGNS_PROJECT_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 2) Project brand identity for a specific channel/use-case
const projection = await pi.brands.project('brand_uuid_here', {
  use_case: 'instagram_story_ad',
})
console.log(projection.data.payload)
// { color_palette: [...], typography: {...}, tone_of_voice: "elegant" }
`;

const CAMPAIGNS_GENERATE_EDIT_CODE = `import { createPiClient } from '@pi-api/sdk'

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.pi.ai',
})

// 3) Generate then refine campaign creative
const campaignJob = await pi.campaigns.generate({
  prompt: 'New anti-aging serum launch — target: women 35-55, ' +
    'premium feel, before/after subtle transformation',
  brand_id: 'brand_uuid_here',
  output: { aspect_ratio: '9:16', resolution: '2K', thinking_intensity: 'high' },
})
const result = await pi.jobs.waitForCompletion(campaignJob.data.job_id)

// Edit the creative with targeted revisions
const editJob = await pi.campaigns.edit({
  prompt: 'Make the lighting warmer and add the tagline "Age is just a number"',
  brand_id: 'brand_uuid_here',
  reference_images: [result.data.ad!.image_url],
})

const editResult = await pi.jobs.waitForCompletion(editJob.data.job_id)
console.log(editResult.data.ad?.image_url)`;

/* ─────────────────────────────────────────────
   Capabilities grid
   ───────────────────────────────────────────── */

function CapabilitiesSection() {
  return (
    <section className="border-t border-border/50">
      <div className="mx-auto max-w-section px-6 py-20 md:py-28">
        <div className="mx-auto max-w-prose text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Under the hood
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every domain above runs on the same core infrastructure pattern.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Durable Jobs (202 + Polling)",
              desc: "Every long-running operation returns a job_id. Poll with pi.jobs.retrieve() or use pi.jobs.waitForCompletion() — Pi handles retries, timeouts, and state.",
            },
            {
              icon: Zap,
              title: "Real-time SSE Streaming",
              desc: "Surveillance events, robot state changes, and incident alerts stream in real-time via Server-Sent Events. Subscribe with async iterators.",
            },
            {
              icon: Shield,
              title: "Zod-validated Contracts",
              desc: "Every request and response is validated with Zod schemas. Type-safe inputs, structured outputs, zero guesswork.",
            },
            {
              icon: Cpu,
              title: "Multi-step Orchestration",
              desc: "Image generation runs corpus retrieval, creative planning, policy validation, multimodal evaluation, and targeted revision — not one model call.",
            },
            {
              icon: Layers,
              title: "Declarative Policies",
              desc: "Surveillance behaviors, robot actions, brand constraints — all defined declaratively. Pi evaluates them at runtime.",
            },
            {
              icon: BarChart3,
              title: "Structured Output",
              desc: "Every endpoint returns typed results. Health findings with confidence scores. Surveillance incidents with narration. Robot events with state.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
            >
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <h4 className="text-sm font-semibold">{title}</h4>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Bottom CTA
   ───────────────────────────────────────────── */

function BottomCTA() {
  return (
    <section className="border-t border-border/50">
      <div className="mx-auto max-w-section px-6 py-20 md:py-28">
        <div className="rounded-2xl border border-border/50 bg-card p-10 text-center md:p-16">
          <div className="mb-6 text-muted-foreground/15">
            <MathBlock
              expression="e^{i\pi} + 1 = 0"
              display
              className="text-2xl"
            />
          </div>
          <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
            Stop building infrastructure. Start shipping intelligence.
          </h3>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            One SDK. Typed inputs. Structured outputs. Every domain.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="https://piii.mintlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Read Documentation <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="mailto:nchrisdonson@gmail.com"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-8 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */

export default function ApisPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />

        <DomainSection
          id="health"
          mathExpression="\frac{\partial u}{\partial t} = D \nabla^2 u"
          painHeadline="Your health AI is a fragile chain of model calls with no clinical structure."
          painDescription="Building health AI means reading hundreds of ML papers, training models on expensive GPUs, navigating regulatory requirements, and still ending up with unstructured output your clinicians can't use. Most health startups spend 18 months on infrastructure before a single clinical result."
          solution="Pi has 9 specialized health endpoints — triage, scan analysis, medication checks, decision support, risk priority, research assist, wellness, adherence, and clinical notes structuring. Each returns typed clinical output with confidence scores, findings, treatment plans, and red flags."
          examples={[
            {
              code: HEALTH_CODE,
              filename: "health-triage.ts",
              codeContext:
                "Triage a chest X-ray. Pi routes to the right workflow and returns structured clinical findings.",
            },
          ]}
        />

        <DomainSection
          id="voice"
          mathExpression="\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) e^{-2\pi i x \xi} \, dx"
          painHeadline="Building a real-time voice AI agent means stitching STT + LLM + TTS and fighting latency."
          painDescription="A production voice agent requires speech-to-text, a language model for reasoning, text-to-speech for responses, tool integration for actions, and sub-300ms latency. Each component has its own API, failure modes, and scaling profile. Most teams spend months on integration before the agent can hold a basic conversation — and it still drops calls."
          solution="Pi provisions a LiveKit room + Gemini Live session in one call. Define the agent persona, questions to collect, behavioral rules, and voice. Pi returns WebRTC connection tokens for instant real-time conversation. After the call, submit the transcript and Pi extracts structured data matching your output schema."
          examples={[
            {
              code: VOICE_CODE,
              filename: "voice-agent-call.ts",
              codeContext:
                "Create a voice AI agent call flow and get LiveKit + Gemini Live tokens for real-time WebRTC sessions.",
            },
          ]}
          reversed
        />

        <DomainSection
          id="surveillance"
          mathExpression="P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}"
          painHeadline="Your 200 cameras produce 10TB/day of footage that nobody watches."
          painDescription="Enterprise surveillance generates massive data no team can review. Building real-time anomaly detection means deploying ML models on edge devices, handling video streams, managing alerting logic, and dealing with false positive rates that make security teams ignore everything. Each new behavior rule requires re-training a model."
          solution="Pi runs perception workflows with policy evaluation and real-time SSE event streaming. Define behavior rules declaratively — loitering, intrusion, crowd growth, abandoned objects, perimeter breach, speed violations. Pi detects, tracks, evaluates policies, and streams incidents with AI-generated narration."
          examples={[
            {
              title: "Use Case 1 — Policy Setup",
              code: SURVEILLANCE_POLICY_CODE,
              filename: "surveillance-policy.ts",
              codeContext:
                "Define what counts as risk (loitering, intrusion, severity, cooldown) with declarative policies.",
            },
            {
              title: "Use Case 2 — Stream Analysis",
              code: SURVEILLANCE_STREAM_CODE,
              filename: "surveillance-stream.ts",
              codeContext:
                "Run perception + behavior detection on incoming camera frames with one API call.",
            },
            {
              title: "Use Case 3 — Real-time Incident Feed",
              code: SURVEILLANCE_EVENTS_CODE,
              filename: "surveillance-events.ts",
              codeContext:
                "Subscribe to live incident events over SSE for ops dashboards and alerting pipelines.",
            },
          ]}
        />

        <DomainSection
          id="image"
          mathExpression="\mathcal{L} = \mathbb{E}[\|x - G(z)\|^2]"
          painHeadline="Other image APIs give you one shot — one prompt, one output, hope it's right."
          painDescription="Generating a single image is easy. Generating a brand-consistent campaign image that respects brand guidelines, cultural context, copy placement, and quality standards? That takes a creative team, weeks of iteration, and still requires manual QA. No existing API gives you intelligence — they give you pixels."
          solution="Pi's image pipeline is not one model call. It runs corpus retrieval, creative planning, brand policy validation, generation, multimodal quality evaluation, and targeted revision. You send a prompt and a brand_id — Pi returns an image that's on-brand, on-message, and production-ready."
          examples={[
            {
              title: "Use Case 1 — Extract Brand Identity",
              code: IMAGE_BRAND_EXTRACT_CODE,
              filename: "image-brand-extract.ts",
              codeContext:
                "Turn a website into a reusable brand profile your image generation can follow.",
            },
            {
              title: "Use Case 2 — Generate Brand-Consistent Creative",
              code: IMAGE_GENERATE_CODE,
              filename: "image-generate.ts",
              codeContext:
                "Generate campaign assets with Pi's multi-step intelligence pipeline, not one-shot output.",
            },
            {
              title: "Use Case 3 — Localize for New Market",
              code: IMAGE_LOCALIZE_CODE,
              filename: "image-localize.ts",
              codeContext:
                "Adapt existing creative for another language/culture while keeping brand consistency.",
            },
          ]}
          reversed
        />

        <DomainSection
          id="robotics"
          mathExpression="\mathbf{F} = m\mathbf{a}"
          painHeadline="You hired 3 robotics engineers and a DevOps team just to run one warehouse patrol."
          painDescription="Deploying a robot agent means provisioning edge compute, configuring ROS2 bridges, deploying perception and navigation models, defining patrol routes, building a monitoring dashboard, and handling failovers. Your actual business logic — 'patrol the warehouse' — is 5% of the work."
          solution="Pi abstracts the full stack. Define zones as polygons, behaviors as rules, actions as triggers. Pi handles perception, navigation, incident detection, and streams real-time robot state via SSE. One API for patrol, inspection, approach-on-incident, and recording."
          examples={[
            {
              code: ROBOTICS_CODE,
              filename: "robotics-patrol.ts",
              codeContext:
                "Define zones, behaviors, and action triggers; then run missions and stream robot events.",
            },
          ]}
        />

        <DomainSection
          id="campaigns"
          mathExpression="\nabla_\theta J(\theta) = \mathbb{E}\left[\nabla_\theta \log \pi_\theta(a|s) \cdot R\right]"
          painHeadline="Generating brand-consistent campaign assets across markets means weeks of back-and-forth with designers."
          painDescription="Every new campaign requires extracting brand guidelines, briefing a creative team, iterating on concepts, adapting for different markets and cultures, and ensuring every asset stays on-brand. Multiply by 12 markets and 4 platforms — you're looking at months of work and six-figure agency bills."
          solution="Pi extracts brand DNA from a URL or logo, projects it for specific use cases, generates campaign creatives with multi-step orchestration (corpus retrieval, creative planning, quality gates), and localizes across markets. Edit with targeted revision prompts. All via API."
          examples={[
            {
              title: "Use Case 1 — Extract Brand DNA",
              code: CAMPAIGNS_EXTRACT_CODE,
              filename: "campaign-brand-extract.ts",
              codeContext:
                "Extract brand structure once, then reuse it across all campaign pipelines.",
            },
            {
              title: "Use Case 2 — Project Brand by Channel",
              code: CAMPAIGNS_PROJECT_CODE,
              filename: "campaign-brand-project.ts",
              codeContext:
                "Project brand identity for a specific use-case like Instagram story, hero banner, or ad variation.",
            },
            {
              title: "Use Case 3 — Generate + Edit Campaign Creative",
              code: CAMPAIGNS_GENERATE_EDIT_CODE,
              filename: "campaign-generate-edit.ts",
              codeContext:
                "Generate campaign assets, then iterate with targeted edits while keeping brand fidelity.",
            },
          ]}
          reversed
        />

        <CapabilitiesSection />
        <BottomCTA />
      </main>
      <Footer />
    </>
  );
}
