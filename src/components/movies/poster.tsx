import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnimePoster({
  src,
  alt,
  className,
  imgClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-surface-2 text-muted-2",
        className,
      )}
    >
      {src ? (
        // External CDN posters; native img avoids remotePatterns config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("size-full object-cover", imgClassName)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Clapperboard className="size-8" />
        </div>
      )}
    </div>
  );
}
