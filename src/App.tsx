import { useDeferredValue, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ArrowUpRight, BadgeCheck, BookOpenCheck, ChevronRight, CircleCheck, CircleDashed, Cloud, CloudSun,
  Compass, Landmark, Layers2, Plus, Search, SearchX, SlidersHorizontal, Sprout,
  TriangleAlert,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AccountDialog } from './components/AccountDialog';
import { CourseDialog } from './components/CourseDialog';
import { RequirementsDialog } from './components/RequirementsDialog';
import { CATEGORY_LABELS, GE_LABELS, normalizeState, REQUIRED_COURSES, createInitialState } from './data';
import { calculateGraduation, completedCredits, formatCredits, getGraduationAlerts, sortAlerts, electiveCredits } from './credits';
import type { FirebaseServices } from './firebase';
import { loadLocalState, saveLocalState } from './storage';
import type { AppState, Course, CourseCategory, GraduationProfile } from './types';

const categoryFilters: { value: CourseCategory | 'all'; label: string }[] = [
  { value: 'all', label: '所有類別' },
  { value: 'dept-required', label: '系所專業必修' },
  { value: 'college', label: '院／校專業必修' },
  { value: 'elective', label: '系所專業選修' },
  { value: 'ge', label: '通識課程' },
  { value: 'free', label: '其他採計學分' },
  { value: 'pe', label: '體育' },
];

const categoryOrder: CourseCategory[] = ['dept-required', 'college', 'elective', 'ge', 'free', 'ge-excluded', 'pe'];

function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': '電子郵件或密碼不正確。',
    'auth/user-not-found': '找不到此帳號，請確認電子郵件或建立新帳號。',
    'auth/email-already-in-use': '此電子郵件已註冊，請直接登入。',
    'auth/weak-password': '密碼至少需要 6 個字元。',
    'auth/invalid-email': '請輸入有效的電子郵件地址。',
    'auth/missing-email': '請先輸入電子郵件地址。',
    'auth/too-many-requests': '嘗試次數過多，請稍後再試。',
    'auth/operation-not-allowed': 'Firebase Console 尚未啟用此登入方式。',
    'auth/popup-closed-by-user': '登入視窗已關閉，尚未完成登入。',
    'auth/unauthorized-domain': '此網域尚未加入 Firebase Authentication 授權網域。',
    'auth/network-request-failed': '網路連線失敗，請稍後再試。',
  };
  return code ? messages[code] ?? `登入失敗：${(error as Error).message}` : 'Firebase 尚未設定，請先填寫 .env.local。';
}

