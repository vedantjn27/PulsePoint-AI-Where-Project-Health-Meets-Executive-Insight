import { getApiBase } from "@/lib/api";

type DownloadOptions = {
  filename: string;
  accept?: string;
};

export async function downloadBackendFile(path: string, options: DownloadOptions) {
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: {
      Accept: options.accept || "application/octet-stream",
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail || JSON.stringify(payload);
    } catch {}
    throw new Error(`${response.status}: ${detail}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("The download returned the frontend page instead of a file. Check the deployed API base URL.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromHeader(response.headers.get("content-disposition")) || options.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameFromHeader(header: string | null) {
  if (!header) return null;
  const match = header.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match ? decodeURIComponent(match[1].replace(/"$/g, "")) : null;
}
