let listener = null;

export function onSessionExpired(callback) {
  listener = callback;
}

export function notifySessionExpired() {
  if (listener) listener();
}
