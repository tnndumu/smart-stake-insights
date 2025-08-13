export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const url = new URL(window.location.href);
    url.hash = id;
    history.replaceState({}, "", url.toString());
  } catch {
    el.scrollIntoView();
  }
  return true;
}

export function onAnchor(id: string) {
  return (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    scrollToId(id);
  };
}