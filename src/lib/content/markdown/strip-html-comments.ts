/** Remove authoring and machine-readable HTML comments before markdown render. */
export function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}
