import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Phase 4: emotional Ken Burns-style slideshow with background music.
 *
 * TODO (next commit):
 *   - ~10 photos cycled with zoom+pan (Ken Burns) and per-photo captions
 *   - background music (royalty-free MP3 from /public/surprise/)
 *   - "Pornește" button to satisfy autoplay policies
 *   - finishes after ~30s and calls onComplete
 */
export default function SlideshowPhase({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Filmul nostru</h2>
          <p className="text-sm text-muted-foreground">
            Un slideshow cu amintiri și o piesă de fundal. Apasă „Pornește" când ești gata.
          </p>
          <div className="aspect-video rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
            (slideshow ~30s — în construcție)
          </div>
          <Button type="button" onClick={onComplete} className="w-full">
            Marchează ca terminat (placeholder)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
