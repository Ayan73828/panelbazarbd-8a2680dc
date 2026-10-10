-- Public product images; writes are restricted to authenticated admins.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 8388608, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif'];

CREATE POLICY product_images_public_read ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-images');

CREATE POLICY product_images_admin_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY product_images_admin_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin())
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY product_images_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin());
