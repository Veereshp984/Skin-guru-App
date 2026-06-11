import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";

const tips = [
  {
    icon: "🔍",
    title: "Check monthly",
    desc: "Examine your skin once a month in good lighting, including hard-to-see areas.",
  },
  {
    icon: "📏",
    title: "Remember ABCDE",
    desc: "Asymmetry, Border, Colour, Diameter, Evolution — the five warning signs of melanoma.",
  },
  {
    icon: "☀️",
    title: "Sun protection",
    desc: "Use SPF 30+ sunscreen daily, wear protective clothing, and avoid peak-sun hours.",
  },
  {
    icon: "👨‍⚕️",
    title: "Consult a doctor",
    desc: "SkinGuru AI provides a screening aid — always follow up suspicious findings with a clinician.",
  },
];

const CONDITION_FACTS = [
  { code: "MEL", name: "Melanoma", risk: "High", color: "bg-blush/15 text-blush" },
  { code: "BCC", name: "Basal Cell", risk: "Moderate", color: "bg-lime/20 text-forest" },
  { code: "AK", name: "Actinic Keratosis", risk: "Pre-cancerous", color: "bg-mint/40 text-forest" },
  { code: "DF", name: "Dermatofibroma", risk: "Benign", color: "bg-foam text-sage" },
];

function DashCard({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-sage">{desc}</p>
    </div>
  );
}

export function PatientDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[10rem] h-80 w-80 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-[-4rem] right-[-3rem] h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mx-auto mt-6 max-w-5xl">
          {/* Welcome hero */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sage">Patient Dashboard</p>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  Welcome, {user?.full_name?.split(" ")[0]} 👋
                </h1>
                <p className="mt-3 max-w-lg text-base leading-7 text-ink/68">
                  Your personal skin health workspace. Upload a photo to get an AI-powered screening in seconds.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  to="/app"
                  id="patient-new-scan-btn"
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  🔬 Start new scan
                </Link>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "Role", value: "Patient" },
                { label: "Account", value: user?.provider === "google" ? "Google" : "Email" },
                { label: "Status", value: "Active" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-foam px-4 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-sage">{s.label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skin health tips */}
          <section className="mt-6">
            <h2 className="mb-4 text-sm uppercase tracking-[0.3em] text-sage">Skin health guidelines</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tips.map((t) => (
                <DashCard key={t.title} {...t} />
              ))}
            </div>
          </section>

          {/* Condition reference */}
          <section className="mt-6">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
              <h2 className="text-base font-semibold">Skin Condition Reference</h2>
              <p className="mt-1 text-sm text-sage">Common skin conditions the AI model can identify.</p>
              <div className="mt-4 space-y-3">
                {CONDITION_FACTS.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between rounded-xl bg-foam px-4 py-3"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-sage">{c.code}</span>
                      <span className="ml-3 text-sm font-medium text-ink">{c.name}</span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.color}`}>{c.risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-forest/20 bg-forest/5 p-8 text-center">
            <p className="text-sm text-sage">Ready to check a skin area?</p>
            <Link
              to="/app"
              className="rounded-full bg-forest px-8 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Go to Scanner →
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
