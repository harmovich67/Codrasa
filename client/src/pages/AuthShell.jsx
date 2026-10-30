import { Code, Flame, Sparkles } from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { Illustration } from '../components/HeroBanner.jsx';

const FEATURES = [
  { icon: Code, title: 'دروس حيّة مش فيديو', text: 'أوقف الدرس في أي لحظة، عدّل الكود وشغّله بنفسك.' },
  { icon: Flame, title: 'خريطة التوهان', text: 'المدرّس بيعرف بالظبط فين الطلاب وقفوا واتلخبطوا.' },
  { icon: Sparkles, title: 'مساعد Gemini', text: 'مساعد شايف الكود اللي قدامك في نفس اللحظة.' },
];

export default function AuthShell({ name, title, subtitle, children }) {
  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:py-12">
        <div className="w-full max-w-md">
          {/* phone / tablet: a small scene above the card (the desktop one lives in the side panel) */}
          <div className="mx-auto mb-3 aspect-[480/270] w-44 sm:w-56 lg:hidden">
            <Illustration />
          </div>
          <div className="rounded-3xl border border-white/80 bg-panel/90 p-5 shadow-float backdrop-blur sm:p-8">
            <div className="flex flex-col items-center text-center">
              <Logo name={name} />
              <h1 className="mt-5 text-2xl font-bold sm:mt-6">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            </div>
            <div className="mt-5 sm:mt-6">{children}</div>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-r border-line bg-gradient-to-br from-[#f3f1ff] to-[#e3e7ff] lg:flex lg:items-center lg:justify-center">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 size-80 rounded-full bg-mint/10 blur-3xl" />
        <div className="relative max-w-md space-y-6 p-10">
          <Illustration />
          <pre dir="ltr" className="rounded-2xl border border-slate-800 bg-[#0b1018] p-5 text-left font-mono text-sm leading-7 text-slate-300 shadow-float">
            <span className="text-violet-400">const</span> lesson = <span className="text-emerald-400">record</span>(editor);{'\n'}
            lesson.<span className="text-amber-300">pause</span>();{'  '}<span className="text-slate-500">// ✋ your turn</span>{'\n'}
            student.<span className="text-emerald-400">edit</span>().<span className="text-emerald-400">run</span>();
          </pre>
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="h-fit rounded-xl bg-brand/15 p-2.5 text-brand">
                <f.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-0.5 text-sm text-muted">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
