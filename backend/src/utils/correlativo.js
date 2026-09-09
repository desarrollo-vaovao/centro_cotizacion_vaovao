export function pad(n, width) {
  return String(n).padStart(width, '0');
}

export function buildGeneralCorrelativo(year, seq) {
  return `PC-${year}-${pad(seq, 3)}`;
}

export function buildClientCorrelativo(clientCode, seq) {
  return `PC-${clientCode}-${pad(seq, 3)}`;
}

export function withVersionSuffix(base, version) {
  const stripped = base.replace(/ v\d+$/, '');
  return version > 1 ? `${stripped} v${version}` : stripped;
}
