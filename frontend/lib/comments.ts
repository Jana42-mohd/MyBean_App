import { supabase } from './supabase';

// Comments and replies under community posts (rules in supabase/migrations/0018_comments.sql).

export interface CommentRow {
  id: string;
  parent_id: string | null;
  user_id: string | null;
  author: string | null;
  avatar_url: string | null;
  body: string;
  created_at: string;
  likes: number;
  liked: boolean;
  mine: boolean;
  hidden: boolean;   // reported three times: only its author and moderators still see it
  deleted: boolean;  // "[deleted]" placeholder kept because others replied to it
}

export type CommentSort = 'top' | 'new' | 'old';
export const MAX_INDENT = 4; // replies deeper than this are shown at the same indent (the thread itself can go 6 levels)
export const COMMENT_MAX = 2000;

export const COMMENT_REPORT_REASONS = ['spam', 'harassment', 'medical misinformation', 'inappropriate', 'other'] as const;

export async function fetchComments(post: string): Promise<CommentRow[]> {
  const { data, error } = await supabase.rpc('post_comments_for', { post });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export async function addComment(post: string, parent: string | null, body: string) {
  const text = body.trim();
  if (!text) throw new Error('Write something first.');
  if (text.length > COMMENT_MAX) throw new Error(`Comments can be at most ${COMMENT_MAX} characters.`);
  const { error } = await supabase.from('post_comments').insert({ post_id: post, parent_id: parent, body: text });
  if (error) throw error;
}

export async function setCommentLike(comment: string, on: boolean) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error('Not signed in');
  const { error } = on
    ? await supabase.from('comment_likes').insert({ comment_id: comment, user_id: uid })
    : await supabase.from('comment_likes').delete().eq('comment_id', comment).eq('user_id', uid);
  if (error && error.code !== '23505') throw error; // already liked: fine
}

export async function deleteComment(comment: string) {
  const { error } = await supabase.rpc('delete_comment', { c: comment });
  if (error) throw error;
}

export async function reportComment(comment: string, reason: string) {
  const { error } = await supabase.from('comment_reports').insert({ comment_id: comment, reason });
  if (error && error.code !== '23505') throw error; // already reported by this person: fine
}

// ---- turning the flat list into a thread ----
export interface ThreadNode {
  row: CommentRow;
  children: ThreadNode[];
}

const bySort = (sort: CommentSort, topLevel: boolean) => (a: ThreadNode, b: ThreadNode) => {
  // replies read best oldest-first, whatever the top-level order is
  if (!topLevel || sort === 'old') return a.row.created_at < b.row.created_at ? -1 : 1;
  if (sort === 'new') return a.row.created_at < b.row.created_at ? 1 : -1;
  return b.row.likes - a.row.likes || (a.row.created_at < b.row.created_at ? -1 : 1);
};

// A reply whose parent is not in the list (hidden by reports, or its author blocked) is shown as a top-level comment
export function buildThread(rows: CommentRow[], sort: CommentSort): ThreadNode[] {
  const nodes = new Map<string, ThreadNode>(rows.map(r => [r.id, { row: r, children: [] }]));
  const roots: ThreadNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.row.parent_id ? nodes.get(n.row.parent_id) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  const order = (list: ThreadNode[], top: boolean) => {
    list.sort(bySort(sort, top));
    list.forEach(n => order(n.children, false));
  };
  order(roots, true);
  return roots;
}

export interface FlatComment {
  row: CommentRow;
  indent: number;        // 0 for top-level, up to MAX_INDENT
  replies: number;       // how many comments sit below it (all levels)
  collapsed: boolean;
}

const count = (n: ThreadNode): number => n.children.reduce((s, c) => s + 1 + count(c), 0);

// Depth-first list for the screen; a collapsed comment hides everything under it
export function flattenThread(roots: ThreadNode[], collapsed: Set<string>): FlatComment[] {
  const out: FlatComment[] = [];
  const walk = (n: ThreadNode, depth: number) => {
    const isCollapsed = collapsed.has(n.row.id);
    out.push({ row: n.row, indent: Math.min(depth, MAX_INDENT), replies: count(n), collapsed: isCollapsed });
    if (!isCollapsed) n.children.forEach(c => walk(c, depth + 1));
  };
  roots.forEach(r => walk(r, 0));
  return out;
}
