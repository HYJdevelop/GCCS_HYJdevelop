export type CourseCategory = 'dept-required' | 'college' | 'elective' | 'ge' | 'free' | 'pe' | 'ge-excluded';
export type GeSubcategory = 'chinese' | 'foreign' | 'humanities' | 'social' | 'natural' | 'integrative' | 'other';

export interface Course {
  id: string;
  name: string;
  credits: number;
  category: CourseCategory;
  completed: boolean;
  semester?: string;
  geSubcategory?: GeSubcategory | null;
  outsideDepartment?: boolean;
  optional?: boolean;
  custom?: boolean;
}

export interface GraduationRequirements {
  total: number;
  college: number;
  deptRequired: number;
  elective: number;
  general: number;
  pe: number;
  outsideElective: number;
}

export interface GraduationProfile {
  university: string;
  department: string;
  academicYear: string;
  requirements: GraduationRequirements;
  peCountsTowardTotal: boolean;
  sampleCourseRules: boolean;
  detailedGeneralEducation: boolean;
  cpeRequired: boolean;
  englishRequired: boolean;
}

export interface AppState {
  profile: GraduationProfile;
  courses: Course[];
  milestones: { cpe: boolean; english: boolean };
}

export interface GraduationAlert {
  label: string;
  kind: 'course' | 'rule' | 'domain' | 'milestone' | 'warning';
}