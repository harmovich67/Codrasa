import { Router } from 'express';
import { Type } from '@google/genai';
import { get } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { loadLessonFor } from '../access.js';
import { getAI, modelFor, aiError, checkQuota, bumpQuota, aiEnabledFor } from '../ai.js';
import { codeAt } from '../recording.js';
import { checkpointRevision } from '../checkpoints.js';
import { HttpError, httpError, toInt, parseJSON } from '../utils.js';

const r = Router();
r.use(requireAuth);

const mmss = (ms) => {
  const s = Math.floor((ms || 0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function lessonContext(lesson, { withNotes = false } = {}) {
  const board = lesson.kind === 'board';
  const parts = [`الكورس: ${lesson.course_title}`, ...(lesson.subject_name ? [`المادة: ${lesson.subject_name}`] : []), `الدرس: ${lesson.title}`, board ? 'الدرس يُشرح على سبورة رقمية (رسم وكتابة بخط اليد) وليس بالكود' : `اللغة: ${lesson.language}`];
  if (lesson.description) parts.push(`وصف الدرس:\n${lesson.description}`);
  if (lesson.summary) parts.push(`ملخص الدرس:\n${lesson.summary}`);
  if (withNotes && lesson.notes) parts.push(`ملاحظات المدرّس (سكريبت الشرح):\n${lesson.notes}`);
  return parts.join('\n\n');
}

const fence = (lang, code) => '```' + lang + '\n' + (code || '// (فارغ)') + '\n```';

// "Help me without solving it for me": each level reveals a bit more, and only the last one gives the answer.
const HELP_LEVELS = {
  hint: 'تلميح فقط: جملتان أو ثلاث تشير للمفهوم أو الجزء الذي يجب أن ينظر إليه الطالب. ممنوع كتابة حل أو سطر كود جاهز.',
  guide: 'اطرح على الطالب سؤالين أو ثلاثة متدرجين يقودونه للحل بنفسه، سؤال في كل سطر. ممنوع إعطاء الحل أو كشف الإجابة الصحيحة.',
  explain: 'اشرح بالتحديد لماذا فشلت محاولته الأخيرة (من الكود والناتج الظاهرين) وما الذي يجب أن يفهمه، دون أن تكتب الحل الكامل. يمكنك الإشارة للسطر المقصود.',
  solution: 'اعرض الحل الكامل الآن مع شرح مختصر لكل خطوة، ثم اذكر الفكرة التي كان عليه أن يلتقطها ليحلّه وحده المرة القادمة.',
};

function checkpointContext(checkpoint) {
  const lines = [`\nالطالب يحاول الآن حل تحدٍّ داخل الدرس: "${checkpoint.title}" (مهارة: ${checkpoint.skill}).`, `نص التحدي:\n${checkpoint.prompt}`];
  if (checkpoint.type === 'choice') {
    lines.push(`الاختيارات:\n${checkpoint.options.map((option, i) => `${i + 1}. ${option}`).join('\n')}`);
    lines.push(`(سري — لا تكشفه إلا في مستوى الحل) الإجابة الصحيحة: ${checkpoint.answer + 1}`);
  } else {
    lines.push(`(سري — لا تكشفه إلا في مستوى الحل) الناتج المطلوب من الكود:\n${fence('text', checkpoint.expected_output)}`);
  }
  return lines.join('\n');
}

async function generate(model, prompt, config = {}) {
  try {
    const res = await getAI().models.generateContent({ model, contents: prompt, config });
    return res.text || '';
  } catch (err) {
    throw err instanceof HttpError ? err : aiError(err);
  }
}

// Student/teacher chat about the exact moment of a lesson — streamed as plain text.
r.post('/chat', async (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.body.lessonId));
  if (req.user.role !== 'teacher' && !aiEnabledFor(lesson)) throw httpError(403, 'المدرّس أوقف المساعد الذكي في الدرس ده');
  checkQuota(req.user);
  const model = modelFor(req.body.tier, req.user);
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .slice(-20)
    .filter((m) => m?.content)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 8000) }] }));
  if (!history.length || history.at(-1).role !== 'user') throw httpError(400, 'الرسالة فارغة');

  const helpLevel = HELP_LEVELS[req.body.helpLevel] ? req.body.helpLevel : null;
  const checkpoint = req.body.checkpointId ? parseJSON(lesson.checkpoints, []).find((c) => c.id === req.body.checkpointId) : null;
  if (helpLevel === 'solution' && !checkpoint) throw httpError(400, 'الحل متاح داخل التحديات فقط');
  if (helpLevel === 'solution' && req.user.role !== 'teacher') {
    const attempt = get(
      'SELECT attempts, passed FROM checkpoint_attempts WHERE user_id = ? AND lesson_id = ? AND checkpoint_id = ? AND revision = ?',
      req.user.id, lesson.id, checkpoint.id, checkpointRevision(checkpoint),
    );
    if (!attempt?.passed && (attempt?.attempts || 0) < 2) throw httpError(403, 'جرّب التحدي مرتين على الأقل قبل ما تطلب الحل');
  }

  const systemInstruction = [
    'أنت "مساعد Codrasa"، مساعد تعليمي داخل منصة دروس برمجة تفاعلية.',
    'الطالب يشاهد درسًا مسجّلًا كجلسة كود حية، وأنت ترى الكود كما هو في اللحظة التي يشاهدها الآن.',
    'أجب بالعربية بلغة بسيطة ومباشرة، واكتب الكود والمصطلحات التقنية بالإنجليزية داخل code blocks.',
    'وجّه الطالب للفهم خطوة بخطوة، ولو طلب حل تمرين كامل أعطه تلميحات أولًا.',
    'التزم بموضوع الدرس والبرمجة، ولا تخترع معلومات عن الدرس غير الموجودة في السياق.',
    '',
    lessonContext(lesson),
    '',
    lesson.kind === 'board'
      ? `الطالب الآن عند اللحظة ${mmss(req.body.t_ms)} من الدرس. لا ترى محتوى السبورة نفسه، فاعتمد على وصف الدرس وملخصه وعلى ما كتبه المدرّس، ولا تخترع ما رسمه.`
      : `الكود عند اللحظة ${mmss(req.body.t_ms)} من الدرس:`,
    lesson.kind === 'board' ? '' : fence(lesson.language, String(req.body.code || '').slice(0, 30000)),
    req.body.line && lesson.kind !== 'board' ? `المؤشر الآن على السطر ${toInt(req.body.line)}.` : '',
    req.body.output ? `ناتج آخر تشغيل:\n${fence('text', String(req.body.output).slice(0, 4000))}` : '',
    checkpoint ? checkpointContext(checkpoint) : '',
    helpLevel ? `\nمستوى المساعدة المطلوب الآن:\n${HELP_LEVELS[helpLevel]}` : '',
  ].join('\n');

  let stream;
  try {
    stream = await getAI().models.generateContentStream({ model, contents: history, config: { systemInstruction } });
  } catch (err) {
    throw err instanceof HttpError ? err : aiError(err);
  }
  bumpQuota(req.user);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Model', model);
  try {
    for await (const chunk of stream) {
      if (chunk.text) res.write(chunk.text);
    }
  } catch (err) {
    res.write(`\n\n⚠️ انقطع الرد: ${err.message}`);
  }
  res.end();
});

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          q: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.INTEGER },
          explain: { type: Type.STRING },
        },
        required: ['q', 'options', 'answer', 'explain'],
      },
    },
  },
  required: ['questions'],
};

