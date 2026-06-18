export const BASE_URL = '';
export const USER_URL = (import.meta.env.VITE_AUTH_API_URL || '').replace(/\/signup$/, '/users') || '/api/users';
export const ITENARY_URL = import.meta.env.VITE_ITENARY_API_URL || '/api/itenary';