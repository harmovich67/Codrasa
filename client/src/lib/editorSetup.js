import { emmetHTML, emmetCSS } from 'emmet-monaco-es';

/*
 * Editor intelligence shared by every CodeEditor: a color theme per language, instant suggestions,
 * snippets (HTML/JS/Python/...), Emmet for HTML+CSS and auto-closing HTML tags.
 */

// ---------- themes: each language gets its own palette (accent colors the cursor + selection too) ----------

const PALETTES = {
  html: { accent: '#ff7a45', tag: '#ff7a45', attr: '#ffd166', attrVal: '#7ee787', kw: '#c792ea', str: '#7ee787', num: '#f78c6c', type: '#ffd166', fn: '#82aaff', op: '#94a3b8', delim: '#7b8aa3', meta: '#c792ea' },
  css: { accent: '#4da3ff', tag: '#ff9e64', attr: '#7dcfff', attrVal: '#c3e88d', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', type: '#ffcb6b', fn: '#82aaff', op: '#89ddff', delim: '#7b8aa3', meta: '#c792ea' },
  javascript: { accent: '#f7df1e', tag: '#f07178', attr: '#ffcb6b', attrVal: '#c3e88d', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', type: '#ffcb6b', fn: '#82aaff', op: '#89ddff', delim: '#a6accd', meta: '#c792ea' },
  typescript: { accent: '#4a9eff', tag: '#f7768e', attr: '#e0af68', attrVal: '#9ece6a', kw: '#7aa2f7', str: '#9ece6a', num: '#ff9e64', type: '#2ac3de', fn: '#e0af68', op: '#89ddff', delim: '#a9b1d6', meta: '#bb9af7' },
  python: { accent: '#ffd43b', tag: '#ff7b72', attr: '#ffa657', attrVal: '#a5d6ff', kw: '#ff7b72', str: '#a5d6ff', num: '#79c0ff', type: '#ffa657', fn: '#d2a8ff', op: '#ff7b72', delim: '#c9d1d9', meta: '#d2a8ff' },
  java: { accent: '#f89820', tag: '#ff6b6b', attr: '#e5c07b', attrVal: '#98c379', kw: '#ff6b6b', str: '#98c379', num: '#d19a66', type: '#e5c07b', fn: '#61afef', op: '#56b6c2', delim: '#abb2bf', meta: '#c678dd' },
  cpp: { accent: '#659ad2', tag: '#569cd6', attr: '#9cdcfe', attrVal: '#ce9178', kw: '#569cd6', str: '#ce9178', num: '#b5cea8', type: '#4ec9b0', fn: '#dcdcaa', op: '#d4d4d4', delim: '#b0b0b0', meta: '#c586c0' },
  csharp: { accent: '#a179dc', tag: '#569cd6', attr: '#9cdcfe', attrVal: '#ce9178', kw: '#c586c0', str: '#ce9178', num: '#b5cea8', type: '#4ec9b0', fn: '#dcdcaa', op: '#d4d4d4', delim: '#b0b0b0', meta: '#c586c0' },
  php: { accent: '#8892bf', tag: '#f07178', attr: '#ffcb6b', attrVal: '#c3e88d', kw: '#f07178', str: '#c3e88d', num: '#f78c6c', type: '#ffcb6b', fn: '#82aaff', op: '#89ddff', delim: '#a6accd', meta: '#c792ea' },
  sql: { accent: '#2dd4a7', tag: '#4fc1ff', attr: '#9cdcfe', attrVal: '#ce9178', kw: '#4fc1ff', str: '#ce9178', num: '#b5cea8', type: '#4ec9b0', fn: '#dcdcaa', op: '#d4d4d4', delim: '#b0b0b0', meta: '#c586c0' },
  json: { accent: '#cbcb41', tag: '#9cdcfe', attr: '#9cdcfe', attrVal: '#ce9178', kw: '#569cd6', str: '#ce9178', num: '#b5cea8', type: '#4ec9b0', fn: '#dcdcaa', op: '#d4d4d4', delim: '#808080', meta: '#c586c0' },
  markdown: { accent: '#4ec9b0', tag: '#4ec9b0', attr: '#9cdcfe', attrVal: '#ce9178', kw: '#4ec9b0', str: '#ce9178', num: '#b5cea8', type: '#c586c0', fn: '#dcdcaa', op: '#d4d4d4', delim: '#808080', meta: '#c586c0' },
};

export const themeFor = (language) => `codrasa-${PALETTES[language] ? language : 'javascript'}`;

const rule = (token, color, fontStyle) => ({ token, foreground: color.replace('#', ''), ...(fontStyle ? { fontStyle } : {}) });

function defineThemes(monaco) {
  for (const [id, p] of Object.entries(PALETTES)) {
    monaco.editor.defineTheme(`codrasa-${id}`, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        rule('comment', '#5c6b80', 'italic'),
        rule('keyword', p.kw),
        rule('keyword.json', p.kw),
        rule('string', p.str),
        rule('string.escape', p.accent),
        rule('number', p.num),
        rule('regexp', p.attr),
        rule('type', p.type),
        rule('type.identifier', p.type),
        rule('predefined', p.fn),
        rule('function', p.fn),
        rule('operator', p.op),
        rule('delimiter', p.delim),
        rule('delimiter.bracket', p.delim),
        rule('delimiter.html', p.delim),
        rule('tag', p.tag),
        rule('metatag', p.meta),
        rule('metatag.content', p.attr),
        rule('attribute.name', p.attr),
        rule('attribute.value', p.attrVal),
        rule('attribute.value.number', p.num),
        rule('attribute.value.unit', p.num),
        rule('attribute.value.hex', p.num),
        rule('variable', '#e7ecf3'),
        rule('annotation', p.meta),
        rule('constant', p.num),
        // JSON: keys and values read differently.
        rule('string.key', p.attr),
        rule('string.value', p.str),
        // Markdown
        rule('strong', p.num, 'bold'),
        rule('emphasis', p.meta, 'italic'),
        rule('keyword.md', p.kw, 'bold'),
        rule('string.link', p.fn, 'underline'),
      ],
      colors: {
        'editor.background': '#0d121b',
        'editor.lineHighlightBackground': '#161d2a',
        'editorLineNumber.foreground': '#3a465b',
        'editorLineNumber.activeForeground': p.accent,
        'editorCursor.foreground': p.accent,
        'editor.selectionBackground': `${p.accent}33`,
        'editor.inactiveSelectionBackground': `${p.accent}1f`,
        'editorBracketMatch.background': `${p.accent}22`,
        'editorBracketMatch.border': `${p.accent}88`,
        'editorIndentGuide.activeBackground1': `${p.accent}66`,
        // Bracket-pair colorization would otherwise paint every bracket the default gold/purple/blue.
        'editorBracketHighlight.foreground1': p.accent,
        'editorBracketHighlight.foreground2': p.kw,
        'editorBracketHighlight.foreground3': p.attr,
        'editorBracketHighlight.foreground4': p.fn,
        'editorBracketHighlight.foreground5': p.str,
        'editorBracketHighlight.foreground6': p.num,
        'editorSuggestWidget.background': '#10151f',
        'editorSuggestWidget.border': '#232c3d',
        'editorSuggestWidget.selectedBackground': `${p.accent}2a`,
        'editorSuggestWidget.highlightForeground': p.accent,
      },
    });
  }
}

