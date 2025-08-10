import axios from "axios";

// Configurable baseURL for Render or other hosts.
// If VITE_API_BASE is empty, requests will use relative paths (behind same-origin proxy like nginx).
const baseURL = import.meta.env.VITE_API_BASE || "";

const api = axios.create({ baseURL });

export default api;