// Teacher tools: lesson summary and quiz generation.
r.post('/generate', requireTeacher, async (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.body.lessonId));
  const finalCode = lesson.kind === 'board' ? '' : codeAt(parseJSON(lesson.recording));
  const context =
    lesson.kind === 'board'
      ? lessonContext(lesson, { withNotes: true })
      : `${lessonContext(lesson, { withNotes: true })}\n\nالكود النهائي للدرس:\n${fence(lesson.language, finalCode.slice(0, 30000))}`;
  const model = modelFor(req.body.tier || 'smart', req.user);

  if (req.body.kind === 'summary') {
    const text = await generate(
      model,
      `${context}\n\nاكتب ملخصًا تعليميًا لهذا الدرس بالعربية بصيغة Markdown: فقرة افتتاحية قصيرة، ثم "ماذا ستتعلم" كنقاط، ثم أهم المفاهيم مع أمثلة كود قصيرة، ثم "أخطاء شائعة". لا تزد عن 350 كلمة.`,
    );
    return res.json({ summary: text.trim(), model });
  }

  // The short blurb students see above the lesson.
  if (req.body.kind === 'description') {
    const text = await generate(
      model,
      `${context}\n\nاكتب وصفًا قصيرًا لهذا الدرس يظهر للطالب قبل أن يبدأ: جملتان إلى ثلاث (حتى 60 كلمة) توضح ماذا سيتعلم وفيم سيفيده. بالعربية البسيطة، نص عادي بلا عناوين ولا Markdown ولا قوائم. لا تخترع محتوى غير موجود في الدرس. لو كان هناك وصف حالي فحسّنه واحتفظ بفكرته. أخرج نص الوصف فقط.`,
    );
    return res.json({ description: text.trim(), model });
  }

  // The teacher's private teleprompter script, read aloud while recording.
  if (req.body.kind === 'script') {
    const text = await generate(
      model,
      `${context}\n\nاكتب سكريبت شرح (تلقين) للمدرّس يقرؤه ويتحدث به أثناء تسجيل هذا الدرس كجلسة كود حية. اكتبه بلغة بسيطة مناسبة للكلام بصوت عالٍ (عامية مصرية خفيفة)، ورتّبه هكذا:\n1) جملة افتتاحية قصيرة تعرّف الطالب بما سيتعلمه.\n2) من 5 إلى 8 خطوات مرقّمة بالترتيب الذي سيُكتب به الكود في التسجيل. في كل خطوة: ماذا يقول المدرّس في سطر أو اثنين، وإن لزم كتابة كود فاكتبه في سطر مستقل يبدأ بـ «⌨️ اكتب:» ثم الكود كما هو.\n3) ضع «⏸ وقفة:» مع سؤال قصير للطالب بعد أهم فكرتين أو ثلاث.\n4) جملة ختام تلخّص الفكرة وتشير للتحدي أو الخطوة التالية.\nالنص سيظهر خامًا بجانب المدرّس، فلا تستخدم Markdown (لا # ولا ** ولا backticks). لا تتجاوز 350 كلمة، ولا تخترع شيئًا خارج موضوع الدرس. لو كانت هناك مسودة في ملاحظات المدرّس فطوّرها وحافظ على نقاطها وترتيبها. أخرج السكريبت فقط.`,
    );
    return res.json({ notes: text.trim(), model });
  }

  if (req.body.kind === 'quiz') {
    const count = Math.min(15, Math.max(3, toInt(req.body.count) || 5));
    const text = await generate(
      model,
      `${context}\n\nأنشئ اختبارًا من ${count} أسئلة اختيار من متعدد بالعربية يقيس فهم هذا الدرس (وليس الحفظ). لكل سؤال 4 اختيارات، و answer هو رقم الاختيار الصحيح بدءًا من 0، و explain شرح قصير لسبب صحة الإجابة. يمكن أن يحتوي السؤال على كود قصير بين backticks.`,
      { responseMimeType: 'application/json', responseSchema: QUIZ_SCHEMA },
    );
    const parsed = parseJSON(text, {});
    const questions = (parsed.questions || []).filter(
      (q) => q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
    );
    if (!questions.length) throw httpError(502, 'لم يرجع Gemini اختبارًا صالحًا، جرّب مرة أخرى');
    return res.json({ quiz: questions, model });
  }

  throw httpError(400, 'نوع غير معروف');
});

