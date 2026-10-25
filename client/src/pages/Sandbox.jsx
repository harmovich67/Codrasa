import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Plus, FlaskConical, Save, Terminal, Trash2, Play } from 'lucide-react';
import { api } from '../lib/api.js';
import { runCode } from '../lib/runner.js';
import { fmtRelative, fmtTime } from '../lib/format.js';
import { LANGUAGES, STARTERS, langInfo } from '../lib/languages.js';
import { toast } from '../store/toast.js';
import CodeEditor from '../components/CodeEditor.jsx';
import OutputPanel from '../components/OutputPanel.jsx';
import { Button, Card, Empty, IconButton, Input, PageHeader, PageLoader, Select, cx } from '../components/ui.jsx';

function Workspace({ fork, onSaved, onDeleted }) {
  const [title, setTitle] = useState(fork.title);
  const [language, setLanguage] = useState(fork.language);
  const [code, setCode] = useState(fork.code);
  const [output, setOutput] = useState(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const info = langInfo(language);
  const dirty = title !== fork.title || language !== fork.language || code !== fork.code;

  async function run() {
    if (!info.runnable) return;
    setOutput(await runCode(language, (editorRef.current?.getValue() ?? code).replaceAll('\r\n', '\n')));
  }
  const runRef = useRef(run);
  runRef.current = run;

  async function save() {
    setSaving(true);
    try {
      await api.put(`/forks/${fork.id}`, { title, language, code });
      onSaved({ ...fork, title, language, code });
      toast.success('اتحفظ ✓');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;

  async function remove() {
    if (!window.confirm(`حذف "${fork.title}"؟`)) return;
    await api.del(`/forks/${fork.id}`).catch(toast.error);
    onDeleted();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2">
        {/* Row 1 on mobile: Title input + delete button */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:contents">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 sm:max-w-xs"
            placeholder="اسم التجربة..."
          />
          <IconButton
            icon={Trash2}
            title="حذف"
            onClick={remove}
            className="shrink-0 text-muted hover:text-rose sm:hidden"
          />
        </div>

        {/* Row 2 on mobile: Language Select + actions (Run / Save / Desktop Trash) */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:contents">
          <div className="flex items-center gap-2">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-32 shrink-0 sm:w-36">
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
            {fork.lesson_id && (
              <Link
                to={`/lessons/${fork.lesson_id}?t=${fork.t_ms || 0}`}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"
              >
                <Play className="size-3.5 -scale-x-100" /> من الدرس عند {fmtTime(fork.t_ms)}
              </Link>
            )}
          </div>

          <div className="hidden sm:block sm:flex-1" />

          <div className="flex items-center gap-2">
            {info.runnable && (
              <Button size="sm" variant="mint" icon={Terminal} onClick={run} title="Ctrl+Enter">
                شغّل
              </Button>
            )}
            <Button size="sm" icon={Save} onClick={save} loading={saving} disabled={!dirty} title="Ctrl+S">
              حفظ
            </Button>
            <IconButton
              icon={Trash2}
              title="حذف"
              onClick={remove}
              className="hidden text-muted hover:text-rose sm:inline-flex"
            />
          </div>
        </div>
      </div>
      <div className="h-[50dvh] overflow-hidden rounded-2xl border border-line shadow-card lg:h-[55vh]">
        <CodeEditor
          path={`fork-${fork.id}`}
          language={language}
          defaultValue={fork.code}
          onChange={setCode}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
          }}
        />
      </div>
      {info.preview ? <OutputPanel html={code} className="h-56" /> : <OutputPanel lines={output?.lines} ms={output?.ms} className="h-40" />}
    </div>
  );
}

export default function Sandbox() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [current, setCurrent] = useState(null);

  const loadList = () => api.get('/forks').then(setList).catch(toast.error);
  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!id && list && list.length > 0) {
      navigate(`/sandbox/${list[0].id}`, { replace: true });
    }
  }, [id, list, navigate]);

  useEffect(() => {
    setCurrent(null);
    if (!id) return;
    api.get(`/forks/${id}`).then(setCurrent).catch((err) => {
      toast.error(err);
      navigate('/sandbox', { replace: true });
    });
  }, [id, navigate]);

  async function create() {
    try {
      const { id: newId } = await api.post('/forks', { title: 'تجربة جديدة', language: 'javascript', code: STARTERS.javascript });
      await loadList();
      navigate(`/sandbox/${newId}`);
    } catch (err) {
      toast.error(err);
    }
  }

  if (!list) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="الملعب"
        subtitle="هنا نسخ الكود اللي خدتها من الدروس (Fork) وتجاربك الخاصة."
        actions={
          <Button icon={Plus} onClick={create}>
            ملف جديد
          </Button>
        }
      />
      {list.length === 0 ? (
        <Empty
          icon={FlaskConical}
          title="الملعب فاضي"
          text="وانت بتتفرج على أي درس، أوقفه واضغط زرار Fork عشان تاخد نسخة من الكود عند اللحظة دي."
          action={
            <Button icon={Plus} onClick={create}>
              ابدأ تجربة
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <Card className="h-fit w-full shrink-0 p-1.5 lg:w-64 lg:p-2">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
              {list.map((f) => {
                const active = String(f.id) === id;
                return (
                  <Link
                    key={f.id}
                    to={`/sandbox/${f.id}`}
                    className={cx(
                      'shrink-0 rounded-xl px-3 py-2 transition lg:w-full lg:rounded-lg lg:py-2.5',
                      active ? 'bg-brand/15 font-medium text-brand shadow-xs' : 'text-ink hover:bg-panel-2',
                    )}
                  >
                    <p className="max-w-40 truncate text-sm font-medium lg:max-w-none">{f.title}</p>
                    <p className={cx('truncate text-[11px]', active ? 'text-brand/80' : 'text-muted')}>
                      {langInfo(f.language).label} · {fmtRelative(f.updated_at)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </Card>
          {current ? (
            <Workspace
              key={current.id}
              fork={current}
              onSaved={(f) => {
                setCurrent(f);
                loadList();
              }}
              onDeleted={() => {
                loadList();
                navigate('/sandbox');
              }}
            />
          ) : id ? (
            <PageLoader />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line p-10 text-sm text-muted">اختار ملف من القائمة</div>
          )}
        </div>
      )}
    </>
  );
}
