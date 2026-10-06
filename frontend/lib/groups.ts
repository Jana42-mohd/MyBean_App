import { supabase } from './supabase';
import { ChatMessage } from './neighbors';

// Small group chats between parents who are already connected (rules live in supabase/migrations/0013_groups.sql).

export const MAX_GROUP_SIZE = 8;

export interface Group {
  id: string;
  name: string;
  status: 'invited' | 'member';
  is_creator: boolean;
  member_count: number;
  invited_by_name: string | null;
  last_message_at: string | null;
  muted: boolean;
}

export interface GroupPerson {
  user_id: string;
  name: string;
  avatar_url: string | null;
  status: 'invited' | 'member';
  is_creator: boolean;
}

export async function myGroups(): Promise<Group[]> {
  const { data, error } = await supabase.rpc('my_groups');
  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function groupPeople(group: string): Promise<GroupPerson[]> {
  const { data, error } = await supabase.rpc('group_people', { g: group });
  if (error) throw error;
  return (data ?? []) as GroupPerson[];
}

export async function createGroup(name: string, invitees: string[]): Promise<string> {
  const title = name.trim();
  if (!title) throw new Error('Give the group a name.');
  if (title.length > 40) throw new Error('The name can be at most 40 characters.');
  if (invitees.length === 0) throw new Error('Choose at least one parent to invite.');
  if (invitees.length > MAX_GROUP_SIZE - 1) throw new Error(`A group can have at most ${MAX_GROUP_SIZE} people, including you.`);
  const { data, error } = await supabase.rpc('create_group', { group_name: title, invitees });
  if (error) throw error;
  return data as string;
}

const call = (name: string, args: Record<string, any>) => async () => {
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
};
export const inviteToGroup = (g: string, target: string) => call('invite_to_group', { g, target })();
export const respondGroupInvite = (g: string, accept: boolean) => call('respond_group_invite', { g, accept })();
export const leaveGroup = (g: string) => call('leave_group', { g })();
export const removeFromGroup = (g: string, target: string) => call('remove_from_group', { g, target })();
export const deleteGroup = (g: string) => call('delete_group', { g })();
export const muteGroup = (g: string, mute: boolean) => call('mute_group', { g, mute })();
export const reportGroupMessage = (msg: string, reason: string, details?: string) =>
  call('report_group_message', { msg, reason, details: details?.trim() || null })();

export async function fetchGroupMessages(group: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('id,sender,body,created_at')
    .eq('group_id', group)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChatMessage[]; // newest first
}

export async function sendGroupMessage(group: string, body: string): Promise<ChatMessage> {
  const text = body.trim();
  if (!text) throw new Error('Type a message first.');
  if (text.length > 1000) throw new Error('Messages can be at most 1000 characters.');
  const { data, error } = await supabase.from('group_messages').insert({ group_id: group, body: text }).select('id,sender,body,created_at').single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function deleteGroupMessage(id: string) {
  const { error } = await supabase.from('group_messages').delete().eq('id', id);
  if (error) throw error;
}
