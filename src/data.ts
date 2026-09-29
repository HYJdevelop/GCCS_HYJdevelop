import type { AppState, Course, CourseCategory, GraduationProfile, GeSubcategory } from './types';

export const STORAGE_KEY = 'nchu-mis-credit-tracker-v1';

export const DEFAULT_PROFILE: GraduationProfile = {
  university: '國立中興大學',
  department: '資訊管理學系',
  academicYear: '115',
  requirements: { total: 128, college: 17, deptRequired: 36, elective: 30, general: 28, pe: 2, outsideElective: 17 },
  peCountsTowardTotal: false,
  sampleCourseRules: true,
  detailedGeneralEducation: true,
  cpeRequired: true,
  englishRequired: true,
};

export const REQUIRED_COURSES: Omit<Course, 'completed'>[] = [
  { id: 'college-intro', name: '計算機概論', credits: 3, category: 'college' },
  { id: 'college-accounting', name: '會計學（一）', credits: 3, category: 'college' },
  { id: 'college-economics', name: '經濟學（一）', credits: 3, category: 'college' },
  { id: 'college-statistics', name: '統計學（一）', credits: 3, category: 'college' },
  { id: 'college-management', name: '管理學', credits: 3, category: 'college' },
  { id: 'college-lecture', name: '企業家講座或管理講座', credits: 2, category: 'college' },
  { id: 'dept-calculus', name: '微積分', credits: 3, category: 'dept-required' },
  { id: 'dept-intro-mis', name: '資訊管理導論', credits: 3, category: 'dept-required' },
  { id: 'dept-programming', name: '程式設計及實習', credits: 4, category: 'dept-required' },
  { id: 'dept-oop', name: '物件導向程式設計及實習', credits: 4, category: 'dept-required' },
  { id: 'dept-database', name: '資料庫管理系統', credits: 3, category: 'dept-required' },
  { id: 'dept-systems', name: '系統分析與設計', credits: 3, category: 'dept-required' },
  { id: 'dept-structure', name: '資料結構及實習', credits: 4, category: 'dept-required' },
  { id: 'dept-math', name: '管理數學', credits: 3, category: 'dept-required' },
  { id: 'dept-algorithms', name: '演算法', credits: 3, category: 'dept-required' },
  { id: 'dept-project-1', name: '資訊系統發展專題（一）', credits: 3, category: 'dept-required' },
  { id: 'dept-project-2', name: '資訊系統發展專題（二）', credits: 3, category: 'dept-required' },
  { id: 'ge-chinese-lit', name: '敘事表達：語文素養', credits: 2, category: 'ge', geSubcategory: 'chinese' },
  { id: 'ge-chinese-use', name: '敘事表達：語文應用', credits: 2, category: 'ge', geSubcategory: 'chinese' },
  { id: 'ge-english-communicate', name: '英語溝通與表達', credits: 2, category: 'ge', geSubcategory: 'foreign' },
  { id: 'ge-english-reading', name: '學術英文聽讀', credits: 2, category: 'ge', geSubcategory: 'foreign' },
  { id: 'ge-english-writing', name: '學術英文說寫（選修）', credits: 2, category: 'ge', geSubcategory: 'foreign', optional: true },
  { id: 'ge-humanities', name: '人文領域通識（自行填入課名）', credits: 2, category: 'ge', geSubcategory: 'humanities' },
  { id: 'ge-social', name: '社會領域通識（自行填入課名）', credits: 2, category: 'ge', geSubcategory: 'social' },
  { id: 'ge-natural', name: '自然領域通識（自行填入課名）', credits: 2, category: 'ge', geSubcategory: 'natural' },
  { id: 'ge-integrative-1', name: '統合領域通識（一）（自行填入課名）', credits: 2, category: 'ge', geSubcategory: 'integrative' },
  { id: 'ge-integrative-2', name: '統合領域通識（二）（自行填入課名）', credits: 2, category: 'ge', geSubcategory: 'integrative' },
  { id: 'pe-course-1', name: '體育（一）', credits: 1, category: 'pe' },
  { id: 'pe-course-2', name: '體育（二）', credits: 1, category: 'pe' },
];

