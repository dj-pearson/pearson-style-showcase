-- Create storage bucket for admin uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-uploads', 'admin-uploads', true);

-- Create storage policies for admin uploads
CREATE POLICY "Admin uploads are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'admin-uploads');

CREATE POLICY "Admins can upload files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'admin-uploads');

CREATE POLICY "Admins can update files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'admin-uploads');

CREATE POLICY "Admins can delete files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'admin-uploads');