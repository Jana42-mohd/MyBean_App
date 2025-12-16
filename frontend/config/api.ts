// API Configuration for MyBean Backend
// Points to your EC2 instance

const EC2_IP = '50.16.100.244';
const API_PORT = '4000';

export const API_BASE_URL = `http://${EC2_IP}:${API_PORT}`;

export const API_ENDPOINTS = {
  // Authentication
  signup: `${API_BASE_URL}/auth/signup`,
  login: `${API_BASE_URL}/auth/login`,
  profile: `${API_BASE_URL}/auth/profile`,

  // Community Posts
  posts: `${API_BASE_URL}/posts`,
  like: (postId: string) => `${API_BASE_URL}/posts/${postId}/like`,
  save: (postId: string) => `${API_BASE_URL}/posts/${postId}/save`,

  // Survey/Profile
  survey: `${API_BASE_URL}/survey`,

  // Activities (future)
  activities: `${API_BASE_URL}/activities`,
};

// Helper function for authenticated requests
export const fetchWithAuth = async (
  url: string,
  options?: RequestInit,
  token?: string
) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
};

// Test connection to backend
export const testBackendConnection = async () => {
  try {
    const response = await fetch(API_BASE_URL, { method: 'GET' });
    return response.ok || response.status === 404; // 404 is fine, means server is up
  } catch (error) {
    console.error('Backend connection failed:', error);
    return false;
  }
};
