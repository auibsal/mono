"use client";

import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { cn } from "@repo/design-system/lib/utils";
import {
  type Editor,
  EditorContent,
  type Extensions,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface RichTextProps {
  /** Accessible name of the editing area (usually the field label). */
  readonly label: string;
  readonly lang: "en" | "ar";
  readonly onChange: (html: string) => void;
  /** Initial HTML (sanitised on save, and again when rendered). */
  readonly value: string;
}

/** A URL scheme, the same in both languages. */
const URL_PLACEHOLDER = "https://";

const starterKit = (collaborative: boolean) =>
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: {
      autolink: true,
      defaultProtocol: "https",
      openOnClick: false,
      protocols: ["https", "mailto"],
    },
    // Liveblocks keeps the shared history when co-editing.
    ...(collaborative ? { undoRedo: false } : {}),
  });

const ToolbarButton = ({
  active = false,
  children,
  onClick,
}: {
  active?: boolean;
  children: string;
  onClick: () => void;
}) => (
  <Button
    aria-pressed={active}
    className={cn(
      "h-7 px-2 text-xs",
      active && "bg-surface-tint font-bold text-title"
    )}
    onClick={onClick}
    size="sm"
    type="button"
    variant="ghost"
  >
    {children}
  </Button>
);

/** Formatting in words, not icons (the brand has no icon set). */
const Toolbar = ({ editor, undo }: { editor: Editor; undo: boolean }) => {
  const t = useTranslations("nexus.editor");
  const tc = useTranslations("common");
  const [href, setHref] = useState<string | null>(null);
  const chain = () => editor.chain().focus();

  const applyLink = () => {
    const value = href?.trim();
    if (value) {
      chain().extendMarkRange("link").setLink({ href: value }).run();
    }
    setHref(null);
  };

  return (
    <div className="border-rule border-b">
      <div
        aria-label={t("toolbar")}
        className="flex flex-wrap gap-1 p-1"
        role="toolbar"
      >
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => chain().toggleBold().run()}
        >
          {t("bold")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => chain().toggleItalic().run()}
        >
          {t("italic")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          {t("heading")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          {t("subheading")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => chain().toggleBulletList().run()}
        >
          {t("bullets")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => chain().toggleOrderedList().run()}
        >
          {t("numbers")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => chain().toggleBlockquote().run()}
        >
          {t("quote")}
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() =>
            setHref(editor.getAttributes("link").href ?? "https://")
          }
        >
          {t("link")}
        </ToolbarButton>
        {editor.isActive("link") ? (
          <ToolbarButton onClick={() => chain().unsetLink().run()}>
            {t("unlink")}
          </ToolbarButton>
        ) : null}
        {undo ? (
          <>
            <ToolbarButton onClick={() => chain().undo().run()}>
              {t("undo")}
            </ToolbarButton>
            <ToolbarButton onClick={() => chain().redo().run()}>
              {t("redo")}
            </ToolbarButton>
          </>
        ) : null}
      </div>
      {href === null ? null : (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          <Input
            aria-label={t("linkPrompt")}
            autoFocus
            className="h-8 max-w-sm"
            dir="ltr"
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                setHref(null);
              }
            }}
            placeholder={URL_PLACEHOLDER}
            type="url"
            value={href}
          />
          <Button onClick={applyLink} size="sm" type="button">
            {t("link")}
          </Button>
          <Button
            onClick={() => setHref(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {tc("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
};

const Frame = ({
  editor,
  label,
  lang,
  undo,
}: {
  editor: Editor | null;
  label: string;
  lang: "en" | "ar";
  undo: boolean;
}) => (
  <div
    className="rounded-md border border-input bg-surface"
    dir={lang === "ar" ? "rtl" : "ltr"}
    lang={lang}
  >
    {editor ? <Toolbar editor={editor} undo={undo} /> : null}
    <EditorContent aria-label={label} editor={editor} />
  </div>
);

const useBaseEditor = (
  { label, lang, onChange, value }: RichTextProps,
  extensions: Extensions,
  withContent: boolean
) =>
  useEditor({
    content: withContent ? value : undefined,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: "prose max-w-none min-h-40 px-3 py-2 focus:outline-none",
        dir: lang === "ar" ? "rtl" : "ltr",
        lang,
        role: "textbox",
      },
    },
    extensions,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

/** A rich-text field for one language, edited alone. */
export const RichTextEditor = (props: RichTextProps) => {
  const editor = useBaseEditor(props, [starterKit(false)], true);
  return <Frame editor={editor} label={props.label} lang={props.lang} undo />;
};

/**
 * The same field co-edited live (inside a collaboration Room). The room's
 * draft starts from the saved HTML; Save still writes to Postgres.
 */
export const CollaborativeRichTextEditor = (
  props: RichTextProps & { field: string }
) => {
  const liveblocks = useLiveblocksExtension({
    field: props.field,
    initialContent: props.value,
  });
  const editor = useBaseEditor(props, [liveblocks, starterKit(true)], false);
  return (
    <Frame editor={editor} label={props.label} lang={props.lang} undo={false} />
  );
};
