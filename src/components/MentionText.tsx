import React from 'react';
import { Link } from 'react-router-dom';

/** Renders text with @Name[[USER_ID:uuid]] as clickable timeline links and URLs as clickable external links. */
const MENTION_REGEX = /@([^[\]]+)\[\[USER_ID:([^\]]+)\]\]/g;
// Match http/https URLs; trim trailing punctuation from the capture for cleaner links
const URL_REGEX = /https?:\/\/[^\s<>\)\]]+/g;

type Token = { index: number; end: number; type: 'mention'; name: string; userId: string } | { index: number; end: number; type: 'url'; url: string };

function collectTokens(text: string): Token[] {
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(text)) !== null) {
    tokens.push({ index: m.index, end: m.index + m[0].length, type: 'mention', name: m[1], userId: m[2] });
  }
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    let url = m[0];
    const trimmed = url.replace(/[.,;:!?)]+$/, '');
    if (trimmed !== url) url = trimmed;
    tokens.push({ index: m.index, end: m.index + m[0].length, type: 'url', url });
  }
  tokens.sort((a, b) => a.index - b.index);
  // drop overlapping tokens (same span or overlapping); keep earlier one
  const out: Token[] = [];
  for (const t of tokens) {
    if (out.length && t.index < out[out.length - 1].end) continue;
    out.push(t);
  }
  return out;
}

export interface MentionTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const MentionText: React.FC<MentionTextProps> = ({ text, className, style }) => {
  if (!text) return null;

  const tokens = collectTokens(text);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const token of tokens) {
    if (token.index > lastIndex) {
      parts.push(<span key={`t-${key++}`}>{text.substring(lastIndex, token.index)}</span>);
    }
    if (token.type === 'mention') {
      parts.push(
        <Link
          key={`m-${key++}`}
          to={`/timeline/${token.userId}`}
          className={className}
          style={{
            color: '#6366f1',
            fontWeight: 600,
            textDecoration: 'none',
            ...style,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          @{token.name}
        </Link>
      );
    } else {
      const url = token.url.replace(/[.,;:!?)]+$/, '');
      parts.push(
        <a
          key={`u-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: '#2563eb',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {url}
        </a>
      );
    }
    lastIndex = token.end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${key++}`}>{text.substring(lastIndex)}</span>);
  }

  return <span style={{ whiteSpace: 'pre-wrap' }}>{parts}</span>;
};

export default MentionText;
