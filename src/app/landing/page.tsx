import Link from 'next/link';
import {
  Brain, BookOpen, Users, BarChart3, Zap, CheckCircle2, Star,
  GraduationCap, MessageSquare, Globe, ArrowRight, Sparkles, Shield
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: Brain,
      color: 'text-violet-400',
      bg: 'bg-violet-400/10',
      title: 'AI-Powered Learning',
      desc: 'Gemini AI auto-generates translations, phonetics, and contextual examples for every word.'
    },
    {
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      title: 'Spaced Repetition (SRS)',
      desc: 'Scientific SM-2 algorithm schedules reviews at the exact moment before forgetting.'
    },
    {
      icon: GraduationCap,
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
      title: 'Classroom Management',
      desc: 'Teachers assign vocabulary & grammar, track every student\'s progress in real-time.'
    },
    {
      icon: BarChart3,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      title: 'Detailed Analytics',
      desc: 'See which words students struggle with, quiz scores, and weekly learning streaks.'
    },
    {
      icon: MessageSquare,
      color: 'text-rose-400',
      bg: 'bg-rose-400/10',
      title: 'Grammar Exercises',
      desc: 'AI-generated grammar drills: fill in the blank, error correction, and multiple choice.'
    },
    {
      icon: Globe,
      color: 'text-teal-400',
      bg: 'bg-teal-400/10',
      title: 'Chrome Extension',
      desc: 'Capture any word from any website with one click — it gets analyzed and saved instantly.'
    },
  ];

  const plans = [
    {
      name: 'Free',
      price: '0₫',
      period: 'forever',
      color: 'border-white/10',
      features: ['1 classroom', '30 students', '200 words', 'Flashcard & Quiz', 'Basic analytics'],
      cta: 'Start Free',
      ctaStyle: 'bg-white/10 hover:bg-white/20 text-white',
    },
    {
      name: 'Pro',
      price: '99,000₫',
      period: '/month',
      color: 'border-primary/50 bg-primary/5',
      popular: true,
      features: ['Unlimited classrooms', 'Unlimited students', 'Unlimited words', 'AI grammar module', 'PDF reports', 'Telegram notifications'],
      cta: 'Start Pro',
      ctaStyle: 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30',
    },
    {
      name: 'School',
      price: '499,000₫',
      period: '/month',
      color: 'border-white/10',
      features: ['Multiple teachers', 'School dashboard', 'Custom branding', 'API access', 'Priority support', 'Onboarding call'],
      cta: 'Contact Us',
      ctaStyle: 'bg-white/10 hover:bg-white/20 text-white',
    },
  ];

  const testimonials = [
    { name: 'Nguyễn Linh', role: 'English Tutor, HCM', text: 'LingoPro giúp tôi tiết kiệm 3 tiếng mỗi tuần. Học sinh học hiệu quả gấp đôi nhờ thuật toán ôn tập theo khoa học.', stars: 5 },
    { name: 'Trần Minh', role: 'IELTS Student', text: 'Tôi học được 500 từ trong 1 tháng. App nhắc ôn đúng lúc, không bao giờ quên từ nữa. Điểm IELTS từ 6.0 lên 7.5.', stars: 5 },
    { name: 'Ms. Phương', role: 'School Teacher, Hà Nội', text: 'Dashboard thầy cô rất trực quan. Tôi biết ngay học sinh nào cần giúp thêm mà không cần hỏi từng em.', stars: 5 },
  ];

  return (
    <div className="min-h-screen bg-[#070711] text-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#070711]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg">
            <div className="bg-primary/20 p-1.5 rounded-lg border border-primary/30">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            LingoPro
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2">Sign In</Link>
            <Link href="/auth" className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary/20">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-36 px-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Google Gemini AI
          </div>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-tight mb-6">
            The Smarter Way<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-purple-400">
              to Learn English
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            LingoPro combines AI-powered vocabulary analysis, spaced repetition science, and real-time teacher-student management into one elegant platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth" className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-2xl shadow-primary/20 flex items-center justify-center gap-2 group">
              Start for Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/auth" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all flex items-center justify-center gap-2">
              <GraduationCap className="h-5 w-5" />
              I&apos;m a Teacher
            </Link>
          </div>
          <p className="text-slate-500 text-sm mt-6 flex items-center justify-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            No credit card required · Free forever plan available
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[['10,000+', 'Words Learned'], ['500+', 'Active Students'], ['98%', 'Satisfaction Rate']].map(([val, label]) => (
            <div key={label}>
              <div className="text-4xl font-extrabold text-white mb-1">{val}</div>
              <div className="text-slate-500 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">Everything you need to excel</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Built for the modern classroom and the ambitious self-learner.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-colors">
                <div className={`${f.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 bg-white/2">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">Loved by teachers & students</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <div className="flex mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-400">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative border rounded-2xl p-6 ${plan.color}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth" className={`w-full block text-center font-bold py-3 rounded-xl transition-all ${plan.ctaStyle}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 rounded-3xl p-12">
            <h2 className="text-4xl font-extrabold mb-4">Ready to transform your teaching?</h2>
            <p className="text-slate-400 mb-8 text-lg">Join hundreds of teachers and students already learning smarter with LingoPro.</p>
            <Link href="/auth" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all shadow-2xl shadow-primary/30 group">
              Get Started Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Brain className="h-5 w-5 text-primary" />
            LingoPro
          </Link>
          <p className="text-slate-500 text-sm">© 2026 LingoPro. Built with ❤️ for learners.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
