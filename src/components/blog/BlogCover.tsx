import Image from "next/image";
import { HemicycleCover } from "@/components/blog/HemicycleCover";

type BlogCoverVariant = "lead" | "card" | "hero";

interface BlogCoverProps {
  alt: string;
  image?: string | null;
  priority?: boolean;
  slug: string;
  variant?: BlogCoverVariant;
}

export function BlogCover({
  alt,
  image,
  priority = false,
  slug,
  variant = "card",
}: BlogCoverProps) {
  if (!image) {
    return <HemicycleCover slug={slug} variant={variant} />;
  }

  return (
    <Image
      alt={alt}
      className="blog-cover-image"
      fill
      priority={priority}
      sizes={
        variant === "hero"
          ? "(max-width: 1200px) 100vw, 1200px"
          : variant === "lead"
            ? "(max-width: 900px) 100vw, 68vw"
            : "(max-width: 900px) 100vw, 32vw"
      }
      src={image}
    />
  );
}
