/** Shared Client Pipeline Connection Initialization Wrapper */
export const socketConnectionManager = {
  socket: null,
  initialize() {
    this.socket = io({ autoConnect: true });
    return this.socket;
  }
};