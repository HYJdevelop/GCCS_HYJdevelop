import { useState } from 'react';
import type { FormEvent } from 'react';
import { Cloud, Eye, EyeOff } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Modal } from './Modal';

interface AccountDialogProps {
  open: boolean;
  user: User | null;
  configured: boolean;
  error: string;
  onClose: () => void;
  onGoogle: () => Promise<void>;
  onEmail: (email: string, password: string, create: boolean) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountDialog({ open, user, configured, error, onClose, onGoogle, onEmail, onResetPassword, onSignOut }: AccountDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [creating, setCreating] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [resetNotice, setResetNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    setResetNotice('');
    if (creating && password !== passwordConfirmation) {
      setLocalError('兩次輸入的密碼不一致。');
      return;
    }
    setBusy(true);
    try { await onEmail(email.trim(), password, creating); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    setLocalError('');
    setResetNotice('');
    setBusy(true);
    try {
      await onResetPassword(email.trim());
      setResetNotice('重設密碼連結已寄出，請查看你的電子郵件。');
    } catch (resetError) {
      setLocalError(resetError instanceof Error ? resetError.message : '無法寄送重設信件，請稍後再試。');
    } finally { setBusy(false); }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="讓進度跟著你" eyebrow="雲端同步">
      {user ? <div>
        <div className="flex items-center gap-3 rounded-lg bg-[#f1f5fa] p-3">
          {user.photoURL ? <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-moss text-sm font-bold text-forest">{(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</span>}
          <span className="min-w-0"><span className="block truncate text-sm font-bold">{user.displayName || '大專校院學生'}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">你的校系規定、課程與畢業檢核會自動同步。</p>
        <button type="button" disabled={busy} onClick={() => void run(onSignOut)} className="button-secondary mt-4 w-full">登出</button>
      </div> : <>
        <p className="mb-4 rounded-lg bg-[#f1f5fa] p-3 text-xs leading-relaxed text-slate-600">{configured ? '登入後，課程與畢業檢核會同步到你的 Firebase 帳號。' : 'Firebase 尚未設定；本機模式仍可使用。完成 .env.local 設定後，即可啟用雲端同步。'}</p>
        <button type="button" disabled={busy || !configured} onClick={() => void run(onGoogle)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><span className="grid h-5 w-5 place-items-center rounded-full border border-line text-xs font-bold text-[#4285f4]">G</span>使用 Google 繼續</button>
        <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-line" />或使用電子郵件<span className="h-px flex-1 bg-line" /></div>
        <div className="grid grid-cols-2 rounded-lg bg-[#f1f5fa] p-1" role="group" aria-label="帳號模式">
          <button type="button" aria-pressed={!creating} onClick={() => { setCreating(false); setPasswordConfirmation(''); setLocalError(''); setResetNotice(''); }} className={`min-h-9 rounded-md text-sm font-semibold transition ${creating ? 'text-slate-500 hover:text-ink' : 'bg-white text-forest shadow-sm'}`}>登入</button>
          <button type="button" aria-pressed={creating} onClick={() => { setCreating(true); setPasswordConfirmation(''); setLocalError(''); setResetNotice(''); }} className={`min-h-9 rounded-md text-sm font-semibold transition ${creating ? 'bg-white text-forest shadow-sm' : 'text-slate-500 hover:text-ink'}`}>建立帳號</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold">電子郵件</span><input type="email" required disabled={!configured || busy} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" placeholder="name@example.com" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">密碼</span><span className="relative block"><input type={passwordVisible ? 'text' : 'password'} required disabled={!configured || busy} minLength={6} autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} className="field pr-11 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" placeholder="至少 6 個字元" /><button type="button" disabled={!configured || busy} onClick={() => setPasswordVisible(value => !value)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label={passwordVisible ? '隱藏密碼' : '顯示密碼'}>{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
          {creating && <label className="block"><span className="mb-1 block text-xs font-semibold">確認密碼</span><input type={passwordVisible ? 'text' : 'password'} required disabled={!configured || busy} minLength={6} autoComplete="new-password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} className="field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" placeholder="再次輸入密碼" /></label>}
          <button type="submit" disabled={busy || !configured} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">{busy ? '處理中…' : creating ? '建立帳號' : '登入'}</button>
        </form>
        {!creating && <button type="button" disabled={!configured || busy || !email.trim()} onClick={() => void resetPassword()} className="mt-3 w-full text-center text-xs font-semibold text-leaf underline underline-offset-4 disabled:cursor-not-allowed disabled:text-slate-400">忘記密碼？寄送重設連結</button>}
        {localError && <p className="mt-3 rounded-lg bg-[#fff2ed] p-3 text-xs leading-relaxed text-[#a95039]" role="alert">{localError}</p>}
        {resetNotice && <p className="mt-3 rounded-lg bg-[#e8f1f7] p-3 text-xs leading-relaxed text-forest" role="status">{resetNotice}</p>}
        {!configured && <div className="mt-4 flex gap-2 rounded-lg bg-[#f1f5fa] p-3 text-xs leading-relaxed text-slate-600"><Cloud className="mt-0.5 h-4 w-4 shrink-0" />尚未連結 Firebase；目前資料會保存在這個瀏覽器。</div>}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-forest">繼續以訪客模式使用</button>
      </>}
      {error && <p className="mt-3 rounded-lg bg-[#fff2ed] p-3 text-xs leading-relaxed text-[#a95039]" role="alert">{error}</p>}
      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">未登入時資料只保存在目前瀏覽器。</p>
    </Modal>
  );
}