import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";

const CLINICAL_FEATURES = [
  {
    icon: "🩺",
    title: "Clinical Prediction Tool",
    desc: "Run AI-based differential screening on dermoscopy images and review ranked probability outputs for 7 skin condition categories.",
  },
  {
    icon: "📊",
    title: "Ensemble Model",
    desc: "The platform uses an ANN + CNN ensemble that averages probabilities for improved prediction confidence and robustness.",
  },
  {
    icon: "📄",
    title: "PDF Reporting",
    desc: "Download a structured PDF report per scan including top prediction, confidence score, and full probability breakdown.",
  },
  {
    icon: "🔒",
    title: "Role-Gated Access",
    desc: "Doctor-level access is protected by JWT RBAC. Your credentials are verified on every API request.",
  },
];

const CLASSIFICATION_GUIDE = [
  { code: "akiec", label: "Actinic Keratosis / Intraepithelial Carcinoma", note: "Pre-malignant – refer promptly" },
  { code: "bcc", label: "Basal Cell Carcinoma", note: "Most common – surgical excision recommended" },
  { code: "bkl", label: "Benign Keratosis-like Lesions", note: "Generally benign – monitor for change" },
  { code: "df", label: "Dermatofibroma", note: "Benign fibrous lesion – usually no treatment" },
  { code: "mel", label: "Melanoma", note: "High malignancy – urgent specialist referral" },
  { code: "nv", label: "Melanocytic Nevi", note: "Common mole – monitor for ABCDE changes" },
  { code: "vasc", label: "Vascular Lesions", note: "Variable – includes angiomas and haemorrhages" },
];

export function DoctorDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-32 h-80 w-80 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-mint/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mx-auto mt-6 max-w-5xl">
          {/* Welcome hero */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sage">Clinical Dashboard</p>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  Welcome, Dr. {user?.full_name?.split(" ")[0]} 👨‍⚕️
                </h1>
                <p className="mt-3 max-w-lg text-base leading-7 text-ink/68">
                  Your clinical AI workspace. Run skin lesion screenings, review differential probabilities, and download structured reports.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  to="/app"
                  id="doctor-new-scan-btn"
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                >
                  🔬 Run scan
                </Link>
              </div>
            </div>

            {/* Credential chips */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "Role", value: "Doctor" },
                { label: "Access Level", value: "Clinical" },
                { label: "Model", value: "Ensemble (ANN + CNN)" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-foam px-4 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-sage">{s.label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical features */}
          <section className="mt-6">
            <h2 className="mb-4 text-sm uppercase tracking-[0.3em] text-sage">Workspace features</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {CLINICAL_FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5"
                >
                  <div className="mb-3 text-2xl">{f.icon}</div>
                  <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-sage">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Classification reference */}
          <section className="mt-6">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
              <h2 className="text-base font-semibold">HAM10000 Classification Reference</h2>
              <p className="mt-1 text-sm text-sage">
                The AI model is trained on 7 categories from the HAM10000 dermoscopy dataset.
              </p>
              <div className="mt-4 divide-y divide-line">
                {CLASSIFICATION_GUIDE.map((c) => (
                  <div key={c.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase text-sage">{c.code}</span>
                      <span className="ml-3 text-sm text-ink">{c.label}</span>
                    </div>
                    <span className="text-xs text-sage sm:text-right">{c.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="mt-6 rounded-2xl border border-line bg-sand/60 px-6 py-4 text-sm text-sage">
            <strong className="text-ink">Clinical reminder:</strong> This tool is an AI decision-support aid only. All predictions must be interpreted in the context of clinical history, physical examination, and professional medical judgement. Do not use as a sole diagnostic tool.
          </div>
        </main>
      </div>
    </div>
  );
}
