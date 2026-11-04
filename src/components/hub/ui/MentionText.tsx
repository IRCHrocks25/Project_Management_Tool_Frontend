/**
 * MentionText — renders Hub text: `@Name[[USER_ID:uuid]]` as an accent mention (links to the
 * person's timeline), http(s) URLs as links, `code` in backticks as inline code. Keeps line breaks.
 *
 *   <MentionText text={update.body} />
 *   <MentionText text={comment.body} inline />   // no pre-wrap block, for one-liners
 */
import React from 'react';
import { Link } from 'react-router-dom';

const TOKEN_RE = /@([^[\]@\n]+?)\[\[USER_ID:([^\]]+)\]\]|(https?:\/\/[^\s<>)\]]+)|`([^`\n]+)`/g;

export interface MentionTextProps {
  text: string | null | undefined;
  inline?: boolean;
  className?: string;
}

const MentionText: React.FC<MentionTextProps> = ({ text, inline, className = '' }) => {
  const src = String(text || '');
  const parts: React.ReactNode[] = [];
  const re = new RegExp(TOKEN_RE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index));
    if (m[2]) {
      parts.push(
        <Link key={k++} to={`/timeline/${m[2]}`} className="hub-mention" onClick={(e) => e.stopPropagation()}>
          @{m[1]}
        </Link>,
      );
      last = re.lastIndex;
    } else if (m[3]) {
      const url = m[3].replace(/[.,;:!?]+$/, '');
      parts.push(
        <a key={k++} href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {url}
        </a>,
      );
      last = m.index + url.length;
      re.lastIndex = last;
    } else {
      parts.push(
        <code key={k++} className="hub-code">
          {m[4]}
        </code>,
      );
      last = re.lastIndex;
    }
  }
  if (last < src.length) parts.push(src.slice(last));
  return <span className={`${inline ? '' : 'hub-rich'} ${className}`.trim() || undefined}>{parts}</span>;
};

export default MentionText;
