import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import type { GraduationProfile, GraduationRequirements } from '../types';

interface RequirementsDialogProps {
  open: boolean;
  profile: GraduationProfile;
  onClose: () => void;
  onSave: (profile: GraduationProfile) => void;
}

const requirementFields: { key: keyof GraduationRequirements; label: string; max: number }[] = [
  { key: 'deptRequired', label: '系所必修', max: 300 },
  { key: 'college', label: '院／校必修', max: 300 },
  { key: 'elective', label: '系所選修', max: 300 },
  { key: 'general', label: '通識課程', max: 300 },
  { key: 'pe', label: '體育最低學分', max: 30 },
  { key: 'outsideElective', label: '系選修可採計外系上限', max: 300 },
];

export function RequirementsDialog({ open, profile, onClose, onSave }: RequirementsDialogProps) {
  const [form, setForm] = useState(profile);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm(profile); setError(''); }
  }, [open, profile]);

  function update<K extends keyof GraduationProfile>(key: K, value: GraduationProfile[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateRequirement(key: keyof GraduationRequirements, value: number) {
    setForm(current => ({ ...current, requirements: { ...current.requirements, [key]: value } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.university.trim() || !form.department.trim() || Object.values(form.requirements).some(value => !Number.isFinite(value) || value < 0)) {
      setError('請填寫學校、系所及有效的學分門檻。');
      return;
    }
    const identityChanged = ['university', 'department', 'academicYear'].some(key => form[key as keyof GraduationProfile] !== profile[key as keyof GraduationProfile]);
    if (identityChanged && profile.sampleCourseRules && !window.confirm('校系或適用學年度已變更。中興資管範例課程將移除，自訂課程會保留。要繼續嗎？')) return;
    onSave({ ...form, university: form.university.trim(), department: form.department.trim(), academicYear: form.academicYear.trim() });
  }

  return (
    <Modal open={open} onClose={onClose} title="設定你的畢業規定" eyebrow="個人化設定" size="large">
      <p className="mb-4 rounded-lg bg-[#f1f5fa] px-3 py-2.5 text-xs leading-relaxed text-slate-600">直接填入台灣任何大專校院、系所與你的入學年度規定；不必從校系清單中選擇。</p>
      <form onSubmit={submit} className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">學校</span><input required maxLength={60} value={form.university} onChange={event => update('university', event.target.value)} className="field" placeholder="例如：國立中興大學" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">學院／系所</span><input required maxLength={60} value={form.department} onChange={event => update('department', event.target.value)} className="field" placeholder="例如：資訊管理學系" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">入學年度／適用學年度</span><input maxLength={24} value={form.academicYear} onChange={event => update('academicYear', event.target.value)} className="field" placeholder="例如：115" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">畢業總學分</span><input required type="number" min="0" max="300" step="0.5" value={form.requirements.total} onChange={event => updateRequirement('total', Number(event.target.value))} className="field" /></label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold">各類最低學分（不適用的類別填 0）</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {requirementFields.map(field => <label key={field.key} className="block"><span className="mb-1 block text-[11px] text-slate-500">{field.label}</span><input type="number" min="0" max={field.max} step="0.5" value={form.requirements[field.key]} onChange={event => updateRequirement(field.key, Number(event.target.value))} className="field" /></label>)}
          </div>
        </div>
        <label className="check-row rounded-lg border border-line px-3 py-3"><input type="checkbox" checked={form.peCountsTowardTotal} onChange={event => update('peCountsTowardTotal', event.target.checked)} /><span><span className="block font-semibold text-ink">體育學分計入畢業總學分</span><span className="mt-0.5 block text-[11px] text-slate-500">未勾選時，體育仍會獨立檢核，但不加入畢業總學分。</span></span></label>
        <div className="space-y-2 border-t border-line pt-3">
          <label className="check-row"><input type="checkbox" checked={form.sampleCourseRules} onChange={event => setForm(current => ({ ...current, sampleCourseRules: event.target.checked, detailedGeneralEducation: event.target.checked && current.detailedGeneralEducation }))} /><span>使用中興資管 115 學年度範例必修課程清單</span></label>
          <label className="check-row"><input type="checkbox" checked={form.detailedGeneralEducation} disabled={!form.sampleCourseRules} onChange={event => update('detailedGeneralEducation', event.target.checked)} /><span>套用範例通識細項（本國語文、外語、三領域與統合領域）</span></label>
          <label className="check-row"><input type="checkbox" checked={form.cpeRequired} onChange={event => update('cpeRequired', event.target.checked)} /><span>追蹤 CPE／進階程式實作門檻</span></label>
          <label className="check-row"><input type="checkbox" checked={form.englishRequired} onChange={event => update('englishRequired', event.target.checked)} /><span>追蹤英語能力檢定門檻</span></label>
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} className="button-secondary">取消</button><button type="submit" className="button-primary">儲存規定</button></div>
      </form>
    </Modal>
  );
}