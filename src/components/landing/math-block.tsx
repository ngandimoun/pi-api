import katex from "katex";

interface MathBlockProps {
  expression: string;
  display?: boolean;
  className?: string;
}

export function MathBlock({ expression, display = false, className = "" }: MathBlockProps) {
  const html = katex.renderToString(expression, {
    throwOnError: false,
    displayMode: display,
  });

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
