import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { CATEGORY_OPTIONS, GE_OPTIONS } from '../data';
import { Modal } from './Modal';
import type { Course, CourseCategory, GeSubcategory } from '../types';

interface CourseDialogProps {
  open: boolean;
  course: Course | null;
  onClose: () => void;
  onSave: (course: Course) => void;
  onDelete: (courseId: string) => void;
}

interface CourseForm {
  name: string;
  credits: number;
  category: CourseCategory;
  semester: string;
  geSubcategory: GeSubcategory;
  outsideDepartment: boolean;
  completed: boolean;
}

const blankForm: CourseForm = { name: '', credits: 3, category: 'elective', semester: '', geSubcategory: 'other', outsideDepartment: false, completed: false };

export function CourseDialog({ open, course, onClose, onSave, onDelete }: CourseDialogProps) {
  const [form, setForm] = useState<CourseForm>(blankForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(course ? {
      name: course.name, credits: course.credits, category: course.category,
      semester: course.semester ?? '', geSubcategory: course.geSubcategory ?? 'other',
      outsideDepartment: Boolean(course.outsideDepartment), completed: course.completed,
    } : blankForm);
    setError('');
  }, [open, course]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || !Number.isFinite(form.credits) || form.credits <= 0 || form.credits > 12) {
      setError('請填寫課名，並輸入 0.5 至 12 之間的學分數。');
      return;
    }
    onSave({
      ...(course ?? {}), id: course?.id ?? `custom-${crypto.randomUUID()}`, name,
      credits: form.credits, category: form.category, semester: form.semester.trim(),
      completed: form.completed, custom: true,
      geSubcategory: form.category === 'ge' ? form.geSubcategory : null,
      outsideDepartment: form.category === 'elective' && form.outsideDepartment,
    });
  }

  const update = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) => setForm(current => ({ ...current, [key]: value }));

  return (
    <Modal open={open} onClose={onClose} title={course ? '編輯課程' : '新增自訂課程'} eyebrow="課程資料">
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">課程名稱</span><input required maxLength={80} value={form.name} onChange={event => update('name', event.target.value)} className="field" placeholder="例如：資料視覺化" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">學分數</span><input required type="number" min="0.5" max="12" step="0.5" value={form.credits} onChange={event => update('credits', Number(event.target.value))} className="field" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">修課學期</span><input maxLength={24} value={form.semester} onChange={event => update('semester', event.target.value)} className="field" placeholder="例如：115-1" /></label>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">課程類別</span><select value={form.category} onChange={event => update('category', event.target.value as CourseCategory)} className="field bg-white">{CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {form.category === 'ge' && <label className="block"><span className="mb-1.5 block text-sm font-semibold">通識領域</span><select value={form.geSubcategory} onChange={event => update('geSubcategory', event.target.value as GeSubcategory)} className="field bg-white">{GE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        {form.category === 'elective' && <label className="check-row"><input type="checkbox" checked={form.outsideDepartment} onChange={event => update('outsideDepartment', event.target.checked)} /><span>此系選修為外系修課（上限依畢業規定設定）</span></label>}
        <label className="check-row"><input type="checkbox" checked={form.completed} onChange={event => update('completed', event.target.checked)} /><span>已完成此課程</span></label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          {course?.custom ? <button type="button" onClick={() => onDelete(course.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#a95039] hover:bg-[#fff2ed]"><Trash2 className="h-4 w-4" />刪除</button> : <span />}
          <div className="flex gap-2"><button type="button" onClick={onClose} className="button-secondary">取消</button><button type="submit" className="button-primary">儲存課程</button></div>
        </div>
      </form>
    </Modal>
  );
}