import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StoryBank } from '@/components/admin/voice/StoryBank';
import { VoiceAssets } from '@/components/admin/voice/VoiceAssets';
import { VoiceSettings } from '@/components/admin/voice/VoiceSettings';
import { VoiceActivity } from '@/components/admin/voice/VoiceActivity';

/**
 * Admin > Voice. The control surface for the voice engine
 * (services/voice-engine, design in docs/voice-engine/DESIGN.md): the Story
 * Bank it may quote, the media it may use, when and where it posts, and what
 * it did.
 */
const VoiceDashboard = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Voice</h2>
        <p className="text-sm text-muted-foreground">
          Three posts a day under your name. Stories and screenshots you add here are the only
          personal material the engine can use.
        </p>
      </div>

      <Tabs defaultValue="stories" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="stories" className="min-h-[44px]">
            Story Bank
          </TabsTrigger>
          <TabsTrigger value="assets" className="min-h-[44px]">
            Assets
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-[44px]">
            Settings
          </TabsTrigger>
          <TabsTrigger value="activity" className="min-h-[44px]">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories">
          <StoryBank />
        </TabsContent>
        <TabsContent value="assets">
          <VoiceAssets />
        </TabsContent>
        <TabsContent value="settings">
          <VoiceSettings />
        </TabsContent>
        <TabsContent value="activity">
          <VoiceActivity />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VoiceDashboard;
