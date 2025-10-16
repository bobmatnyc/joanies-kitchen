'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  createOrUpdateProfile,
  checkUsernameAvailability,
} from '@/app/actions/user-profiles';
import type { UserProfile } from '@/lib/db/user-discovery-schema';

interface ProfileEditorProps {
  profile?: UserProfile | null;
  onSuccess?: (profile: UserProfile) => void;
}

export function ProfileEditor({ profile, onSuccess }: ProfileEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Form state
  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [specialties, setSpecialties] = useState<string>(
    profile?.specialties?.join(', ') || ''
  );
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);

  // Check username availability when it changes
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username === profile?.username) {
        setUsernameAvailable(null);
        return;
      }

      if (username.length < 3) {
        setUsernameAvailable(false);
        return;
      }

      setCheckingUsername(true);
      const available = await checkUsernameAvailability(username);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    };

    const debounce = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounce);
  }, [username, profile?.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Parse specialties from comma-separated string
      const specialtiesArray = specialties
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const result = await createOrUpdateProfile({
        username: username.toLowerCase(),
        display_name: displayName,
        bio: bio || undefined,
        location: location || undefined,
        website: website || undefined,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
        is_public: isPublic,
      });

      if (result.success && result.profile) {
        if (onSuccess) {
          onSuccess(result.profile);
        } else {
          router.push(`/profile/${result.profile.username}`);
          router.refresh();
        }
      } else {
        setError(result.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const usernameValid = username.length >= 3 && /^[a-z0-9_-]+$/.test(username);
  const canSubmit =
    usernameValid &&
    displayName.length > 0 &&
    (usernameAvailable === null || usernameAvailable === true) &&
    !isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      <div className="space-y-2">
        <Label htmlFor="username">
          Username <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="your-username"
            required
            disabled={!!profile?.username}
            className={
              username && !usernameValid
                ? 'border-red-500'
                : usernameAvailable === false
                ? 'border-red-500'
                : usernameAvailable === true
                ? 'border-green-500'
                : ''
            }
          />
          {checkingUsername && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              Checking...
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Lowercase letters, numbers, hyphens, and underscores only (3-30 characters)
        </p>
        {usernameAvailable === false && (
          <p className="text-sm text-red-500">Username is already taken</p>
        )}
        {usernameAvailable === true && (
          <p className="text-sm text-green-500">Username is available</p>
        )}
        {profile?.username && (
          <p className="text-sm text-orange-500">
            Username cannot be changed after profile creation
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your Name"
          required
          maxLength={100}
        />
        <p className="text-sm text-gray-500">Your public display name</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself and your cooking style..."
          maxLength={500}
          rows={4}
        />
        <p className="text-sm text-gray-500 text-right">
          {bio.length}/500 characters
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, State/Country"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://your-website.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialties">Specialties</Label>
        <Input
          id="specialties"
          type="text"
          value={specialties}
          onChange={(e) => setSpecialties(e.target.value)}
          placeholder="Italian, Baking, Vegan, BBQ..."
        />
        <p className="text-sm text-gray-500">
          Comma-separated list of your cooking specialties (max 10)
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
        <Label htmlFor="isPublic" className="cursor-pointer">
          Public Profile
        </Label>
      </div>
      <p className="text-sm text-gray-500">
        {isPublic
          ? 'Your profile is visible to everyone'
          : 'Your profile is private and only visible to you'}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="flex-1"
        >
          {isLoading ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
