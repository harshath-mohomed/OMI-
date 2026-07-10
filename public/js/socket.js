/** Shared Client Pipeline Connection Initialization Wrapper */
export const socketConnectionManager = {
  socket: null,
  initialize() {
    const socketUrl = window.location.origin;
    this.socket = io(socketUrl, { autoConnect: true });
    return this.socket;
  }
};