// ---------- snippets ----------

const HTML5 = `<!DOCTYPE html>
<html lang="\${1:ar}" dir="\${2:rtl}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>\${3:عنوان الصفحة}</title>
  </head>
  <body>
    $0
  </body>
</html>
`;

// [trigger, description, body] — bodies use Monaco snippet syntax ($1 tab stops, ${2:placeholder}, $0 final).
const SNIPPETS = {
  html: [
    ['html5', 'هيكل صفحة HTML كامل', HTML5],
    ['html', 'هيكل صفحة HTML كامل', HTML5],
    ['doc', 'هيكل صفحة HTML كامل', HTML5],
    ['!', 'هيكل صفحة HTML كامل', HTML5],
    ['link:css', 'ربط ملف CSS', '<link rel="stylesheet" href="${1:style.css}" />'],
    ['script:src', 'ربط ملف JavaScript', '<script src="${1:app.js}"></script>'],
    ['scriptb', 'وسم script بكود', '<script>\n  $0\n</script>'],
    ['styleb', 'وسم style بكود', '<style>\n  $0\n</style>'],
    ['form', 'نموذج بسيط', '<form action="${1:#}" method="${2:post}">\n  <label for="${3:name}">${4:الاسم}</label>\n  <input type="${5:text}" id="${3:name}" name="${3:name}" />\n  <button type="submit">${6:إرسال}</button>\n</form>'],
    ['table', 'جدول', '<table>\n  <thead>\n    <tr>\n      <th>${1:العمود}</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>${2:قيمة}</td>\n    </tr>\n  </tbody>\n</table>'],
    ['nav', 'شريط تنقل', '<nav>\n  <ul>\n    <li><a href="${1:#}">${2:الرئيسية}</a></li>\n    <li><a href="${3:#}">${4:عن}</a></li>\n  </ul>\n</nav>'],
    ['card', 'بطاقة', '<div class="card">\n  <h2>${1:العنوان}</h2>\n  <p>${2:الوصف}</p>\n</div>'],
  ],
  javascript: [
    ['log', 'console.log', "console.log(${1:'قيمة'});"],
    ['clg', 'console.log', "console.log(${1:'قيمة'});"],
    ['for', 'حلقة for', 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n  $0\n}'],
    ['forof', 'حلقة for...of', 'for (const ${1:item} of ${2:items}) {\n  $0\n}'],
    ['foreach', 'forEach', '${1:items}.forEach((${2:item}) => {\n  $0\n});'],
    ['map', 'map', 'const ${1:result} = ${2:items}.map((${3:item}) => $0);'],
    ['filter', 'filter', 'const ${1:result} = ${2:items}.filter((${3:item}) => $0);'],
    ['reduce', 'reduce', 'const ${1:total} = ${2:items}.reduce((${3:acc}, ${4:item}) => $0, ${5:0});'],
    ['fn', 'دالة', 'function ${1:name}(${2:params}) {\n  $0\n}'],
    ['afn', 'دالة سهمية', 'const ${1:name} = (${2:params}) => {\n  $0\n};'],
    ['if', 'if', 'if (${1:condition}) {\n  $0\n}'],
    ['ifelse', 'if / else', 'if (${1:condition}) {\n  $2\n} else {\n  $0\n}'],
    ['switch', 'switch', 'switch (${1:value}) {\n  case ${2:x}:\n    $0\n    break;\n  default:\n    break;\n}'],
    ['try', 'try / catch', 'try {\n  $1\n} catch (${2:error}) {\n  console.error(${2:error});\n}'],
    ['class', 'كلاس', 'class ${1:Name} {\n  constructor(${2:params}) {\n    $0\n  }\n}'],
    ['fetch', 'طلب fetch', "const ${1:res} = await fetch('${2:/api}');\nconst ${3:data} = await ${1:res}.json();"],
    ['timeout', 'setTimeout', 'setTimeout(() => {\n  $0\n}, ${1:1000});'],
    ['promise', 'Promise', 'new Promise((resolve, reject) => {\n  $0\n});'],
    ['qs', 'querySelector', "document.querySelector('${1:.selector}')"],
    ['onclick', 'addEventListener click', "${1:element}.addEventListener('click', (${2:e}) => {\n  $0\n});"],
    ['prompt', 'prompt', "const ${1:name} = prompt('${2:اكتب شيئًا}');"],
    ['alert', 'alert', "alert('${1:رسالة}');"],
  ],
  python: [
    ['print', 'print', 'print(${1:"نص"})'],
    ['def', 'دالة', 'def ${1:name}(${2:params}):\n    ${0:pass}'],
    ['class', 'كلاس', 'class ${1:Name}:\n    def __init__(self${2:, params}):\n        ${0:pass}'],
    ['for', 'حلقة for', 'for ${1:item} in ${2:items}:\n    $0'],
    ['forr', 'for + range', 'for ${1:i} in range(${2:10}):\n    $0'],
    ['while', 'while', 'while ${1:condition}:\n    $0'],
    ['if', 'if', 'if ${1:condition}:\n    $0'],
    ['ifelse', 'if / else', 'if ${1:condition}:\n    $2\nelse:\n    $0'],
    ['try', 'try / except', 'try:\n    $1\nexcept ${2:Exception} as ${3:e}:\n    ${0:print(e)}'],
    ['with', 'فتح ملف', 'with open(${1:"file.txt"}, ${2:"r"}) as ${3:f}:\n    $0'],
    ['main', 'نقطة البداية', 'if __name__ == "__main__":\n    ${0:main()}'],
    ['input', 'input', '${1:name} = input(${2:"اكتب: "})'],
    ['lc', 'List comprehension', '[${1:x} for ${1:x} in ${2:items}${3: if ${4:condition}}]'],
  ],
  css: [
    ['flexc', 'تمركز بـ flex', 'display: flex;\njustify-content: center;\nalign-items: center;'],
    ['grid', 'شبكة grid', 'display: grid;\ngrid-template-columns: repeat(${1:3}, 1fr);\ngap: ${2:1rem};'],
    ['media', 'Media query', '@media (max-width: ${1:768px}) {\n  $0\n}'],
    ['keyframes', 'Keyframes', '@keyframes ${1:name} {\n  from {\n    $2\n  }\n  to {\n    $0\n  }\n}'],
    ['reset', 'Reset', '* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}'],
    ['absc', 'تمركز absolute', 'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);'],
    ['transition', 'Transition', 'transition: ${1:all} ${2:0.3s} ${3:ease};'],
  ],
  java: [
    ['main', 'main', 'public static void main(String[] args) {\n    $0\n}'],
    ['sout', 'System.out.println', 'System.out.println(${1:"نص"});'],
    ['for', 'for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    $0\n}'],
    ['class', 'class', 'public class ${1:Main} {\n    $0\n}'],
    ['if', 'if', 'if (${1:condition}) {\n    $0\n}'],
    ['try', 'try / catch', 'try {\n    $1\n} catch (${2:Exception} e) {\n    $0\n}'],
  ],
  cpp: [
    ['main', 'main مع iostream', '#include <iostream>\nusing namespace std;\n\nint main() {\n    $0\n    return 0;\n}'],
    ['cout', 'cout', 'cout << ${1:"نص"} << endl;'],
    ['cin', 'cin', 'cin >> ${1:variable};'],
    ['for', 'for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    $0\n}'],
    ['class', 'class', 'class ${1:Name} {\npublic:\n    $0\n};'],
  ],
  csharp: [
    ['main', 'Main', 'static void Main(string[] args)\n{\n    $0\n}'],
    ['cw', 'Console.WriteLine', 'Console.WriteLine(${1:"نص"});'],
    ['for', 'for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    $0\n}'],
    ['class', 'class', 'public class ${1:Name}\n{\n    $0\n}'],
  ],
  php: [
    ['php', 'وسم PHP', '<?php\n$0\n?>'],
    ['echo', 'echo', 'echo ${1:"نص"};'],
    ['foreach', 'foreach', 'foreach ($${1:items} as $${2:item}) {\n    $0\n}'],
    ['function', 'دالة', 'function ${1:name}(${2:$params}) {\n    $0\n}'],
    ['class', 'class', 'class ${1:Name} {\n    $0\n}'],
  ],
  sql: [
    ['select', 'SELECT', 'SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};'],
    ['insert', 'INSERT', 'INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});'],
    ['update', 'UPDATE', 'UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};'],
    ['delete', 'DELETE', 'DELETE FROM ${1:table}\nWHERE ${2:condition};'],
    ['create', 'CREATE TABLE', 'CREATE TABLE ${1:table} (\n  id INTEGER PRIMARY KEY,\n  ${2:name} TEXT NOT NULL\n);'],
    ['join', 'JOIN', 'SELECT ${1:*}\nFROM ${2:a}\nJOIN ${3:b} ON ${3:b}.${4:a_id} = ${2:a}.id;'],
  ],
};
SNIPPETS.typescript = [...SNIPPETS.javascript];