export const CATEGORY_LABELS: Record<CourseCategory, string> = {
  'dept-required': '系所專業必修', college: '院／校專業必修', elective: '系所專業選修',
  ge: '通識課程', free: '其他採計學分', pe: '體育', 'ge-excluded': '不列入畢業學分',
};

export const GE_LABELS: Record<GeSubcategory, string> = {
  chinese: '本國語文', foreign: '外國語文', humanities: '人文領域', social: '社會領域',
  natural: '自然領域', integrative: '統合領域', other: '其他通識',
};

export const CATEGORY_OPTIONS: { value: CourseCategory; label: string }[] = [
  { value: 'dept-required', label: '系所專業必修' }, { value: 'college', label: '院／校專業必修' },
  { value: 'elective', label: '系所專業選修' }, { value: 'ge', label: '通識課程' },
  { value: 'free', label: '其他採計學分' }, { value: 'pe', label: '體育（是否計入依畢業規定）' },
  { value: 'ge-excluded', label: '電腦／AI 通識（不列入畢業學分）' },
];

export const GE_OPTIONS = Object.entries(GE_LABELS).map(([value, label]) => ({ value: value as GeSubcategory, label }));

export function normalizeProfile(value: unknown): GraduationProfile {
  const raw = value && typeof value === 'object' ? value as Partial<GraduationProfile> : {};
  const rawRequirements = raw.requirements ?? {};
  const requirements = Object.fromEntries(
    Object.entries(DEFAULT_PROFILE.requirements).map(([key, fallback]) => {
      const candidate = Number(rawRequirements[key as keyof typeof rawRequirements] ?? fallback);
      return [key, Number.isFinite(candidate) && candidate >= 0 ? candidate : fallback];
    }),
  ) as GraduationProfile['requirements'];
  const sampleCourseRules = raw.sampleCourseRules ?? DEFAULT_PROFILE.sampleCourseRules;
  return {
    ...DEFAULT_PROFILE,
    ...raw,
    university: typeof raw.university === 'string' ? raw.university : DEFAULT_PROFILE.university,
    department: typeof raw.department === 'string' ? raw.department : DEFAULT_PROFILE.department,
    academicYear: typeof raw.academicYear === 'string' ? raw.academicYear : DEFAULT_PROFILE.academicYear,
    requirements,
    peCountsTowardTotal: Boolean(raw.peCountsTowardTotal ?? DEFAULT_PROFILE.peCountsTowardTotal),
    sampleCourseRules: Boolean(sampleCourseRules),
    detailedGeneralEducation: Boolean(raw.detailedGeneralEducation ?? sampleCourseRules),
    cpeRequired: Boolean(raw.cpeRequired ?? DEFAULT_PROFILE.cpeRequired),
    englishRequired: Boolean(raw.englishRequired ?? DEFAULT_PROFILE.englishRequired),
  };
}

export function createInitialState(): AppState {
  return {
    profile: normalizeProfile(DEFAULT_PROFILE),
    courses: REQUIRED_COURSES.map(course => ({ ...course, completed: false, semester: '' })),
    milestones: { cpe: false, english: false },
  };
}

export function normalizeState(value: unknown): AppState {
  const raw = value && typeof value === 'object' ? value as Partial<AppState> : {};
  const profile = normalizeProfile(raw.profile);
  const courses = new Map<string, Course>();
  if (profile.sampleCourseRules) {
    for (const course of REQUIRED_COURSES) courses.set(course.id, { ...course, completed: false, semester: '' });
  }
  if (Array.isArray(raw.courses)) {
    for (const item of raw.courses) {
      if (!item || typeof item !== 'object') continue;
      const course = item as Partial<Course>;
      if (typeof course.id !== 'string' || typeof course.name !== 'string') continue;
      const category = CATEGORY_OPTIONS.some(option => option.value === course.category) ? course.category as CourseCategory : 'free';
      const credits = Number(course.credits);
      courses.set(course.id, {
        ...course, id: course.id, name: course.name, category,
        credits: Number.isFinite(credits) && credits >= 0 ? credits : 0,
        completed: Boolean(course.completed), geSubcategory: course.geSubcategory ?? null,
      });
    }
  }
  const milestones = raw.milestones ?? { cpe: false, english: false };
  return { profile, courses: [...courses.values()], milestones: { cpe: Boolean(milestones.cpe), english: Boolean(milestones.english) } };
}