import { REQUIRED_COURSES } from './data';
import type { AppState, Course, CourseCategory, GraduationAlert, GeSubcategory } from './types';

export function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(1)).toString();
}

export function completedCredits(courses: Course[], category: CourseCategory): number {
  return courses.filter(course => course.completed && course.category === category).reduce((sum, course) => sum + course.credits, 0);
}

export function generalCredits(courses: Course[], subcategory?: GeSubcategory): number {
  return courses.filter(course => course.completed && course.category === 'ge' && (!subcategory || course.geSubcategory === subcategory)).reduce((sum, course) => sum + course.credits, 0);
}

export function eligibleCredits(courses: Course[], peCountsTowardTotal: boolean): number {
  return courses.filter(course => course.completed && course.category !== 'ge-excluded' && (peCountsTowardTotal || course.category !== 'pe')).reduce((sum, course) => sum + course.credits, 0);
}

export function electiveCredits(courses: Course[], outsideLimit: number): number {
  const completed = courses.filter(course => course.completed && course.category === 'elective');
  const department = completed.filter(course => !course.outsideDepartment).reduce((sum, course) => sum + course.credits, 0);
  const outside = completed.filter(course => course.outsideDepartment).reduce((sum, course) => sum + course.credits, 0);
  return department + Math.min(outside, outsideLimit);
}

export function calculateGraduation(state: AppState): { total: number; isReady: boolean } {
  const { courses, profile, milestones } = state;
  const requirements = profile.requirements;
  const sampleCoursesDone = !profile.sampleCourseRules || REQUIRED_COURSES.filter(course => !course.optional).every(required => courses.some(course => course.id === required.id && course.completed));
  const detailedGeDone = !profile.detailedGeneralEducation || (
    generalCredits(courses, 'humanities') >= 2 && generalCredits(courses, 'social') >= 2 &&
    generalCredits(courses, 'natural') >= 2 && generalCredits(courses, 'integrative') >= 4
  );
  const categoryRequirementsMet = completedCredits(courses, 'college') >= requirements.college &&
    completedCredits(courses, 'dept-required') >= requirements.deptRequired &&
    electiveCredits(courses, requirements.outsideElective) >= requirements.elective &&
    completedCredits(courses, 'ge') >= requirements.general;
  const total = eligibleCredits(courses, profile.peCountsTowardTotal);
  const isReady = total >= requirements.total && categoryRequirementsMet && completedCredits(courses, 'pe') >= requirements.pe &&
    sampleCoursesDone && detailedGeDone && (!profile.cpeRequired || milestones.cpe) && (!profile.englishRequired || milestones.english);
  return { total, isReady };
}

export function getGraduationAlerts(state: AppState): GraduationAlert[] {
  const { courses, profile, milestones } = state;
  const requirements = profile.requirements;
  const alerts: GraduationAlert[] = [];
  const isCompleted = (id: string) => courses.some(course => course.id === id && course.completed);
  if (profile.sampleCourseRules) {
    for (const required of REQUIRED_COURSES.filter(course => (course.category === 'college' || course.category === 'dept-required') && !course.optional)) {
      if (!isCompleted(required.id)) alerts.push({ label: `尚未完成：${required.name}`, kind: 'course' });
    }
    if (profile.detailedGeneralEducation) {
      for (const [id, label] of [
        ['ge-chinese-lit', '敘事表達：語文素養'], ['ge-chinese-use', '敘事表達：語文應用'],
        ['ge-english-communicate', '英語溝通與表達'], ['ge-english-reading', '學術英文聽讀'],
      ]) if (!isCompleted(id)) alerts.push({ label: `尚未完成：${label}`, kind: 'course' });
      if (generalCredits(courses, 'foreign') < 4) alerts.push({ label: `外國語文尚需 ${formatCredits(4 - generalCredits(courses, 'foreign'))} 學分`, kind: 'rule' });
    }
  }
  if (profile.detailedGeneralEducation) {
    for (const [key, label] of [['humanities', '人文'], ['social', '社會'], ['natural', '自然']] as const) {
      if (generalCredits(courses, key) < 2) alerts.push({ label: `尚缺 ${label}領域通識課程`, kind: 'domain' });
    }
    if (generalCredits(courses, 'integrative') < 4) alerts.push({ label: `統合領域尚需 ${formatCredits(4 - generalCredits(courses, 'integrative'))} 學分`, kind: 'rule' });
  }
  const electives = electiveCredits(courses, requirements.outsideElective);
  if (electives < requirements.elective) alerts.push({ label: `系所專業選修尚需 ${formatCredits(requirements.elective - electives)} 學分${requirements.outsideElective ? `（外系最多採計 ${formatCredits(requirements.outsideElective)}）` : ''}`, kind: 'rule' });
  for (const [category, minimum, label] of [
    ['ge', requirements.general, '通識課程'], ['college', requirements.college, '院／校專業必修'],
    ['dept-required', requirements.deptRequired, '系所專業必修'],
  ] as const) {
    const earned = completedCredits(courses, category);
    if (earned < minimum) alerts.push({ label: `${label}尚需 ${formatCredits(minimum - earned)} 學分`, kind: 'rule' });
  }
  const total = eligibleCredits(courses, profile.peCountsTowardTotal);
  if (total < requirements.total) alerts.push({ label: `畢業總學分尚需 ${formatCredits(requirements.total - total)} 學分`, kind: 'rule' });
  const pe = completedCredits(courses, 'pe');
  if (pe < requirements.pe) alerts.push({ label: `體育尚需 ${formatCredits(requirements.pe - pe)} 學分${profile.peCountsTowardTotal ? '' : '（不計入總學分）'}`, kind: 'rule' });
  if (profile.cpeRequired && !milestones.cpe) alerts.push({ label: '完成 CPE 或進階程式實作門檻', kind: 'milestone' });
  if (profile.englishRequired && !milestones.english) alerts.push({ label: '完成英語能力檢定門檻', kind: 'milestone' });
  const outside = courses.filter(course => course.completed && course.category === 'elective' && course.outsideDepartment).reduce((sum, course) => sum + course.credits, 0);
  if (outside > requirements.outsideElective) alerts.push({ label: `外系選修已 ${formatCredits(outside)} 學分，超過可採計上限 ${formatCredits(requirements.outsideElective)} 學分`, kind: 'warning' });
  return alerts;
}

export function sortAlerts(alerts: GraduationAlert[]): GraduationAlert[] {
  const priority = (alert: GraduationAlert) => /敘事表達|英語溝通與表達|學術英文聽讀|領域通識課程|統合領域/.test(alert.label)
    ? 0 : alert.kind === 'warning' ? 1 : alert.kind === 'domain' ? 2 : alert.kind === 'milestone' ? 3 : alert.kind === 'course' ? 4 : 5;
  return [...alerts].sort((a, b) => priority(a) - priority(b));
}