function ProgressCard({ title, earned, required, icon, tint, color, barColor }: {
  title: string; earned: number; required: number; icon: React.ReactNode; tint: string; color: string; barColor: string;
}) {
  const percent = required <= 0 ? 100 : Math.min(100, earned / required * 100);
  return (
    <article className="panel rounded-xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between"><span className="text-sm font-semibold">{title}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${tint} ${color}`}>{icon}</span></div>
      <div className="flex items-baseline gap-1.5"><strong className="text-2xl tabular-nums">{formatCredits(earned)}</strong><span className="text-sm text-slate-400">/ {formatCredits(required)}</span></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`meter-fill h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} /></div>
      <p className="mt-2 text-xs text-slate-500">{earned >= required ? '已達最低門檻' : `尚需 ${formatCredits(required - earned)} 學分`}</p>
    </article>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadLocalState());
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState<CourseCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<CourseCategory>>(() => new Set());
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [firebaseApi, setFirebaseApi] = useState<typeof import('./firebase') | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('本機儲存');
  const [authError, setAuthError] = useState('');
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);
  const lastLoggedInUid = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => {};
    const hasFirebaseConfig = Boolean(
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
    );
    if (!hasFirebaseConfig) return;
    void import('./firebase').then(api => {
      if (!active) return;
      const instance = api.createFirebaseServices();
      if (!instance) return;
      setFirebaseApi(api);
      setServices(instance);
      setFirebaseConfigured(true);
      unsubscribe = api.observeAuth(instance, async nextUser => {
        if (!active) return;
        if (nextUser && lastLoggedInUid.current && lastLoggedInUid.current !== nextUser.uid) setState(createInitialState());
        if (nextUser) lastLoggedInUid.current = nextUser.uid;
        setUser(nextUser);
        setCloudReady(false);
        if (!nextUser) { setSyncStatus('本機儲存'); return; }
        setSyncStatus('載入雲端…');
        try {
          const cloudState = await api.fetchUserState(instance, nextUser.uid);
          if (!active) return;
          if (cloudState) setState(normalizeState(cloudState));
          setCloudReady(true);
          setSyncStatus('已同步');
        } catch (error) {
          console.error('Firestore load failed:', error);
          setSyncStatus('雲端讀取失敗');
          setAuthError('無法讀取雲端資料，請確認 Firestore 已啟用且安全規則允許本人存取。');
          setCloudReady(true);
        }
      });
    }).catch(error => {
      console.error('Firebase initialization failed:', error);
      setAuthError('Firebase 初始化失敗，請確認 .env.local 設定。');
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    try { saveLocalState(state); }
    catch (error) { console.error('Local save failed:', error); setSyncStatus('本機儲存失敗'); }
  }, [state]);

  useEffect(() => {
    if (!user || !services || !firebaseApi || !cloudReady) return;
    setSyncStatus('等待同步…');
    const timer = window.setTimeout(() => {
      void firebaseApi.persistUserState(services, user.uid, state)
        .then(() => setSyncStatus('已同步'))
        .catch(error => { console.error('Firestore save failed:', error); setSyncStatus('同步失敗'); });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state, user, services, firebaseApi, cloudReady]);

  const { total, isReady } = calculateGraduation(state);
  const { requirements } = state.profile;
  const percent = requirements.total <= 0 ? 100 : Math.min(100, Math.round(total / requirements.total * 100));
  const alerts = sortAlerts(getGraduationAlerts(state));
  const filteredCourses = state.courses
    .filter(course => !deferredQuery.trim() || course.name.toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase()))
    .filter(course => categoryFilter === 'all' || course.category === categoryFilter || (categoryFilter === 'ge' && course.category === 'ge-excluded'))
    .filter(course => statusFilter === 'all' || (statusFilter === 'completed' ? course.completed : !course.completed))
    .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.name.localeCompare(b.name, 'zh-Hant'));
  const groupedCourses = categoryOrder.map(category => ({
    category,
    courses: filteredCourses.filter(course => course.category === category),
  })).filter(group => group.courses.length > 0);

  function updateState(updater: (current: AppState) => AppState) { setState(current => updater(current)); }

  function saveProfile(profile: GraduationProfile) {
    updateState(current => {
      const identityChanged = ['university', 'department', 'academicYear'].some(key => current.profile[key as keyof GraduationProfile] !== profile[key as keyof GraduationProfile]);
      const nextProfile = identityChanged ? { ...profile, sampleCourseRules: false, detailedGeneralEducation: false } : profile;
      const customCourses = current.courses.filter(course => course.custom);
      let courses: Course[];
      if (identityChanged || !nextProfile.sampleCourseRules) courses = customCourses;
      else {
        const byId = new Map(current.courses.map(course => [course.id, course]));
        for (const template of REQUIRED_COURSES) {
          if (!byId.has(template.id)) byId.set(template.id, { ...template, completed: false, semester: '' });
        }
        courses = [...byId.values()];
      }
      return { ...current, profile: nextProfile, courses };
    });
    setRequirementsOpen(false);
  }

  function saveCourse(course: Course) {
    updateState(current => ({ ...current, courses: current.courses.some(item => item.id === course.id)
      ? current.courses.map(item => item.id === course.id ? course : item)
      : [...current.courses, course] }));
    setCourseDialogOpen(false);
  }

  function deleteCourse(courseId: string) {
    if (!window.confirm('確定刪除此自訂課程？')) return;
    updateState(current => ({ ...current, courses: current.courses.filter(course => course.id !== courseId) }));
    setCourseDialogOpen(false);
  }

  function toggleCourse(courseId: string, completed: boolean) {
    updateState(current => ({ ...current, courses: current.courses.map(course => course.id === courseId ? { ...course, completed } : course) }));
  }

  function updateMilestone(key: 'cpe' | 'english', completed: boolean) {
    updateState(current => ({ ...current, milestones: { ...current.milestones, [key]: completed } }));
  }

  async function handleGoogleSignIn() {
    if (!services || !firebaseApi) { setAuthError('Firebase 尚未設定，請先填寫 .env.local。'); return; }
    try { setAuthError(''); await firebaseApi.signInWithGoogle(services); setAccountOpen(false); }
    catch (error) { setAuthError(authMessage(error)); }
  }

  async function handleEmailSignIn(email: string, password: string, create: boolean) {
    if (!services || !firebaseApi) { setAuthError('Firebase 尚未設定，請先填寫 .env.local。'); return; }
    try {
      setAuthError('');
      if (create) await firebaseApi.createEmailAccount(services, email, password);
      else await firebaseApi.signInWithEmail(services, email, password);
      setAccountOpen(false);
    } catch (error) { setAuthError(authMessage(error)); }
  }

  async function handlePasswordReset(email: string) {
    if (!services || !firebaseApi) throw new Error('Firebase 尚未設定，請先填寫 .env.local。');
    try { await firebaseApi.sendPasswordReset(services, email); }
    catch (error) { throw new Error(authMessage(error)); }
  }

  async function handleSignOut() {
    if (!services || !firebaseApi) return;
    try { await firebaseApi.signOutUser(services); setAccountOpen(false); }
    catch (error) { setAuthError(authMessage(error)); }
  }

  function filterChange(event: ChangeEvent<HTMLSelectElement>) { setCategoryFilter(event.target.value as CourseCategory | 'all'); }

  function toggleCategory(category: CourseCategory) {
    setExpandedCategories(current => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div className="shell font-sans antialiased">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3 no-underline" aria-label="回到首頁">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-forest text-white shadow-sm"><svg aria-hidden="true" width="27" height="27" viewBox="0 0 32 32" fill="none"><path d="M5 25.5V7l11 12L27 7v18.5M5 7h5m12 0h5M5 25.5h5m12 0h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="19" r="2.3" fill="#e9bd57" /></svg></span>
          <span><span className="block text-[11px] font-bold uppercase tracking-[.16em] text-leaf">{state.profile.university} · {state.profile.department}</span><span className="mt-0.5 block font-display text-lg font-semibold leading-tight">HYJ_GCCS</span></span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => setRequirementsOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-leaf"><SlidersHorizontal className="h-4 w-4 text-leaf" /><span>設定畢業規定</span></button>
          <span className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${syncStatus.includes('失敗') ? 'text-coral' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${syncStatus.includes('失敗') ? 'bg-coral' : syncStatus === '已同步' ? 'bg-leaf' : 'bg-slate-300'}`} />{syncStatus}</span>
          <button type="button" onClick={() => { setAuthError(''); setAccountOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-leaf">{user?.photoURL ? <img src={user.photoURL} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Cloud className="h-4 w-4 text-leaf" />}<span className="max-w-28 truncate">{user ? user.displayName || user.email?.split('@')[0] || '已登入' : '登入同步'}</span></button>
        </div>
      </header>

      <main id="top">
        <section className="mb-5 grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
          <div className="relative overflow-hidden rounded-2xl bg-forest p-6 text-white sm:p-8">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" /><div className="absolute -right-1 top-10 h-36 w-36 rounded-full border border-white/10" />
            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-semibold text-white/85">{state.profile.academicYear ? `${state.profile.academicYear} 學年度` : '自訂'}畢業規定</span><span className="text-xs text-white/60">{state.profile.university} · {state.profile.department}</span></div>
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-sm text-white/70">畢業學分進度</p><div className="flex items-baseline gap-2"><strong className="font-display text-5xl font-semibold tabular-nums">{formatCredits(total)}</strong><span className="text-lg text-white/70">/ {formatCredits(requirements.total)} 學分</span></div></div><span className="pb-1 font-display text-2xl text-[#e9bd57]">{percent}%</span></div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="meter-fill h-full rounded-full bg-[#e9bd57]" style={{ width: `${percent}%` }} /></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/65"><span>{total >= requirements.total ? `已達最低畢業學分${total > requirements.total ? `，超出 ${formatCredits(total - requirements.total)} 學分` : ''}` : `尚需 ${formatCredits(requirements.total - total)} 學分`}</span><span>體育{state.profile.peCountsTowardTotal ? '計入' : '不計入'}畢業總學分</span></div>
            </div>
          </div>
          <div className="panel flex flex-col justify-between rounded-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-leaf">畢業狀態</p><h1 className="font-display text-xl font-semibold">{isReady ? '畢業條件已全數勾稽' : total >= requirements.total ? '學分達標，繼續完成檢核' : '一小步一小步累積'}</h1><p className="mt-1 text-sm leading-relaxed text-slate-500">{isReady ? '所有已設定的門檻均已完成，仍請以校方正式審核為準。' : '完成課程後勾選，隨時掌握畢業進度。'}</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-moss text-forest">{isReady ? <BadgeCheck className="h-5 w-5" /> : <Sprout className="h-5 w-5" />}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4"><div><p className="text-xs text-slate-500">已完成課程</p><p className="mt-1 text-lg font-bold tabular-nums">{state.courses.filter(course => course.completed).length} <span className="text-xs font-medium text-slate-400">門</span></p></div><div><p className="text-xs text-slate-500">已完成體育</p><p className="mt-1 text-lg font-bold tabular-nums">{formatCredits(completedCredits(state.courses, 'pe'))} <span className="text-xs font-medium text-slate-400">/ {formatCredits(requirements.pe)} 學分</span></p></div></div>
          </div>
        </section>

        <section aria-label="各類學分進度" className="stats-grid mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ProgressCard title="系所專業必修" earned={completedCredits(state.courses, 'dept-required')} required={requirements.deptRequired} icon={<BookOpenCheck className="h-4 w-4" />} tint="bg-[#e8f0e8]" color="text-leaf" barColor="bg-leaf" />
          <ProgressCard title="院／校專業必修" earned={completedCredits(state.courses, 'college')} required={requirements.college} icon={<Landmark className="h-4 w-4" />} tint="bg-[#f8efe1]" color="text-[#9b6a24]" barColor="bg-[#c69b4d]" />
          <ProgressCard title="系所專業選修" earned={electiveCredits(state.courses, requirements.outsideElective)} required={requirements.elective} icon={<Layers2 className="h-4 w-4" />} tint="bg-[#f9eae5]" color="text-coral" barColor="bg-coral" />
          <ProgressCard title="通識課程" earned={completedCredits(state.courses, 'ge')} required={requirements.general} icon={<Compass className="h-4 w-4" />} tint="bg-[#e9eef4]" color="text-[#5d748e]" barColor="bg-[#7089a2]" />
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-line p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">我的修課清單</h2><p className="mt-1 text-xs text-slate-500">{filteredCourses.length} 門課程 · 點選勾選狀態即可更新進度</p></div><button type="button" onClick={() => { setEditingCourse(null); setCourseDialogOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-forest px-3.5 text-sm font-semibold text-white transition hover:bg-[#163952]"><Plus className="h-4 w-4" />新增課程</button></div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1"><span className="sr-only">搜尋課程</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋課程名稱..." className="field pl-9" /></label>
                <label><span className="sr-only">課程類別篩選</span><select value={categoryFilter} onChange={filterChange} className="field bg-white sm:w-auto">{categoryFilters.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label><span className="sr-only">課程狀態篩選</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="field bg-white sm:w-auto"><option value="all">所有狀態</option><option value="incomplete">未完成</option><option value="completed">已完成</option></select></label>
              </div>
            </div>
            <div className="course-scroll soft-scroll max-h-[690px] overflow-y-auto p-3 sm:p-4" aria-live="polite">
              {groupedCourses.length ? groupedCourses.map(group => {
                const autoExpand = Boolean(deferredQuery.trim() || categoryFilter !== 'all' || statusFilter !== 'all');
                const expanded = expandedCategories.has(group.category) || autoExpand;
                const completeCount = group.courses.filter(course => course.completed).length;
                return <section key={group.category} className="border-b border-line last:border-b-0">
                <button type="button" aria-expanded={expanded} aria-controls={`course-group-${group.category}`} onClick={() => toggleCategory(group.category)} className="flex min-h-12 w-full items-center gap-3 px-2 text-left hover:bg-[#f3f7fa]">
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{CATEGORY_LABELS[group.category]}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{completeCount}/{group.courses.length}</span>
                  <span className="hidden text-[11px] text-slate-400 sm:inline">門完成</span>
                </button>
                {expanded && <div id={`course-group-${group.category}`}>
                {group.courses.map(course => <div key={course.id} className={`course-row group flex items-center gap-3 rounded-lg border-b border-[#edf1ed] px-2 py-3 last:border-b-0 sm:px-3 ${course.completed ? 'bg-[#f5f8f4]' : ''}`}>
                  <input type="checkbox" checked={course.completed} onChange={event => toggleCourse(course.id, event.target.checked)} aria-label={`${course.completed ? '取消完成' : '標記完成'}：${course.name}`} className="h-[17px] w-[17px] shrink-0 cursor-pointer accent-forest" />
                  <button type="button" onClick={() => { setEditingCourse(course); setCourseDialogOpen(true); }} className="min-w-0 flex-1 text-left"><span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`text-sm font-semibold ${course.completed ? 'text-slate-500 line-through decoration-slate-300' : 'text-ink'}`}>{course.name}</span>{course.geSubcategory && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{GE_LABELS[course.geSubcategory]}</span>}{course.optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">選修</span>}{course.outsideDepartment && <span className="rounded bg-[#f8efe1] px-1.5 py-0.5 text-[10px] text-[#9b6a24]">外系</span>}</span><span className="mt-1 block text-[11px] text-slate-400">{formatCredits(course.credits)} 學分{course.semester ? ` · ${course.semester}` : ''}{course.category === 'ge-excluded' ? ' · 不列入學分' : ''}</span></button>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{formatCredits(course.credits)}</span>
                </div>)}
                </div>}
              </section>}) : <div className="grid min-h-48 place-items-center text-center"><div><SearchX className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-600">找不到符合的課程</p><p className="mt-1 text-xs text-slate-400">試試其他關鍵字，或新增自訂課程。</p></div></div>}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="panel rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-coral">下一步</p><h2 className="mt-1 font-display text-lg font-semibold">待補項目</h2></div><span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#f9eae5] px-2 text-xs font-bold text-[#a95039]">{alerts.length}</span></div>
              {alerts.length ? <><ul className="space-y-3">{alerts.slice(0, alertsExpanded ? alerts.length : 5).map((alert, index) => <li key={`${alert.label}-${index}`} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">{alert.kind === 'warning' ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" /> : alert.kind === 'course' ? <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#91a594]" /> : <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#91a594]" />}<span>{alert.label}</span></li>)}</ul>{alerts.length > 5 && <button type="button" aria-expanded={alertsExpanded} onClick={() => setAlertsExpanded(value => !value)} className="mt-4 text-xs font-semibold text-leaf underline decoration-[#9cb59e] underline-offset-4">{alertsExpanded ? '收合項目' : `查看其餘 ${alerts.length - 5} 項`}</button>}</> : <p className="flex items-center gap-2 rounded-lg bg-[#e8f1f7] px-3 py-3 text-sm font-medium text-forest"><CircleCheck className="h-4 w-4" />目前沒有待補項目</p>}
            </section>
            {(state.profile.cpeRequired || state.profile.englishRequired) && <section className="panel rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-leaf">學位門檻</p><h2 className="mt-1 font-display text-lg font-semibold">畢業檢核</h2></div><BadgeCheck className="h-5 w-5 text-leaf" /></div><div className="space-y-3">
              {state.profile.cpeRequired && <label className="check-card"><input type="checkbox" checked={state.milestones.cpe} onChange={event => updateMilestone('cpe', event.target.checked)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">CPE 程式能力檢定</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">單次解題 2 題，或通過進階程式實作</span></span></label>}
              {state.profile.englishRequired && <label className="check-card"><input type="checkbox" checked={state.milestones.english} onChange={event => updateMilestone('english', event.target.checked)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">英語能力檢定</span><span className="mt-0.5 block text-xs text-slate-500">依校系公告標準完成</span></span></label>}
            </div><p className="mt-3 text-[11px] leading-relaxed text-slate-400">勾選僅供個人追蹤，請以校方最新公告為準。</p></section>}
            <section className="overflow-hidden rounded-2xl border border-[#dbe5ef] bg-[#edf3f8] p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/80 text-forest"><CloudSun className="h-4 w-4" /></span><div><h2 className="text-sm font-bold">跨裝置接續進度</h2><p className="mt-1 text-xs leading-relaxed text-slate-600">登入 Google 或電子郵件帳號，就能將修課紀錄同步到雲端。</p><button type="button" onClick={() => { setAuthError(''); setAccountOpen(true); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-forest underline decoration-[#9cb59e] underline-offset-4 hover:text-leaf">登入並同步<ArrowUpRight className="h-3 w-3" /></button></div></div></section>
            <p className="px-1 text-[11px] leading-relaxed text-slate-400">請依你的學校、系所及入學年度自行設定規定。本工具僅供個人試算，正式學分認定與畢業資格請以校方公告為準。</p>
          </aside>
        </section>
      </main>

      <RequirementsDialog open={requirementsOpen} profile={state.profile} onClose={() => setRequirementsOpen(false)} onSave={saveProfile} />
      <CourseDialog open={courseDialogOpen} course={editingCourse} onClose={() => setCourseDialogOpen(false)} onSave={saveCourse} onDelete={deleteCourse} />
      <AccountDialog open={accountOpen} user={user} configured={firebaseConfigured} error={authError} onClose={() => setAccountOpen(false)} onGoogle={handleGoogleSignIn} onEmail={handleEmailSignIn} onResetPassword={handlePasswordReset} onSignOut={handleSignOut} />
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-slate-500"><span>HYJ_GCCS</span><a href="https://www.hyjdevelop.com" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 font-semibold text-ink transition hover:text-leaf"><img src="https://www.hyjdevelop.com/logo.png" alt="HYJdevelop" loading="lazy" className="h-6 w-6 rounded-full object-cover" />由 HYJdevelop.com 製作<ArrowUpRight className="h-3.5 w-3.5" /></a></footer>
    </div>
  );
}