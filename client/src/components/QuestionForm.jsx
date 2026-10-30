import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '../store/toast.js';
import { Button, Field, IconButton, Input, Modal, Textarea, Toggle, cx } from './ui.jsx';

const blank = (skill) => ({ prompt: '', options: ['', ''], answer: 0, skill, hint: '', required: true });

/*
 * A multiple-choice question the teacher adds while recording. The lesson stops at this moment for
 * the student until they answer, and they can ask for a hint (the teacher's, or Gemini's).
 * `onSave` receives a checkpoint without its time: the recorder stamps the current lesson time.
 */
export default function QuestionForm({ open, onClose, onSave, defaultSkill = '' }) {
  const [form, setForm] = useState(() => blank(defaultSkill));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setOption = (i, value) => set({ options: form.options.map((o, j) => (j === i ? value : o)) });

  function save() {
    const prompt = form.prompt.trim();
    const options = form.options.map((o) => o.trim());
    if (!prompt) return toast.error('اكتب نص السؤال');
    if (!form.skill.trim()) return toast.error('اكتب المهارة اللي بيقيسها السؤال');
    if (options.length < 2 || options.some((o) => !o)) return toast.error('كل اختيار لازم يتكتب (اختيارين على الأقل)');
    if (new Set(options).size !== options.length) return toast.error('الاختيارات لازم تكون مختلفة');
    onSave({
      type: 'choice',
      title: prompt.split('\n')[0].slice(0, 80),
      prompt,
      skill: form.skill.trim(),
      hint: form.hint.trim(),
      required: form.required,
      options,
      answer: form.answer,
    });
    setForm(blank(form.skill));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="سؤال للطلاب في اللحظة دي"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={save}>حفظ وكمّل التسجيل</Button>
        </>
      }
    >
      <p className="rounded-lg bg-amber/10 p-3 text-xs leading-6 text-amber">
        التسجيل واقف مؤقتًا (الصوت والسبورة/الكود) لحد ما تحفظ السؤال أو تلغيه. الطالب هيشوف السؤال في نفس اللحظة دي ومش هيكمّل الدرس لحد ما يجاوب.
      </p>
      <Field label="السؤال">
        <Textarea value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={3} dir="auto" autoFocus />
      </Field>
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted">الاختيارات (حدد الإجابة الصح)</span>
        {form.options.map((option, i) => (
          <label key={i} className={cx('flex items-center gap-2 rounded-lg border px-2', form.answer === i ? 'border-mint/60 bg-mint/5' : 'border-line')}>
            <input type="radio" name="live-answer" checked={form.answer === i} onChange={() => set({ answer: i })} className="accent-[#2dd4a7]" />
            <input value={option} onChange={(e) => setOption(i, e.target.value)} placeholder={`اختيار ${i + 1}`} dir="auto" className="w-full bg-transparent py-2 text-sm outline-none" />
            {form.options.length > 2 && (
              <IconButton
                icon={Trash2}
                title="حذف الاختيار"
                onClick={() => set({ options: form.options.filter((_, j) => j !== i), answer: form.answer === i ? 0 : form.answer > i ? form.answer - 1 : form.answer })}
              />
            )}
          </label>
        ))}
        {form.options.length < 6 && (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => set({ options: [...form.options, ''] })}>
            اختيار
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="المهارة اللي بيقيسها" hint="بتتبني منها خريطة مهارات الطالب">
          <Input value={form.skill} onChange={(e) => set({ skill: e.target.value })} />
        </Field>
        <Field label="تلميحك للطالب (اختياري)">
          <Input value={form.hint} onChange={(e) => set({ hint: e.target.value })} dir="auto" />
        </Field>
      </div>
      <Toggle checked={form.required} onChange={(required) => set({ required })} label={form.required ? 'إجباري — الدرس مبيكمّلش من غير إجابة صح' : 'اختياري — الطالب يقدر يتخطّاه'} />
    </Modal>
  );
}