// Drafts an answer to a student's question so the teacher can review and send it.
r.post('/draft-answer', requireTeacher, async (req, res) => {
  const q = get('SELECT * FROM questions WHERE id = ?', toInt(req.body.questionId));
  if (!q) throw httpError(404, 'السؤال غير موجود');
  const lesson = loadLessonFor(req.user, q.lesson_id);
  const text = await generate(
    modelFor(req.body.tier || 'smart', req.user),
    [
      lessonContext(lesson, { withNotes: true }),
      `\nسؤال الطالب عند اللحظة ${mmss(q.t_ms)}${q.line ? ` (السطر ${q.line})` : ''}:`,
      q.body,
      '\nالكود الذي كان أمامه:',
      fence(lesson.language, (q.code || '').slice(0, 20000)),
      '\nاكتب ردًا من المدرّس للطالب بالعربية: ودود ومختصر ودقيق، مع كود توضيحي إن لزم.',
    ].join('\n'),
  );
  res.json({ answer: text.trim() });
});

r.post('/test', requireTeacher, async (req, res) => {
  const model = modelFor(req.body.tier, req.user);
  const started = Date.now();
  const text = await generate(model, 'رد بكلمة واحدة: "جاهز"');
  res.json({ model, text: text.trim(), ms: Date.now() - started });
});

export default r;
