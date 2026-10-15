import { getImageProps } from 'next/image'
import { picturesFor } from '@/lib/warm'

/**
 * High-priority preload for the pictures a page opens on, one per breakpoint (media-scoped, so each device
 * fetches only its own candidate). Rendered from the server; React hoists the links into <head>, so the
 * download starts with the HTML instead of after hydration.
 */
export function HeroPreload({ path }: { path: string }) {
  return (
    <>
      {picturesFor(path).map((pic) => {
        const { props } = getImageProps({ src: pic.src, alt: '', width: pic.w, height: pic.h, sizes: pic.sizes, quality: pic.q })
        return (
          <link
            key={`${pic.src}${pic.media ?? ''}`}
            rel="preload"
            as="image"
            href={props.src}
            imageSrcSet={props.srcSet}
            imageSizes={props.sizes}
            media={pic.media}
            fetchPriority="high"
          />
        )
      })}
    </>
  )
}