function registerSnippets(monaco) {
  for (const [language, items] of Object.entries(SNIPPETS)) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: language === 'html' ? ['!'] : undefined,
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        // After a "." the user wants a member (console.log), never a snippet that would nest inside it.
        if (language !== 'css' && model.getLineContent(position.lineNumber)[word.startColumn - 2] === '.') return { suggestions: [] };
        let startColumn = word.startColumn;
        // "!" isn't a word character, so extend the replaced range to swallow it.
        if (language === 'html' && model.getLineContent(position.lineNumber)[startColumn - 2] === '!') startColumn -= 1;
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn, endColumn: word.endColumn };
        return {
          suggestions: items.map(([label, documentation, insertText]) => ({
            label: { label, description: documentation },
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: { value: '```\n' + insertText.replace(/\$\{\d+:?([^}]*)\}|\$\d/g, '$1') + '\n```' },
            insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: label,
            sortText: '0' + label, // snippets float to the top
            range,
          })),
        };
      },
    });
  }
}

// ---------- auto-closing HTML tags ----------

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype']);

/* Typing the ">" of <div class="x"> also inserts </div> and leaves the cursor between them. */
export function attachAutoCloseTags(editor) {
  return editor.onDidType((text) => {
    if (text !== '>' || editor.getModel()?.getLanguageId() !== 'html') return;
    const pos = editor.getPosition();
    const before = editor.getModel().getLineContent(pos.lineNumber).slice(0, pos.column - 1);
    const m = before.match(/<([A-Za-z][\w:-]*)(?:\s[^<>]*)?>$/);
    if (!m || before.endsWith('/>') || VOID_TAGS.has(m[1].toLowerCase())) return;
    const after = editor.getModel().getLineContent(pos.lineNumber).slice(pos.column - 1);
    if (after.startsWith(`</${m[1]}>`)) return;
    editor.executeEdits('autoclose-tag', [{ range: { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: pos.column, endColumn: pos.column }, text: `</${m[1]}>` }]);
    editor.setPosition(pos);
  });
}

// ---------- entry points ----------

let ready = false;

export function setupMonaco(monaco) {
  if (ready) return;
  ready = true;
  defineThemes(monaco);
  registerSnippets(monaco);
  emmetHTML(monaco, ['html']);
  emmetCSS(monaco, ['css']);
}

export const EDITOR_OPTIONS = {
  // Strings stay off so typing text never pops a menu; HTML attribute values still open via their trigger characters.
  quickSuggestions: { other: 'on', comments: 'off', strings: 'off' },
  quickSuggestionsDelay: 0,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  acceptSuggestionOnCommitCharacter: true,
  tabCompletion: 'on',
  snippetSuggestions: 'top',
  suggestSelection: 'first',
  wordBasedSuggestions: 'currentDocument',
  parameterHints: { enabled: true },
  suggest: { showSnippets: true, showWords: true, preview: true, showIcons: true, insertMode: 'replace' },
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoClosingOvertype: 'always',
  autoSurround: 'languageDefined',
  linkedEditing: true,
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  formatOnPaste: true,
};
