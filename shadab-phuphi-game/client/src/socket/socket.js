import { io } from 'socket.io-client';

/**
 * Where is the backend?
 *  1. VITE_SERVER_URL, if you set it (frontend and backend hosted separately)
 *  2. While developing (npm run dev): the same computer on port 3001.
 *     Using window.location.hostname means phones on your Wi-Fi work too.
 *  3. In production: the same address that served this page
 *     (Express serves the built frontend).
 */
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

// One shared connection for the whole app. Socket.IO reconnects automatically.
export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnectionDelayMax: 4000,
});

export { SERVER_URL };
