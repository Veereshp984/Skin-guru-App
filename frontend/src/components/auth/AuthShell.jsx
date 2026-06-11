import { BrandMark } from "../icons/AppIcons";

export function AuthShell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-mist px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="flex flex-col justify-between rounded-lg border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-forest shadow-halo">
                <BrandMark />
              </div>
              <p className="mt-8 text-xs uppercase tracking-[0.32em] text-sage">{eyebrow}</p>
              <h1 className="mt-3 max-w-xl font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-ink/68">{subtitle}</p>
            </div>
            <div className="mt-10 grid gap-3 text-sm text-ink/70 sm:grid-cols-3">
              <span className="rounded-lg bg-foam px-4 py-3">AI Skin Screening</span>
              <span className="rounded-lg bg-foam px-4 py-3">Personalized Care</span>
              <span className="rounded-lg bg-foam px-4 py-3">Secure Records</span>
            </div>
          </section>
          <section className="rounded-lg border border-white/70 bg-paper p-5 shadow-soft sm:p-8">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
