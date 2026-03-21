export async function shareOrCopy(title: string, text: string, url?: string): Promise<void> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
  } else {
    await navigator.clipboard.writeText(url ?? text);
  }
}
