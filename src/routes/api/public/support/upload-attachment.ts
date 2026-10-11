import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/upload-attachment")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const authorization = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support attachment storage is not configured." }, { status: 503 });
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Please log in first." }, { status: 401 });
    try {
      const authRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization } });
      if (!authRes.ok) return Response.json({ error: "Your login session expired. Please log in again." }, { status: 401 });
      const user = await authRes.json() as { id: string };
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Choose a photo first." }, { status: 400 });
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ error: "Only JPG, PNG, or WEBP photos are supported." }, { status: 400 });
      if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Photo must be 8 MB or smaller." }, { status: 413 });
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const uploadRes = await fetch(`${url}/storage/v1/object/support-attachments/${objectPath}`, {
        method: "POST",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": file.type, "x-upsert": "false" },
        body: await file.arrayBuffer(),
      });
      if (!uploadRes.ok) {
        console.error("Support photo upload failed", uploadRes.status, (await uploadRes.text()).slice(0, 200));
        return Response.json({ error: "Photo upload failed. Please try again or continue without a photo." }, { status: 502 });
      }
      const signRes = await fetch(`${url}/storage/v1/object/sign/support-attachments/${objectPath}`, {
        method: "POST",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 31536000 }),
      });
      const signed = await signRes.json() as { signedURL?: string; signedUrl?: string };
      const signedPath = signed.signedURL || signed.signedUrl;
      if (!signRes.ok || !signedPath) {
        console.error("Support photo signed URL failed", signRes.status);
        return Response.json({ error: "Photo was uploaded but its secure link could not be created." }, { status: 502 });
      }
      const photoUrl = signedPath.startsWith("http") ? signedPath : `${url}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
      return Response.json({ ok: true, url: photoUrl });
    } catch (error) {
      console.error("Support photo upload failed", error);
      return Response.json({ error: "Could not upload the support photo." }, { status: 500 });
    }
  } } }
});
