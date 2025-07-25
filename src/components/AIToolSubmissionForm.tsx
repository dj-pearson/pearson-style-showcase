import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Send, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

const AI_CATEGORIES = [
  'Natural Language Processing',
  'Computer Vision',
  'Machine Learning',
  'Data Analysis',
  'Automation',
  'Content Generation',
  'Voice & Audio',
  'Image Processing',
  'Code Generation',
  'Productivity',
  'Other'
];

const COMPLEXITY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const PRICING_OPTIONS = ['Free', 'Freemium', 'Paid', 'Open Source', 'Enterprise'];

interface SubmissionFormData {
  title: string;
  description: string;
  category: string;
  link: string;
  features: string;
  pricing: string;
  complexity: string;
  tags: string;
  submitter_email: string;
  submitter_name: string;
}

export const AIToolSubmissionForm: React.FC = () => {
  const [formData, setFormData] = useState<SubmissionFormData>({
    title: '',
    description: '',
    category: '',
    link: '',
    features: '',
    pricing: 'Free',
    complexity: 'Intermediate',
    tags: '',
    submitter_email: '',
    submitter_name: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof SubmissionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      link: '',
      features: '',
      pricing: 'Free',
      complexity: 'Intermediate',
      tags: '',
      submitter_email: '',
      submitter_name: ''
    });
    setIsSubmitted(false);
  };

  const validateForm = (): boolean => {
    const requiredFields = ['title', 'description', 'category', 'link', 'submitter_email', 'submitter_name'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof SubmissionFormData]);
    
    if (missingFields.length > 0) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: `Please fill in: ${missingFields.join(', ')}`,
      });
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.submitter_email)) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return false;
    }

    // Validate URL format
    try {
      new URL(formData.link);
    } catch {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid tool website URL.",
      });
      return false;
    }

    return true;
  };

  const submitTool = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      // Process arrays
      const features = formData.features
        ? formData.features.split(',').map(f => f.trim()).filter(f => f)
        : [];
      
      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      const submissionData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        link: formData.link,
        features: features.length > 0 ? features : null,
        pricing: formData.pricing,
        complexity: formData.complexity,
        tags: tags.length > 0 ? tags : null,
        status: 'Draft', // Set to draft for admin approval
        sort_order: 0, // Will be set when approved
        // Add submission metadata
        submission_metadata: {
          submitter_name: formData.submitter_name,
          submitter_email: formData.submitter_email,
          submission_date: new Date().toISOString(),
          submission_source: 'user_form'
        } as Json
      };

      const { error } = await supabase
        .from('ai_tools')
        .insert([submissionData]);

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Tool submitted successfully!",
        description: "Your AI tool has been submitted for review. We'll get back to you soon!",
      });

    } catch (error) {
      console.error('Error submitting AI tool:', error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "Could not submit your tool. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Thank you for your submission!</h2>
          <p className="text-muted-foreground mb-6">
            Your AI tool "{formData.title}" has been submitted for review. Our team will evaluate it and get back to you within 2-3 business days.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground mb-6">
            <p>✅ Tool submitted to review queue</p>
            <p>✅ Confirmation sent to {formData.submitter_email}</p>
            <p>⏳ Review in progress (typically 1-3 days)</p>
            <p>🚀 Once approved, your tool will appear on the AI Tools page</p>
          </div>
          <Button onClick={resetForm} variant="outline">
            Submit Another Tool
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="h-5 w-5 mr-2 text-primary" />
          Submit Your AI Tool
        </CardTitle>
        <CardDescription>
          Share your AI tool with our community! All submissions are reviewed before going live.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please ensure your tool is functional and provide accurate information. 
            Submissions typically take 1-3 business days to review.
          </AlertDescription>
        </Alert>

        {/* Submitter Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="submitter_name">Your Name *</Label>
              <Input
                id="submitter_name"
                value={formData.submitter_name}
                onChange={(e) => handleInputChange('submitter_name', e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="submitter_email">Your Email *</Label>
              <Input
                id="submitter_email"
                type="email"
                value={formData.submitter_email}
                onChange={(e) => handleInputChange('submitter_email', e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>
        </div>

        {/* Tool Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Tool Information</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Tool Name *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="My Amazing AI Tool"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {AI_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="link">Tool Website *</Label>
            <Input
              id="link"
              type="url"
              value={formData.link}
              onChange={(e) => handleInputChange('link', e.target.value)}
              placeholder="https://your-tool-website.com"
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what your AI tool does, its main features, and who it's for..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="features">Key Features</Label>
            <Textarea
              id="features"
              value={formData.features}
              onChange={(e) => handleInputChange('features', e.target.value)}
              placeholder="Feature 1, Feature 2, Feature 3"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate each feature with a comma
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pricing">Pricing *</Label>
              <Select
                value={formData.pricing}
                onValueChange={(value) => handleInputChange('pricing', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complexity">User Level *</Label>
              <Select
                value={formData.complexity}
                onValueChange={(value) => handleInputChange('complexity', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder="AI, machine learning, automation, etc."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate each tag with a comma
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Reset Form
          </Button>
          <Button
            onClick={submitTool}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit Tool'}
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            By submitting this tool, you confirm that you have the right to share this information 
            and that all details are accurate. We reserve the right to edit or reject submissions.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
