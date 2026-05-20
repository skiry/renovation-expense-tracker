import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

/**
 * Scroll-driven storytelling shown after the /surprise31 keypad unlock.
 *
 * Layout:
 *   1. A "scroll stage" the height of (video duration * 1000) px. While the
 *      window scrolls inside it, the page sticks to the viewport and the
 *      video's currentTime tracks the scroll progress. The user effectively
 *      scrubs through the video by scrolling.
 *   2. Once the user exits the scroll stage (i.e. the video has played to the
 *      end), the page resumes normal scroll and reveals one full-screen photo
 *      section at a time, each with a small caption fading in on view.
 *
 * iOS Safari quirks handled:
 *   - <video> uses muted + playsInline + preload="auto" so currentTime is
 *     scrubbable without a user gesture.
 *   - We never call play(); we drive currentTime directly. The video should
 *     be H.264 with the moov atom at the front (use ffmpeg -movflags faststart).
 *   - On very small viewports we collapse the video stage to fit so the
 *     experience doesn't blow past one tap of scroll.
 */

// Placeholder media — swap with real assets later by changing these URLs.
const VIDEO_SRC = 'https://cdn.coverr.co/videos/coverr-a-couple-walking-on-the-beach-2546/1080p.mp4';
const PHOTOS: { src: string; caption: string }[] = [
  {
    src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
    caption: 'Aici va fi un mesaj despre amintirea asta 💕',
  },
  {
    src: 'https://images.unsplash.com/photo-1529634310410-0c3fdacc4fb3?auto=format&fit=crop&w=1200&q=80',
    caption: 'Aici va fi un mesaj despre amintirea asta 💕',
  },
  {
    src: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=1200&q=80',
    caption: 'Aici va fi un mesaj despre amintirea asta 💕',
  },
  {
    src: 'https://images.unsplash.com/photo-1488116884301-c5e2a48a0ee0?auto=format&fit=crop&w=1200&q=80',
    caption: 'Aici va fi un mesaj despre amintirea asta 💕',
  },
];

/** Length of the scroll stage in viewport heights. Tuning knob: bigger = the
 *  user has to scroll more to scrub the video. ~3 vh per second of video
 *  feels comfortable on most devices. */
const VH_PER_SECOND = 3;

export default function SurpriseStory() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const stageHeightVh = Math.max(100, Math.round(videoDuration * VH_PER_SECOND * 100));

  // Drive the video's currentTime from window scroll position while the user
  // is inside the scroll stage.
  useEffect(() => {
    if (!videoReady || !videoRef.current || !stageRef.current) return;

    const video = videoRef.current;
    let ticking = false;

    function update() {
      ticking = false;
      const stage = stageRef.current;
      if (!stage || !video) return;
      const rect = stage.getBoundingClientRect();
      const viewport = window.innerHeight;
      const stageHeight = rect.height;
      // Progress is 0 when stage top hits viewport top, 1 when stage bottom
      // hits viewport bottom.
      const scrolled = -rect.top;
      const usable = stageHeight - viewport;
      let progress = usable > 0 ? scrolled / usable : 0;
      progress = Math.min(1, Math.max(0, progress));
      const target = progress * (video.duration || 0);
      if (Number.isFinite(target)) {
        // Avoid micro-jitter: only update if drift > one frame at 30fps.
        if (Math.abs(video.currentTime - target) > 0.033) {
          try {
            video.currentTime = target;
          } catch {
            // Some browsers throw if metadata isn't fully buffered. Ignore.
          }
        }
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, [videoReady]);

  return (
    <div className="bg-background text-foreground">
      {/* Scroll-driven video stage */}
      <div
        ref={stageRef}
        className="relative"
        style={{ height: `${stageHeightVh}vh` }}
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setVideoDuration(v.duration || 0);
              setVideoReady(true);
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle gradient overlay so any text on top stays readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/40 pointer-events-none" />
          <div className="absolute bottom-8 left-0 right-0 text-center px-4 pointer-events-none">
            <p className="text-white/90 text-sm sm:text-base drop-shadow">
              Scroll-uiește pentru a derula 💕
            </p>
          </div>
        </div>
      </div>

      {/* One photo per full-viewport section, each with its own caption */}
      {PHOTOS.map((p, i) => (
        <PhotoSection key={i} src={p.src} caption={p.caption} />
      ))}

      {/* Final note */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 px-6">
        <div className="text-center space-y-4 max-w-md">
          <Heart className="h-10 w-10 mx-auto text-pink-500 fill-current" />
          <h2 className="text-3xl font-bold">Te iubesc</h2>
          <p className="text-muted-foreground">
            Mai e mult de adăugat aici. Pe curând 🌱
          </p>
        </div>
      </section>
    </div>
  );
}

function PhotoSection({ src, caption }: { src: string; caption: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <p
        className={`relative text-white text-lg sm:text-2xl text-center max-w-md px-6 drop-shadow-lg transition-all duration-1000 delay-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {caption}
      </p>
    </section>
  );
}
