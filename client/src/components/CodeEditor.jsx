import { useMemo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { Spinner } from './ui.jsx';
import { EDITOR_OPTIONS, attachAutoCloseTags, setupMonaco, themeFor } from '../lib/editorSetup.js';

// Pinned: the loader's default (0.55.x) throws "Token length and text length do not match!" while typing HTML.
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

const BASE_OPTIONS = {
  fontSize: 15,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 14, bottom: 14 },
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  renderLineHighlight: 'all',
  wordWrap: 'on',
  // Its async render throws "Illegal value for lineNumber" when the document shrinks (player seeks, select-all + type).
  stickyScroll: { enabled: false },
  ...EDITOR_OPTIONS,
};

/*
 * Uncontrolled on purpose: recorder/player drive the Monaco instance imperatively via onMount,
 * so pass `defaultValue` and use the editor API rather than a `value` prop.
 */
export default function CodeEditor({ defaultValue = '', language = 'javascript', readOnly = false, onChange, onMount, options, path }) {
  // Stable identity: the wrapper re-applies options on change, and the player re-renders every animation frame.
  const optionsKey = JSON.stringify(options || {});
  const merged = useMemo(() => ({ ...BASE_OPTIONS, readOnly, ...JSON.parse(optionsKey) }), [readOnly, optionsKey]);
  return (
    <div dir="ltr" className="h-full w-full">
      <Editor
        path={path}
        theme={themeFor(language)}
        language={language}
        defaultValue={defaultValue}
        beforeMount={setupMonaco}
        onMount={(editor, monaco) => {
          // Recordings store text offsets, so every editor must use the same line ending (Windows defaults to CRLF).
          // Monaco re-detects the EOL when text with CRLF is set, so re-assert LF after every change as well.
          const model = editor.getModel();
          if (model) {
            const LF = monaco.editor.EndOfLineSequence.LF;
            model.setEOL(LF);
            model.onDidChangeContent(() => model.getEOL() !== '\n' && model.setEOL(LF));
          }
          attachAutoCloseTags(editor);
          onMount?.(editor, monaco);
        }}
        onChange={(v) => onChange?.(v ?? '')}
        loading={<Spinner />}
        options={merged}
      />
    </div>
  );
}
