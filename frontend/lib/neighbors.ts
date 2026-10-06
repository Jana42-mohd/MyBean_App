import { supabase } from './supabase';

// Parents near you (see supabase/migrations/0012_neighbors.sql for the privacy rules, which the database enforces).

export type Scope = 'area' | 'city' | 'country';

export interface Place {
  country: string | null; // 2-letter code
  city: string;
  region: string;         // state/province of a city picked from the list; empty for a city typed by hand
  area: string;
  discoverable: boolean;
  blocked: boolean; // taken out of the lists after reports, until a moderator reviews
}
export const EMPTY_PLACE: Place = { country: null, city: '', region: '', area: '', discoverable: false, blocked: false };

// "The Annex, Toronto, Ontario"
export const placeLabel = (p: { area?: string | null; city?: string | null; region?: string | null }) =>
  [p.area, [p.city, p.region].filter(Boolean).join(', ')].filter(Boolean).join(', ');

export interface NearbyParent {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  area: string | null;
  connection: 'none' | 'sent' | 'received' | 'connected';
  request_id: string | null;
}

export interface Connection {
  id: string;
  other_id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  area: string | null;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  intro: string | null;
  created_at: string;
  last_message_at: string | null;
  unread: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  body: string;
  created_at: string;
}

export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or rude messages' },
  { key: 'spam', label: 'Spam or selling things' },
  { key: 'unsafe', label: 'Made me feel unsafe' },
  { key: 'inappropriate', label: 'Inappropriate' },
  { key: 'other', label: 'Something else' },
] as const;

async function me(): Promise<string> {
  const { data } = await supabase.auth.getSession(); // local read
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getMyPlace(): Promise<Place> {
  const uid = await me();
  const { data, error } = await supabase
    .from('neighbor_profiles')
    .select('country,city,region,area,discoverable,discovery_blocked')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_PLACE;
  return { country: data.country, city: data.city ?? '', region: data.region ?? '', area: data.area ?? '', discoverable: data.discoverable, blocked: data.discovery_blocked };
}

// Throws a plain-language message when something is missing (the database checks the same rules)
export async function savePlace(p: { country: string | null; city: string; region?: string; area: string; discoverable: boolean }) {
  const city = p.city.trim();
  const region = (p.region ?? '').trim();
  const area = p.area.trim();
  if (p.discoverable && (!p.country || !city)) throw new Error('Choose your country and type your city before turning this on.');
  if (city.length > 60 || area.length > 60 || region.length > 60) throw new Error('City and neighbourhood can be at most 60 characters.');
  const uid = await me();
  const { error } = await supabase
    .from('neighbor_profiles')
    .upsert({ user_id: uid, country: p.country, city: city || null, region: city && region ? region : null, area: area || null, discoverable: p.discoverable }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function nearbyParents(scope: Scope, offset = 0, limit = 30): Promise<NearbyParent[]> {
  const { data, error } = await supabase.rpc('nearby_parents', { scope, lim: limit, off: offset });
  if (error) throw error;
  return (data ?? []) as NearbyParent[];
}

export async function requestConnection(target: string, intro: string) {
  const { error } = await supabase.rpc('request_connection', { target, intro: intro.trim() || null });
  if (error) throw error;
}

export async function respondToRequest(conn: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_connection', { conn, accept });
  if (error) throw error;
}

export async function removeConnection(conn: string) {
  const { error } = await supabase.rpc('remove_connection', { conn });
  if (error) throw error;
}

export async function myConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc('my_connections');
  if (error) throw error;
  return (data ?? []) as Connection[];
}

export async function fetchMessages(conn: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id,sender,body,created_at')
    .eq('connection_id', conn)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChatMessage[]; // newest first
}

export async function sendMessage(conn: string, body: string): Promise<ChatMessage> {
  const text = body.trim();
  if (!text) throw new Error('Type a message first.');
  if (text.length > 1000) throw new Error('Messages can be at most 1000 characters.');
  const { data, error } = await supabase.from('messages').insert({ connection_id: conn, body: text }).select('id,sender,body,created_at').single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) throw error;
}

export async function reportParent(target: string, reason: string, details?: string, messageId?: string) {
  const { error } = await supabase.rpc('report_user', { target, reason, details: details?.trim() || null, message: messageId ?? null });
  if (error) throw error;
}

export async function blockParent(target: string) {
  const { error } = await supabase.from('user_blocks').insert({ blocked_id: target });
  if (error) throw error;
}

// Things waiting for my answer: connection requests (and group invitations, counted by the caller)
export async function incomingRequestCount(): Promise<number> {
  const rows = await myConnections();
  return rows.filter(r => r.status === 'pending' && r.direction === 'incoming').length;
}
