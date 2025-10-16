'use client';

import { useState } from 'react';
import { createChef } from '@/app/actions/chefs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function AdminChefForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    slug: '',
    bio: '',
    profileImageUrl: '',
    website: '',
    specialties: '',
    isVerified: false,
    socialLinks: {
      instagram: '',
      twitter: '',
      youtube: ''
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const specialtiesArray = formData.specialties
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const result = await createChef({
        name: formData.name,
        display_name: formData.displayName || null,
        slug: formData.slug,
        bio: formData.bio || null,
        profile_image_url: formData.profileImageUrl || null,
        website: formData.website || null,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
        is_verified: formData.isVerified,
        social_links: {
          instagram: formData.socialLinks.instagram || undefined,
          twitter: formData.socialLinks.twitter || undefined,
          youtube: formData.socialLinks.youtube || undefined
        }
      });

      if (result.success) {
        setSuccess('Chef created successfully!');
        // Reset form
        setFormData({
          name: '',
          displayName: '',
          slug: '',
          bio: '',
          profileImageUrl: '',
          website: '',
          specialties: '',
          isVerified: false,
          socialLinks: {
            instagram: '',
            twitter: '',
            youtube: ''
          }
        });
        setTimeout(() => {
          setSuccess(null);
          setIsOpen(false);
          window.location.reload(); // Refresh to show new chef
        }, 2000);
      } else {
        setError(result.error || 'Failed to create chef');
      }
    } catch (err) {
      console.error('Failed to create chef:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="mb-6">
        <Plus className="w-4 h-4 mr-2" />
        Add New Chef
      </Button>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Add New Chef</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Gordon Ramsay"
              />
            </div>

            {/* Display Name */}
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Chef Gordon Ramsay"
              />
            </div>

            {/* Slug */}
            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                placeholder="gordon-ramsay"
              />
              <p className="text-xs text-jk-olive/60 mt-1">
                URL-friendly identifier (e.g., gordon-ramsay)
              </p>
            </div>

            {/* Profile Image URL */}
            <div>
              <Label htmlFor="profileImageUrl">Profile Image URL</Label>
              <Input
                id="profileImageUrl"
                type="url"
                value={formData.profileImageUrl}
                onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="World-renowned chef and restaurateur..."
              rows={3}
            />
          </div>

          {/* Specialties */}
          <div>
            <Label htmlFor="specialties">Specialties</Label>
            <Input
              id="specialties"
              value={formData.specialties}
              onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
              placeholder="Italian, French, Molecular Gastronomy"
            />
            <p className="text-xs text-jk-olive/60 mt-1">
              Comma-separated list of specialties
            </p>
          </div>

          {/* Website */}
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.socialLinks.instagram}
                onChange={(e) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, instagram: e.target.value }
                })}
                placeholder="username"
              />
            </div>

            <div>
              <Label htmlFor="twitter">X (Twitter)</Label>
              <Input
                id="twitter"
                value={formData.socialLinks.twitter}
                onChange={(e) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, twitter: e.target.value }
                })}
                placeholder="username"
              />
            </div>

            <div>
              <Label htmlFor="youtube">YouTube URL</Label>
              <Input
                id="youtube"
                type="url"
                value={formData.socialLinks.youtube}
                onChange={(e) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, youtube: e.target.value }
                })}
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>

          {/* Verified */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isVerified"
              checked={formData.isVerified}
              onCheckedChange={(checked) => setFormData({ ...formData, isVerified: checked })}
            />
            <Label htmlFor="isVerified">Verified Chef</Label>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Chef'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
