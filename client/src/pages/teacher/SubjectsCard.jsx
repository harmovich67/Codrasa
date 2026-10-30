import { useEffect, useState } from 'react';
import { Code2, Library, PenLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, IconButton, Input, Select } from '../../components/ui.jsx';

export const KIND_LABEL = { code: 'برمجة · محرر كود', board: 'سبورة' };

/* Admin: the subjects courses belong to. A "board" subject turns the code editor into a whiteboard for its lessons. */
export default function SubjectsCard() {
  const [subjects, setSubjects] = useState(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('board');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/subjects').then(setSubjects).catch(toast.error);
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/subjects', { name, kind });
      setName('');
      toast.success('اتضافت المادة ✓');
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function rename(subject) {
    const next = window.prompt('اسم المادة', subject.name);
    if (next == null || !next.trim() || next.trim() === subject.name) return;
    await api.put(`/subjects/${subject.id}`, { name: next }).catch(toast.error);
    load();
  }

  async function remove(subject) {
    if (!window.confirm(`حذف مادة "${subject.name}"؟`)) return;
    await api.del(`/subjects/${subject.id}`).catch(toast.error);
    load();
  }

  return (
    <Card className="min-w-0 space-y-4 p-5 lg:col-span-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <Library className="size-4.5 text-brand" /> المواد الدراسية
      </h2>
      <p className="text-xs leading-6 text-muted">
        كل كورس بيتبع مادة. <b className="text-ink">البرمجة</b> بتشتغل بمحرر كود، وأي مادة من نوع <b className="text-ink">سبورة</b> (رياضيات، فيزياء…) المحرر بتاعها بيتحول لسبورة بترسم وتكتب عليها وتشرح بصوتك. نوع المادة مبيتغيرش بعد ما تتعمل.
      </p>
      {!subjects ? null : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {subjects.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">{s.kind === 'board' ? <PenLine className="size-4" /> : <Code2 className="size-4" />}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              <Badge color={s.kind === 'board' ? 'amber' : 'brand'}>{KIND_LABEL[s.kind]}</Badge>
              <span className="text-xs text-muted">{s.course_count} كورس</span>
              <IconButton icon={Pencil} title="تغيير الاسم" onClick={() => rename(s)} />
              <IconButton icon={Trash2} title="حذف" onClick={() => remove(s)} className="hover:text-rose" />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلًا: رياضيات" maxLength={60} />
        </div>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-48">
          <option value="board">سبورة (رياضيات، فيزياء…)</option>
          <option value="code">برمجة (محرر كود)</option>
        </Select>
        <Button type="submit" icon={Plus} loading={busy} disabled={!name.trim()}>
          إضافة مادة
        </Button>
      </form>
    </Card>
  );
}
